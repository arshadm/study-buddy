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

async function runClaudeCli(args: string[], stdin?: string, timeoutMs = CLI_TIMEOUT_MS): Promise<{ stdout: string, exitCode: number }> {
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
    }, timeoutMs)

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

// --- Tag and difficulty suggestions from question images ---

export interface SuggestionImage {
  label: string
  data: Buffer
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp'
}

const SUGGESTION_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    tags: { type: 'array', items: { type: 'string' } },
    difficulty: { type: 'integer', minimum: 1, maximum: 5 }
  },
  required: ['tags', 'difficulty'],
  additionalProperties: false
})

const suggestionSchema = z.object({
  tags: z.array(z.string()),
  difficulty: z.number().int().min(1).max(5)
})

export interface QuestionSuggestion {
  tags: string[]
  difficulty: number
}

// Anchored scale — without fixed descriptions per level, ratings bunch up around 3. Kept in sync
// with the 1–5 options in the admin question form.
const DIFFICULTY_SCALE = [
  '1 — a single routine step: direct recall, substitution or one standard rule.',
  '2 — a standard textbook exercise: 2–3 steps with an obvious method.',
  '3 — multi-step or combines two ideas; the typical mid-paper exam question.',
  '4 — the method must be chosen, the setting is unfamiliar, or the working is long; late in a paper.',
  '5 — among the hardest questions in such an exam: proof, genuine insight, or long chains of reasoning across parts.'
]

export function buildSuggestionPrompt(images: SuggestionImage[], tagNames: string[], subjectName: string): string {
  return [
    `These images are from one "${subjectName}" exam question${images.length > 1 ? ` (${images.map(i => i.label).join(', ')})` : ''}.`,
    '',
    '## Tags',
    ...(tagNames.length > 0
      ? [
          'Choose the tags that best describe the topics a student must use to answer it — usually 1 to 4.',
          'Prefer the specific topic actually being tested over broad or merely incidental ones.',
          'Use ONLY tags from this list, spelled exactly as written. If none fit, return an empty list.',
          '',
          ...tagNames.map(t => `- ${t}`)
        ]
      : ['This subject has no tag list — return an empty list.']),
    '',
    '## Difficulty',
    `Rate how hard the question is for a student taking "${subjectName}", judged against that level — not against harder or easier qualifications. Use the whole scale:`,
    ...DIFFICULTY_SCALE.map(l => `- ${l}`),
    'Use the marks available, the length of the worked solution and mark scheme, and how much of the method the question gives away as evidence. For a multi-part question, rate the question as a whole, leaning towards its hardest part.'
  ].join('\n')
}

// Images can't go through a plain-text prompt, and grading runs with every tool disabled (so
// the CLI can't Read a file path either) — instead images and prompt are sent as one stream-json
// user turn with inline base64 image blocks. Returns the structured JSON result (validated against
// jsonSchema by the CLI; callers still parse it with zod).
async function runImagePromptOnce(images: SuggestionImage[], text: string, jsonSchema: string, timeoutMs = CLI_TIMEOUT_MS): Promise<unknown> {
  const message = JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [
        ...images.flatMap(img => [
          { type: 'text', text: img.label },
          { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data.toString('base64') } }
        ]),
        { type: 'text', text }
      ]
    }
  })

  const { stdout, exitCode } = await runClaudeCli([
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--tools', '',
    '--permission-prompts', 'none',
    '--no-session-persistence',
    '--json-schema', jsonSchema
  ], `${message}\n`, timeoutMs)

  let resultEvent: { is_error?: boolean, result?: unknown, structured_output?: unknown } | undefined
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line)
      if (event.type === 'result') resultEvent = event
    } catch {
      // non-JSON noise — ignore
    }
  }

  if (!resultEvent) {
    if (isAuthErrorText(stdout)) throw new ClaudeAuthError(stdout.slice(0, 500))
    throw new ClaudeGradingError(`Claude CLI returned no result (exit ${exitCode}): ${stdout.slice(0, 500)}`)
  }
  if (resultEvent.is_error) {
    const resultText = typeof resultEvent.result === 'string' ? resultEvent.result : JSON.stringify(resultEvent.result)
    if (isAuthErrorText(resultText)) throw new ClaudeAuthError(resultText)
    throw new ClaudeGradingError(resultText)
  }

  if (resultEvent.structured_output !== undefined) return resultEvent.structured_output
  try {
    return typeof resultEvent.result === 'string' ? JSON.parse(resultEvent.result) : resultEvent.result
  } catch {
    throw new ClaudeGradingError(`Claude did not return valid JSON: ${String(resultEvent.result).slice(0, 500)}`)
  }
}

// Same retry/auth-banner policy as gradeAnswer: one retry on a generic failure, none on an auth
// failure (which flips the admin re-auth banner instead).
async function withRetryAndAuthStatus<T>(run: () => Promise<T>): Promise<T> {
  try {
    const result = await run()
    await recordAuthStatus('ok', null)
    return result
  } catch (err) {
    if (err instanceof ClaudeAuthError) {
      await recordAuthStatus('needs_reauth', err.message)
      throw err
    }
    try {
      const result = await run()
      await recordAuthStatus('ok', null)
      return result
    } catch (retryErr) {
      if (retryErr instanceof ClaudeAuthError) await recordAuthStatus('needs_reauth', retryErr.message)
      throw retryErr
    }
  }
}

// Tag names come back exactly as Claude wrote them; the caller maps them back onto the subject's
// tag list and drops anything that isn't on it.
export async function suggestTagsAndDifficulty(images: SuggestionImage[], tagNames: string[], subjectName: string): Promise<QuestionSuggestion> {
  return withRetryAndAuthStatus(async () =>
    suggestionSchema.parse(await runImagePromptOnce(images, buildSuggestionPrompt(images, tagNames, subjectName), SUGGESTION_SCHEMA)))
}

// --- Step-by-step explanations ---

const EXPLANATION_TIMEOUT_MS = 240_000

const explanationSchema = z.object({
  summary: z.string(),
  steps: z.array(z.object({
    title: z.string(),
    explanation: z.string(),
    working: z.string().nullable(),
    marks: z.string().nullable()
  })).min(1),
  final_answer: z.string(),
  common_mistakes: z.array(z.string()),
  matches_official_answer: z.boolean().nullable()
})

export type QuestionExplanation = z.infer<typeof explanationSchema>

const EXPLANATION_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    summary: { type: 'string' },
    steps: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          explanation: { type: 'string' },
          working: { type: ['string', 'null'] },
          marks: { type: ['string', 'null'] }
        },
        required: ['title', 'explanation', 'working', 'marks'],
        additionalProperties: false
      }
    },
    final_answer: { type: 'string' },
    common_mistakes: { type: 'array', items: { type: 'string' } },
    matches_official_answer: { type: ['boolean', 'null'] }
  },
  required: ['summary', 'steps', 'final_answer', 'common_mistakes', 'matches_official_answer'],
  additionalProperties: false
})

export function buildExplanationPrompt(images: SuggestionImage[], subjectName: string): string {
  const hasOfficial = images.some(i => i.label !== 'Question')
  return [
    `You are a patient, expert tutor. The first image is a "${subjectName}" exam question${hasOfficial ? `; the others are the official ${images.filter(i => i.label !== 'Question').map(i => i.label.toLowerCase()).join(' and ')}` : ''}.`,
    'A student has attempted it and now wants a clear, detailed account of how to solve it.',
    '',
    '## How to work',
    '1. Solve the question yourself, carefully, from the question image alone.',
    hasOfficial
      ? '2. Then check your working against the official material. If they disagree, find your mistake and follow the official answer; if you are confident the official answer itself is wrong, still present it, and say so in the summary. Set matches_official_answer to whether your independent answer agreed.'
      : '2. There is no official answer to check against — re-check each step, and set matches_official_answer to null.',
    '3. Write the explanation for a student at this level: explain *why* each step is taken, not only what is done. Do not skip algebra a student could get stuck on.',
    '',
    '## Output',
    '- summary: 1–2 sentences on what the question tests and the overall approach.',
    '- steps: one entry per step, in order. For multi-part questions, start each part\'s first step title with the part label, e.g. "(a) Resolve forces".',
    '  - title: a short heading for the step; any maths in it also goes in $...$.',
    '  - explanation: the reasoning in plain words, with inline maths in $...$.',
    '  - working: the key line(s) of working as LaTeX with NO surrounding $ delimiters (it is shown as display maths); use \\\\ between lines or an aligned environment for several lines. null if the step has no working.',
    hasOfficial
      ? '  - marks: the mark-scheme credit this step earns (e.g. "M1", "M1 A1", "B1"), if the mark scheme shows it; otherwise null.'
      : '  - marks: null.',
    '- final_answer: the final answer(s), with maths in $...$; for several parts, label each one.',
    '- common_mistakes: 1–3 specific mistakes students make on this question (empty if none worth noting).',
    '',
    'Use LaTeX for all mathematics (fractions, powers, vectors, units such as $\\text{m s}^{-2}$). Do not use Markdown, HTML or images.'
  ].join('\n')
}

export async function explainQuestion(images: SuggestionImage[], subjectName: string): Promise<QuestionExplanation> {
  return withRetryAndAuthStatus(async () =>
    explanationSchema.parse(await runImagePromptOnce(images, buildExplanationPrompt(images, subjectName), EXPLANATION_SCHEMA, EXPLANATION_TIMEOUT_MS)))
}
