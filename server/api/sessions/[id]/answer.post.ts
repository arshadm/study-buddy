import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { quizSessions, quizSessionQuestions, questionOptions } from '../../../database/schema'

const bodySchema = z.object({
  sequenceIndex: z.number().int().min(0),
  selectedOptionId: z.number().int(),
  hintUsed: z.boolean().default(false),
  clientElapsedMs: z.number().int().min(0)
})

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const sessionId = Number(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, bodySchema.parse)

  const [session] = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.id, sessionId), eq(quizSessions.studentId, user!.id)))
    .limit(1)

  if (!session || session.status !== 'in_progress') {
    throw createError({ statusCode: 404, statusMessage: 'Session not active' })
  }

  if (Date.now() > session.startedAt + session.timeLimitSeconds * 1000) {
    throw createError({ statusCode: 409, statusMessage: 'Session time budget has expired' })
  }

  const [current] = await db.select().from(quizSessionQuestions)
    .where(and(
      eq(quizSessionQuestions.quizSessionId, sessionId),
      eq(quizSessionQuestions.sequenceIndex, body.sequenceIndex)
    ))
    .limit(1)

  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Question not found in this session' })
  }

  const [option] = await db.select().from(questionOptions)
    .where(and(eq(questionOptions.id, body.selectedOptionId), eq(questionOptions.questionId, current.questionId)))
    .limit(1)

  if (!option) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid option for this question' })
  }

  const now = Date.now()
  const serverElapsedMs = current.presentedAt ? now - current.presentedAt : body.clientElapsedMs
  const timeSpentMs = Math.min(body.clientElapsedMs, serverElapsedMs)

  await db.update(quizSessionQuestions).set({
    selectedOptionId: option.id,
    isCorrect: option.isCorrect,
    hintUsed: body.hintUsed,
    timeSpentMs: Math.max(0, timeSpentMs),
    answeredAt: now
  }).where(eq(quizSessionQuestions.id, current.id))

  return { ok: true }
})
