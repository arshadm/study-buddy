import { and, eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { quizSessions } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const sessionId = Number(getRouterParam(event, 'id'))

  const [session] = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.id, sessionId), eq(quizSessions.studentId, user!.id)))
    .limit(1)

  if (!session || session.status !== 'in_progress') {
    throw createError({ statusCode: 404, statusMessage: 'Session not active' })
  }

  // A mock-paper section abandons through the paper flow, not directly — doing it here
  // would leave the paper attempt itself stuck mid-way with no way to continue or resolve it.
  if (session.paperAttemptId !== null) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot abandon a mock-paper section directly' })
  }

  await db.update(quizSessions)
    .set({ status: 'abandoned', finishedAt: Date.now() })
    .where(eq(quizSessions.id, sessionId))

  return { ok: true }
})
