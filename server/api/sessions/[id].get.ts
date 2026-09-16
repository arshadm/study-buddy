import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '../../database/client'
import { quizSessions, quizSessionQuestions, questions, questionOptions } from '../../database/schema'
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
    return { session: finished, question: null, remainingMs: 0, totalQuestions }
  }

  const [current] = await db.select().from(quizSessionQuestions)
    .where(and(eq(quizSessionQuestions.quizSessionId, id), isNull(quizSessionQuestions.selectedOptionId)))
    .orderBy(asc(quizSessionQuestions.sequenceIndex))
    .limit(1)

  const remainingMs = Math.max(0, session.startedAt + session.timeLimitSeconds * 1000 - Date.now())

  if (session.status !== 'in_progress' || !current) {
    return { session, question: null, remainingMs, totalQuestions }
  }

  if (!current.presentedAt) {
    await db.update(quizSessionQuestions)
      .set({ presentedAt: Date.now() })
      .where(eq(quizSessionQuestions.id, current.id))
  }

  const [questionRow] = await db.select().from(questions).where(eq(questions.id, current.questionId)).limit(1)
  if (!questionRow) {
    throw createError({ statusCode: 500, statusMessage: 'Question data missing' })
  }
  const options = await db.select({
    id: questionOptions.id,
    optionText: questionOptions.optionText,
    sortOrder: questionOptions.sortOrder
  }).from(questionOptions)
    .where(eq(questionOptions.questionId, current.questionId))
    .orderBy(asc(questionOptions.sortOrder))

  return {
    session,
    remainingMs,
    totalQuestions,
    question: {
      sequenceIndex: current.sequenceIndex,
      imageUrl: `/uploads/${questionRow.imagePath}`,
      hintText: questionRow.hintText,
      options
    }
  }
})
