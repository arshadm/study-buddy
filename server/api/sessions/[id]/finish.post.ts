import { and, eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { quizSessions } from '../../../database/schema'
import { finishSession } from '../../../utils/finish-session'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const sessionId = Number(getRouterParam(event, 'id'))

  const [session] = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.id, sessionId), eq(quizSessions.studentId, user!.id)))
    .limit(1)

  if (!session || session.status !== 'in_progress') {
    throw createError({ statusCode: 404, statusMessage: 'Session not active' })
  }

  return finishSession(sessionId)
})
