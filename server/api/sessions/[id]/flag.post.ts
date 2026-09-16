import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { quizSessions, quizSessionQuestions } from '../../../database/schema'

const bodySchema = z.object({
  sequenceIndex: z.number().int().min(0),
  flagged: z.boolean()
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

  const [current] = await db.select().from(quizSessionQuestions)
    .where(and(
      eq(quizSessionQuestions.quizSessionId, sessionId),
      eq(quizSessionQuestions.sequenceIndex, body.sequenceIndex)
    ))
    .limit(1)

  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Question not found in this session' })
  }

  await db.update(quizSessionQuestions)
    .set({ flagged: body.flagged })
    .where(eq(quizSessionQuestions.id, current.id))

  return { ok: true }
})
