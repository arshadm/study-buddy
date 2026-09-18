import { and, asc, eq } from 'drizzle-orm'
import { db } from '../../../../database/client'
import { quizSessions, quizSessionQuestions } from '../../../../database/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const sessionId = Number(getRouterParam(event, 'id'))

  const [session] = await db.select({ id: quizSessions.id }).from(quizSessions)
    .where(and(eq(quizSessions.id, sessionId), eq(quizSessions.studentId, user!.id)))
    .limit(1)

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  const rows = await db.select({
    sequenceIndex: quizSessionQuestions.sequenceIndex,
    isCorrect: quizSessionQuestions.isCorrect,
    flagged: quizSessionQuestions.flagged
  }).from(quizSessionQuestions)
    .where(eq(quizSessionQuestions.quizSessionId, sessionId))
    .orderBy(asc(quizSessionQuestions.sequenceIndex))

  return rows.map(r => ({
    sequenceIndex: r.sequenceIndex,
    answered: r.isCorrect !== null,
    flagged: r.flagged
  }))
})
