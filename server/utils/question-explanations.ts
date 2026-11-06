import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { questionExplanations, questions, subjects } from '../database/schema'
import { ClaudeAuthError, explainQuestion, type QuestionExplanation } from './claude-cli'
import { imagesForQuestion } from './tag-suggestions'

// Claude's step-by-step solution for a question. Generated once, in the background, the first time
// any student asks, then shared by every student who asks after. Generation takes up to a few
// minutes, so the request only starts it; the page polls getExplanationState until it lands.

// A 'pending' row older than this has outlived the CLI timeout (plus retry) — the process was
// restarted mid-call — so the next request starts over instead of waiting forever.
const STALE_PENDING_MS = 10 * 60_000

export type ExplanationState
  = | { status: 'none' }
    | { status: 'pending' }
    | { status: 'failed', error: string }
    | { status: 'done', explanation: QuestionExplanation }

const inFlight = new Set<number>()

export async function getExplanationState(questionId: number): Promise<ExplanationState> {
  const [row] = await db.select().from(questionExplanations).where(eq(questionExplanations.questionId, questionId)).limit(1)
  if (!row) return { status: 'none' }
  if (row.status === 'done') return { status: 'done', explanation: row.content as QuestionExplanation }
  if (row.status === 'failed') return { status: 'failed', error: row.error ?? 'Could not generate an explanation' }
  if (!inFlight.has(questionId) && Date.now() - row.updatedAt > STALE_PENDING_MS) return { status: 'none' }
  return { status: 'pending' }
}

// Starts generation unless there's already a finished or in-progress explanation; `force`
// (admin regenerate) replaces a finished one. Returns the state to show straight away.
export async function requestExplanation(questionId: number, { force = false } = {}): Promise<ExplanationState> {
  const state = await getExplanationState(questionId)
  if (state.status === 'pending') return state
  if (state.status === 'done' && !force) return state

  const now = Date.now()
  await db.insert(questionExplanations)
    .values({ questionId, status: 'pending', content: null, error: null, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: questionExplanations.questionId, set: { status: 'pending', error: null, updatedAt: now } })
  void generate(questionId)
  return { status: 'pending' }
}

export async function deleteExplanation(questionId: number) {
  await db.delete(questionExplanations).where(eq(questionExplanations.questionId, questionId))
}

async function generate(questionId: number) {
  if (inFlight.has(questionId)) return
  inFlight.add(questionId)
  try {
    const [question] = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1)
    if (!question) return
    const [subject] = await db.select({ name: subjects.name }).from(subjects).where(eq(subjects.id, question.subjectId)).limit(1)
    const images = await imagesForQuestion(question)
    if (!images.some(img => img.label === 'Question')) throw new Error('The question image is missing')

    const explanation = await explainQuestion(images, subject?.name ?? 'exam')
    await db.update(questionExplanations)
      .set({ status: 'done', content: explanation, error: null, updatedAt: Date.now() })
      .where(eq(questionExplanations.questionId, questionId))
  } catch (err) {
    console.warn(`[study-buddy] Explaining question ${questionId} failed:`, err instanceof Error ? err.message : err)
    const error = err instanceof ClaudeAuthError
      ? 'Claude needs re-authentication — ask your admin.'
      : 'Claude couldn\'t produce an explanation this time.'
    await db.update(questionExplanations)
      .set({ status: 'failed', error, updatedAt: Date.now() })
      .where(eq(questionExplanations.questionId, questionId))
  } finally {
    inFlight.delete(questionId)
  }
}
