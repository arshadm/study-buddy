import { eq, and, isNull, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { quizSessions, quizSessionQuestions } from '../database/schema'
import { effectivePercentSql } from './scoring'

export async function finishSession(sessionId: number) {
  // isCorrect is the canonical "answered" signal for every question type — set on MCQ
  // selection, and only on the self-marked verdict (not merely on uploading a photo).
  await db.update(quizSessionQuestions)
    .set({ isCorrect: false })
    .where(and(
      eq(quizSessionQuestions.quizSessionId, sessionId),
      isNull(quizSessionQuestions.isCorrect)
    ))

  const [totals] = await db.select({
    // Fractional — a self-marked question's partial-credit score contributes e.g. 0.75.
    correct: sql<number>`SUM(${sql.raw(effectivePercentSql())}) / 100.0`,
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
