import { and, asc, eq } from 'drizzle-orm'
import { db } from '../database/client'
import {
  openQuestionSets,
  openQuestions,
  openQuestionSetAttempts,
  openQuestionAttempts,
  openQuestionRounds
} from '../database/schema'
import { gradeOpenQuestionAnswer, type PriorRound } from './open-question-grading'
import { ClaudeAuthError, ClaudeGradingError } from './claude-cli'

// After this many graded rounds without an "acceptable" verdict, the question is handed to the
// admin for manual review instead of looping forever.
const MAX_ROUNDS = 5

// Ensures there is a current in-progress open_question_attempt for the set attempt (creating
// the next active question's attempt + round 0 if needed), or marks the set attempt completed
// once every active question has reached a terminal state. Safe to call repeatedly.
export async function advanceToNextQuestion(setAttemptId: number) {
  const [setAttempt] = await db.select().from(openQuestionSetAttempts).where(eq(openQuestionSetAttempts.id, setAttemptId)).limit(1)
  if (!setAttempt) {
    throw createError({ statusCode: 404, statusMessage: 'Attempt not found' })
  }

  const activeQuestions = await db.select().from(openQuestions)
    .where(and(eq(openQuestions.setId, setAttempt.setId), eq(openQuestions.isActive, true)))
    .orderBy(asc(openQuestions.sortOrder))

  const existingAttempts = await db.select().from(openQuestionAttempts)
    .where(eq(openQuestionAttempts.setAttemptId, setAttemptId))
  const attemptByQuestionId = new Map(existingAttempts.map(a => [a.openQuestionId, a]))

  for (const question of activeQuestions) {
    const existing = attemptByQuestionId.get(question.id)
    if (existing?.status === 'in_progress') return
    if (existing) continue

    const now = Date.now()
    const [newAttempt] = await db.insert(openQuestionAttempts).values({
      setAttemptId,
      openQuestionId: question.id,
      studentId: setAttempt.studentId,
      status: 'in_progress',
      roundCount: 0,
      startedAt: now
    }).returning()

    await db.insert(openQuestionRounds).values({
      attemptId: newAttempt!.id,
      roundIndex: 0,
      promptText: question.promptText,
      gradingStatus: 'pending'
    })
    return
  }

  if (setAttempt.status !== 'completed') {
    await db.update(openQuestionSetAttempts)
      .set({ status: 'completed', completedAt: Date.now() })
      .where(eq(openQuestionSetAttempts.id, setAttemptId))
  }
}

export async function startOrResumeSetAttempt(setId: number, studentId: number): Promise<number> {
  const [existing] = await db.select().from(openQuestionSetAttempts)
    .where(and(eq(openQuestionSetAttempts.setId, setId), eq(openQuestionSetAttempts.studentId, studentId)))
    .limit(1)
  if (existing) return existing.id

  const [set] = await db.select().from(openQuestionSets).where(eq(openQuestionSets.id, setId)).limit(1)
  if (!set) {
    throw createError({ statusCode: 404, statusMessage: 'Discussion activity not found' })
  }

  const [attempt] = await db.insert(openQuestionSetAttempts).values({
    setId,
    studentId,
    subjectId: set.subjectId,
    status: 'in_progress',
    startedAt: Date.now()
  }).returning()

  await advanceToNextQuestion(attempt!.id)
  return attempt!.id
}

export interface DiscussionAttemptState {
  setAttemptId: number
  setTitle: string
  passageText: string | null
  status: 'in_progress' | 'completed'
  totalQuestions: number
  currentQuestion: {
    openQuestionId: number
    index: number
    originalQuestion: string
    status: 'in_progress' | 'acceptable' | 'needs_review'
    roundCount: number
    priorRounds: { promptText: string, answerText: string, feedback: string }[]
    currentRound: { promptText: string, studentAnswerText: string | null, gradingStatus: 'pending' | 'graded' | 'failed' }
  } | null
  summary: { index: number, promptText: string, status: 'in_progress' | 'acceptable' | 'needs_review' }[]
}

export async function getDiscussionAttemptState(setAttemptId: number): Promise<DiscussionAttemptState> {
  const [setAttempt] = await db.select().from(openQuestionSetAttempts).where(eq(openQuestionSetAttempts.id, setAttemptId)).limit(1)
  if (!setAttempt) {
    throw createError({ statusCode: 404, statusMessage: 'Attempt not found' })
  }

  const [set] = await db.select().from(openQuestionSets).where(eq(openQuestionSets.id, setAttempt.setId)).limit(1)
  if (!set) {
    throw createError({ statusCode: 404, statusMessage: 'Discussion activity not found' })
  }

  const activeQuestions = await db.select().from(openQuestions)
    .where(and(eq(openQuestions.setId, set.id), eq(openQuestions.isActive, true)))
    .orderBy(asc(openQuestions.sortOrder))

  const allAttempts = await db.select().from(openQuestionAttempts)
    .where(eq(openQuestionAttempts.setAttemptId, setAttemptId))
  const attemptByQuestionId = new Map(allAttempts.map(a => [a.openQuestionId, a]))

  const currentAttempt = allAttempts.find(a => a.status === 'in_progress') ?? null

  let currentQuestion: DiscussionAttemptState['currentQuestion'] = null
  if (currentAttempt) {
    const index = activeQuestions.findIndex(q => q.id === currentAttempt.openQuestionId)
    const question = activeQuestions[index]!

    const rounds = await db.select().from(openQuestionRounds)
      .where(eq(openQuestionRounds.attemptId, currentAttempt.id))
      .orderBy(asc(openQuestionRounds.roundIndex))
    const latestRound = rounds[rounds.length - 1]!

    currentQuestion = {
      openQuestionId: question.id,
      index,
      originalQuestion: question.promptText,
      status: currentAttempt.status,
      roundCount: currentAttempt.roundCount,
      priorRounds: rounds.slice(0, -1).map(r => ({
        promptText: r.promptText,
        answerText: r.studentAnswerText ?? '',
        feedback: r.llmFeedbackText ?? ''
      })),
      currentRound: {
        promptText: latestRound.promptText,
        studentAnswerText: latestRound.studentAnswerText,
        gradingStatus: latestRound.gradingStatus
      }
    }
  }

  return {
    setAttemptId,
    setTitle: set.title,
    passageText: set.passageText,
    status: setAttempt.status,
    totalQuestions: activeQuestions.length,
    currentQuestion,
    summary: activeQuestions.map((q, i) => ({
      index: i,
      promptText: q.promptText,
      status: attemptByQuestionId.get(q.id)?.status ?? 'in_progress'
    }))
  }
}

export interface SubmitAnswerResult extends DiscussionAttemptState {
  // questionStatus reflects what actually happened to the question (not just the raw verdict) —
  // 'needs_review' specifically means the round cap was hit, distinct from still iterating.
  lastResult: { verdict: 'acceptable' | 'needs_more_info', feedback: string, questionStatus: 'in_progress' | 'acceptable' | 'needs_review' } | null
}

export async function submitDiscussionAnswer(
  setAttemptId: number,
  answerText: string | undefined
): Promise<SubmitAnswerResult> {
  const [setAttempt] = await db.select().from(openQuestionSetAttempts).where(eq(openQuestionSetAttempts.id, setAttemptId)).limit(1)
  if (!setAttempt) {
    throw createError({ statusCode: 404, statusMessage: 'Attempt not found' })
  }
  if (setAttempt.status === 'completed') {
    throw createError({ statusCode: 409, statusMessage: 'This activity is already complete' })
  }

  const [currentAttempt] = await db.select().from(openQuestionAttempts)
    .where(and(eq(openQuestionAttempts.setAttemptId, setAttemptId), eq(openQuestionAttempts.status, 'in_progress')))
    .limit(1)
  if (!currentAttempt) {
    throw createError({ statusCode: 409, statusMessage: 'No question is currently awaiting an answer' })
  }

  const rounds = await db.select().from(openQuestionRounds)
    .where(eq(openQuestionRounds.attemptId, currentAttempt.id))
    .orderBy(asc(openQuestionRounds.roundIndex))
  const currentRound = rounds[rounds.length - 1]!

  const trimmedAnswer = answerText?.trim()
  const textToGrade = trimmedAnswer || currentRound.studentAnswerText
  if (!textToGrade) {
    throw createError({ statusCode: 400, statusMessage: 'answerText is required' })
  }

  await db.update(openQuestionRounds).set({
    studentAnswerText: textToGrade,
    answeredAt: currentRound.answeredAt ?? Date.now()
  }).where(eq(openQuestionRounds.id, currentRound.id))

  const priorRounds: PriorRound[] = rounds.slice(0, -1).map(r => ({
    promptText: r.promptText,
    answerText: r.studentAnswerText ?? '',
    feedback: r.llmFeedbackText ?? ''
  }))

  let lastResult: SubmitAnswerResult['lastResult'] = null

  try {
    const result = await gradeOpenQuestionAnswer(
      currentAttempt.openQuestionId,
      priorRounds,
      currentRound.roundIndex === 0 ? undefined : currentRound.promptText,
      textToGrade
    )

    await db.update(openQuestionRounds).set({
      gradingStatus: 'graded',
      llmVerdict: result.verdict,
      llmFeedbackText: result.feedback,
      gradedAt: Date.now()
    }).where(eq(openQuestionRounds.id, currentRound.id))

    if (result.verdict === 'acceptable') {
      await db.update(openQuestionAttempts)
        .set({ status: 'acceptable', completedAt: Date.now() })
        .where(eq(openQuestionAttempts.id, currentAttempt.id))
      await advanceToNextQuestion(setAttemptId)
      lastResult = { verdict: result.verdict, feedback: result.feedback, questionStatus: 'acceptable' }
    } else {
      const newRoundCount = currentAttempt.roundCount + 1
      if (newRoundCount >= MAX_ROUNDS) {
        await db.update(openQuestionAttempts)
          .set({ status: 'needs_review', roundCount: newRoundCount, completedAt: Date.now() })
          .where(eq(openQuestionAttempts.id, currentAttempt.id))
        await advanceToNextQuestion(setAttemptId)
        lastResult = { verdict: result.verdict, feedback: result.feedback, questionStatus: 'needs_review' }
      } else {
        await db.update(openQuestionAttempts)
          .set({ roundCount: newRoundCount })
          .where(eq(openQuestionAttempts.id, currentAttempt.id))
        await db.insert(openQuestionRounds).values({
          attemptId: currentAttempt.id,
          roundIndex: currentRound.roundIndex + 1,
          promptText: result.followUpQuestion ?? 'Can you tell me more about your answer?',
          gradingStatus: 'pending'
        })
      }
    }
  } catch (err) {
    await db.update(openQuestionRounds).set({ gradingStatus: 'failed' }).where(eq(openQuestionRounds.id, currentRound.id))

    if (err instanceof ClaudeAuthError) {
      throw createError({ statusCode: 503, statusMessage: 'Grading is temporarily unavailable — please try again shortly' })
    }
    if (err instanceof ClaudeGradingError) {
      throw createError({ statusCode: 502, statusMessage: 'Grading failed — please try again' })
    }
    throw err
  }

  const state = await getDiscussionAttemptState(setAttemptId)
  return { ...state, lastResult }
}
