import { and, eq } from 'drizzle-orm'
import { db } from '../../../../../../database/client'
import { quizSessions } from '../../../../../../database/schema'
import { getSessionReview } from '../../../../../../utils/session-review'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const studentId = Number(getRouterParam(event, 'id'))
  const sessionId = Number(getRouterParam(event, 'sessionId'))

  const [session] = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.id, sessionId), eq(quizSessions.studentId, studentId)))
    .limit(1)

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  return getSessionReview(session)
})
