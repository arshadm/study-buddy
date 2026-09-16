import { eq, and, isNull, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { quizSessions, quizSessionQuestions } from '../database/schema'

export async function finishSession(sessionId: number) {
  await db.update(quizSessionQuestions)
    .set({ isCorrect: false })
    .where(and(eq(quizSessionQuestions.quizSessionId, sessionId), isNull(quizSessionQuestions.selectedOptionId)))

  const [totals] = await db.select({
    correct: sql<number>`SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END)`,
    total: sql<number>`COUNT(*)`
  })
    .from(quizSessionQuestions)
    .where(eq(quizSessionQuestions.quizSessionId, sessionId))

  const [updated] = await db.update(quizSessions)
    .set({
      status: 'completed',
      finishedAt: Date.now(),
      scoreCorrect: totals?.correct ?? 0,
      scoreTotal: totals?.total ?? 0
    })
    .where(eq(quizSessions.id, sessionId))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  return updated
}
