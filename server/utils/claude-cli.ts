import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { claudeAuthStatus } from '../database/schema'
import { getDataDir } from './data-dir'

// Grading is pure text-in/text-out analysis — no tools, no permission prompts, no session
// files left behind for every automated call (confirmed working in the Phase 0 spike).
const CLI_TIMEOUT_MS = 60_000

const JSON_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['acceptable', 'needs_more_info'] },
    feedback: { type: 'string' },
    follow_up_question: { type: ['string', 'null'] }
  },
  required: ['verdict', 'feedback', 'follow_up_question'],
  additionalProperties: false
})

const gradingResultSchema = z.object({
  verdict: z.enum(['acceptable', 'needs_more_info']),
  feedback: z.string(),
  follow_up_question: z.string().nullable()
})

export interface GradingResult {
  verdict: 'acceptable' | 'needs_more_info'
  feedback: string
  followUpQuestion: string | null
}

// Thrown when the CLI itself reports "not logged in" — distinct from a generic failure so the
// caller can flip the admin re-auth banner instead of just surfacing a one-off error.
export class ClaudeAuthError extends Error {}
// Any other failure: CLI couldn't start, non-JSON output, output that doesn't match the schema.
export class ClaudeGradingError extends Error {}

export function getClaudeHomeDir() {
  return join(getDataDir(), 'claude-home')
}

function isAuthErrorText(text: string) {
  return text.includes('Not logged in') || text.includes('/login')
}

async function runClaudeCli(args: string[], stdin?: string): Promise<{ stdout: string, exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, {
      env: { ...process.env, HOME: getClaudeHomeDir() },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let settled = false

    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new ClaudeGradingError('Claude CLI timed out'))
    }, CLI_TIMEOUT_MS)

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    // stderr is ignored — failures are read from the JSON envelope
    child.stderr.on('data', () => {})

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(new ClaudeGradingError(`Could not start claude CLI: ${err.message}`))
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve({ stdout, exitCode: code ?? 1 })
    })

    if (stdin !== undefined) {
      child.stdin.write(stdin)
    }
    child.stdin.end()
  })
}

async function recordAuthStatus(status: 'ok' | 'needs_reauth', errorMessage: string | null) {
  const now = Date.now()
  const [existing] = await db.select().from(claudeAuthStatus).where(eq(claudeAuthStatus.id, 1)).limit(1)
  if (existing) {
    await db.update(claudeAuthStatus).set({ status, lastCheckedAt: now, lastErrorMessage: errorMessage }).where(eq(claudeAuthStatus.id, 1))
  } else {
    await db.insert(claudeAuthStatus).values({ id: 1, status, lastCheckedAt: now, lastErrorMessage: errorMessage })
  }
}

async function runGradingOnce(prompt: string): Promise<GradingResult> {
  const { stdout, exitCode } = await runClaudeCli([
    '-p',
    '--output-format', 'json',
    '--tools', '',
    '--permission-prompts', 'none',
    '--no-session-persistence',
    '--json-schema', JSON_SCHEMA
  ], prompt)

  let envelope: { is_error?: boolean, result?: unknown }
  try {
    envelope = JSON.parse(stdout)
  } catch {
    throw new ClaudeGradingError(`Claude CLI returned unparseable output (exit ${exitCode}): ${stdout.slice(0, 500)}`)
  }

  if (envelope.is_error) {
    const resultText = typeof envelope.result === 'string' ? envelope.result : JSON.stringify(envelope.result)
    if (isAuthErrorText(resultText)) {
      throw new ClaudeAuthError(resultText)
    }
    throw new ClaudeGradingError(resultText)
  }

  let parsed: unknown
  try {
    parsed = typeof envelope.result === 'string' ? JSON.parse(envelope.result) : envelope.result
  } catch {
    throw new ClaudeGradingError(`Claude did not return valid JSON: ${String(envelope.result).slice(0, 500)}`)
  }

  const validated = gradingResultSchema.parse(parsed)
  return {
    verdict: validated.verdict,
    feedback: validated.feedback,
    followUpQuestion: validated.follow_up_question
  }
}

// One best-effort retry on a non-auth failure (malformed/truncated output) — an auth failure is
// never retried since it will just fail identically.
export async function gradeAnswer(prompt: string): Promise<GradingResult> {
  try {
    const result = await runGradingOnce(prompt)
    await recordAuthStatus('ok', null)
    return result
  } catch (err) {
    if (err instanceof ClaudeAuthError) {
      await recordAuthStatus('needs_reauth', err.message)
      throw err
    }

    try {
      const result = await runGradingOnce(prompt)
      await recordAuthStatus('ok', null)
      return result
    } catch (retryErr) {
      if (retryErr instanceof ClaudeAuthError) {
        await recordAuthStatus('needs_reauth', retryErr.message)
      }
      throw retryErr
    }
  }
}

// Lets the admin dashboard proactively check auth state on demand, not just reactively after a
// grading call happens to fail.
export async function checkAuthStatusLive(): Promise<{ loggedIn: boolean }> {
  const { stdout } = await runClaudeCli(['auth', 'status', '--json'])

  let parsed: { loggedIn?: boolean }
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new ClaudeGradingError(`Could not parse "claude auth status" output: ${stdout.slice(0, 500)}`)
  }

  const loggedIn = Boolean(parsed.loggedIn)
  await recordAuthStatus(loggedIn ? 'ok' : 'needs_reauth', loggedIn ? null : 'Not logged in')
  return { loggedIn }
}

export interface GradingContext {
  // Admin-authored, subject-level — e.g. the grader's role and how strict to be
  // ("the student is aiming for an A, mark strictly"). Optional.
  customInstructions: string | null
  syllabusText: string | null
  markSchemeText: string | null
  chapterText: string | null
  passageText: string | null
  originalQuestion: string
  priorRounds: { promptText: string, answerText: string, feedback: string }[]
  currentPrompt: string
  latestAnswer: string
}

// Long documents are truncated to a fixed budget rather than summarized — a known v1 limitation.
const MAX_DOCUMENT_CHARS = 20_000

function truncated(text: string | null): string | null {
  if (!text) return null
  return text.length > MAX_DOCUMENT_CHARS ? `${text.slice(0, MAX_DOCUMENT_CHARS)}\n...[truncated]` : text
}

export function buildGradingPrompt(ctx: GradingContext): string {
  const parts: string[] = []

  parts.push(
    'You are checking a student\'s understanding of a topic — not grading for exact wording. '
    + 'Judge whether their answer demonstrates real understanding of the question below, using the '
    + 'syllabus and mark scheme as a guide to what matters. If the answer is incomplete, vague, or '
    + 'shows a misunderstanding, ask ONE focused follow-up question to probe further rather than '
    + 'giving away the answer yourself. Mark it acceptable once the student has shown genuine '
    + 'understanding, even if the wording differs from the mark scheme.'
  )

  if (ctx.customInstructions) {
    parts.push(`## Instructions from the teacher for this subject\n${ctx.customInstructions}`)
  }

  const syllabusText = truncated(ctx.syllabusText)
  if (syllabusText) parts.push(`## Syllabus\n${syllabusText}`)

  const markSchemeText = truncated(ctx.markSchemeText)
  if (markSchemeText) parts.push(`## Mark scheme\n${markSchemeText}`)

  const chapterText = truncated(ctx.chapterText)
  if (chapterText) parts.push(`## Chapter context\n${chapterText}`)

  if (ctx.passageText) parts.push(`## Passage shown to the student\n${ctx.passageText}`)

  parts.push(`## Original question\n${ctx.originalQuestion}`)

  if (ctx.priorRounds.length > 0) {
    const history = ctx.priorRounds
      .map((r, i) => `Round ${i + 1}:\nAsked: ${r.promptText}\nStudent answered: ${r.answerText}\nYour feedback: ${r.feedback}`)
      .join('\n\n')
    parts.push(`## Conversation so far\n${history}`)
  }

  parts.push(`## What the student was just asked\n${ctx.currentPrompt}`)
  parts.push(`## Student's latest answer\n${ctx.latestAnswer}`)

  return parts.join('\n\n')
}
