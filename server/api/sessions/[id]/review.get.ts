import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '../../../database/client'
import { quizSessions, quizSessionQuestions, questions, questionOptions, subjects } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const sessionId = Number(getRouterParam(event, 'id'))

  const [session] = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.id, sessionId), eq(quizSessions.studentId, user!.id)))
    .limit(1)

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  const sessionQuestions = await db.select().from(quizSessionQuestions)
    .where(eq(quizSessionQuestions.quizSessionId, sessionId))
    .orderBy(asc(quizSessionQuestions.sequenceIndex))

  const questionIds = sessionQuestions.map(sq => sq.questionId)
  const subjectIds = [...new Set(sessionQuestions.map(sq => sq.subjectId))]

  const questionRows = questionIds.length
    ? await db.select().from(questions).where(inArray(questions.id, questionIds))
    : []
  const optionRows = questionIds.length
    ? await db.select().from(questionOptions).where(inArray(questionOptions.questionId, questionIds))
    : []
  const subjectRows = subjectIds.length
    ? await db.select().from(subjects).where(inArray(subjects.id, subjectIds))
    : []

  const questionsById = new Map(questionRows.map(q => [q.id, q]))
  const subjectsById = new Map(subjectRows.map(s => [s.id, s]))
  const optionsByQuestion = new Map<number, typeof optionRows>()
  for (const opt of optionRows) {
    if (!optionsByQuestion.has(opt.questionId)) optionsByQuestion.set(opt.questionId, [])
    optionsByQuestion.get(opt.questionId)!.push(opt)
  }

  const items = sessionQuestions.map((sq) => {
    const question = questionsById.get(sq.questionId)!
    const options = (optionsByQuestion.get(sq.questionId) || []).sort((a, b) => a.sortOrder - b.sortOrder)
    return {
      sequenceIndex: sq.sequenceIndex,
      subjectName: subjectsById.get(sq.subjectId)?.name,
      imageUrl: `/uploads/${question.imagePath}`,
      workedSolutionImageUrl: question.workedSolutionImagePath ? `/uploads/${question.workedSolutionImagePath}` : null,
      hintText: question.hintText,
      hintUsed: sq.hintUsed,
      flagged: sq.flagged,
      timeSpentMs: sq.timeSpentMs,
      isCorrect: sq.isCorrect,
      type: question.type,
      optionFormat: question.optionFormat,
      selectedOptionId: sq.selectedOptionId,
      submittedAnswerText: sq.submittedAnswerText,
      correctAnswerText: question.type === 'multiple_choice' && question.optionFormat === 'image' ? question.correctAnswerText : null,
      submittedAnswerImageUrl: sq.submittedAnswerImagePath ? `/uploads/${sq.submittedAnswerImagePath}` : null,
      options: options.map(o => ({
        id: o.id,
        optionText: o.optionText,
        optionImageUrl: o.optionImagePath ? `/uploads/${o.optionImagePath}` : null,
        isCorrect: o.isCorrect
      }))
    }
  })

  return { session, items }
})
