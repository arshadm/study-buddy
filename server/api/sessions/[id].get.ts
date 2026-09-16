import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '../../database/client'
import { quizSessions, quizSessionQuestions } from '../../database/schema'
import { finishSession } from '../../utils/finish-session'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const id = Number(getRouterParam(event, 'id'))

  const [session] = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.id, id), eq(quizSessions.studentId, user!.id)))
    .limit(1)

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  const totalQuestions = await db.$count(quizSessionQuestions, eq(quizSessionQuestions.quizSessionId, id))

  if (session.status === 'in_progress' && Date.now() > session.startedAt + session.timeLimitSeconds * 1000) {
    const finished = await finishSession(session.id)
    return { session: finished, remainingMs: 0, totalQuestions, firstUnansweredIndex: null }
  }

  const remainingMs = session.status === 'in_progress'
    ? Math.max(0, session.startedAt + session.timeLimitSeconds * 1000 - Date.now())
    : 0

  const [firstUnanswered] = await db.select({ sequenceIndex: quizSessionQuestions.sequenceIndex })
    .from(quizSessionQuestions)
    .where(and(eq(quizSessionQuestions.quizSessionId, id), isNull(quizSessionQuestions.selectedOptionId)))
    .orderBy(asc(quizSessionQuestions.sequenceIndex))
    .limit(1)

  return {
    session,
    remainingMs,
    totalQuestions,
    firstUnansweredIndex: firstUnanswered?.sequenceIndex ?? null
  }
})
