import { and, eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { quizSessions, quizSessionQuestions, questions } from '../../../database/schema'
import { parseMultipartForm } from '../../../utils/multipart'
import { saveQuestionImage, deleteQuestionImage } from '../../../utils/uploads'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const sessionId = Number(getRouterParam(event, 'id'))

  const [session] = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.id, sessionId), eq(quizSessions.studentId, user!.id)))
    .limit(1)

  if (!session || session.status !== 'in_progress') {
    throw createError({ statusCode: 404, statusMessage: 'Session not active' })
  }

  if (Date.now() > session.startedAt + session.timeLimitSeconds * 1000) {
    throw createError({ statusCode: 409, statusMessage: 'Session time budget has expired' })
  }

  const { fields, files } = await parseMultipartForm(event)
  const sequenceIndex = Number(fields.sequenceIndex)

  const [current] = await db.select().from(quizSessionQuestions)
    .where(and(eq(quizSessionQuestions.quizSessionId, sessionId), eq(quizSessionQuestions.sequenceIndex, sequenceIndex)))
    .limit(1)

  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Question not found in this session' })
  }

  const [question] = await db.select().from(questions).where(eq(questions.id, current.questionId)).limit(1)
  if (!question || question.type !== 'self_marked_image') {
    throw createError({ statusCode: 400, statusMessage: 'This question is not a self-marked image question' })
  }

  if (!files.answerImage) {
    throw createError({ statusCode: 400, statusMessage: 'An answer image is required' })
  }

  const newPath = await saveQuestionImage(files.answerImage)

  await db.update(quizSessionQuestions)
    .set({ submittedAnswerImagePath: newPath })
    .where(eq(quizSessionQuestions.id, current.id))

  if (current.submittedAnswerImagePath) {
    await deleteQuestionImage(current.submittedAnswerImagePath)
  }

  return {
    submittedAnswerImageUrl: `/uploads/${newPath}`,
    workedSolutionImageUrl: question.workedSolutionImagePath ? `/uploads/${question.workedSolutionImagePath}` : null
  }
})
