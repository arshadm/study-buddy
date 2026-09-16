import { and, eq } from 'drizzle-orm'
import { db } from '../../../../database/client'
import { quizSessions, quizSessionQuestions, questions, questionOptions } from '../../../../database/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const sessionId = Number(getRouterParam(event, 'id'))
  const sequenceIndex = Number(getRouterParam(event, 'seq'))

  const [session] = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.id, sessionId), eq(quizSessions.studentId, user!.id)))
    .limit(1)

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  if (session.status !== 'in_progress') {
    throw createError({ statusCode: 409, statusMessage: 'Session is not active' })
  }

  if (Date.now() > session.startedAt + session.timeLimitSeconds * 1000) {
    throw createError({ statusCode: 409, statusMessage: 'Session time budget has expired' })
  }

  const [current] = await db.select().from(quizSessionQuestions)
    .where(and(eq(quizSessionQuestions.quizSessionId, sessionId), eq(quizSessionQuestions.sequenceIndex, sequenceIndex)))
    .limit(1)

  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Question not found in this session' })
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
    .orderBy(questionOptions.sortOrder)

  return {
    sequenceIndex,
    imageUrl: `/uploads/${questionRow.imagePath}`,
    hintText: questionRow.hintText,
    selectedOptionId: current.selectedOptionId,
    hintUsed: current.hintUsed,
    options
  }
})
