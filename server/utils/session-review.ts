import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '../database/client'
import { quizSessionQuestions, questions, questionOptions, subjects, sections } from '../database/schema'
import type { quizSessions } from '../database/schema'

export async function getSessionReview(session: typeof quizSessions.$inferSelect) {
  const sessionQuestions = await db.select().from(quizSessionQuestions)
    .where(eq(quizSessionQuestions.quizSessionId, session.id))
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
  const sectionIds = [...new Set(questionRows.map(q => q.sectionId).filter((id): id is number => id !== null))]
  const sectionRows = sectionIds.length
    ? await db.select().from(sections).where(inArray(sections.id, sectionIds))
    : []

  const questionsById = new Map(questionRows.map(q => [q.id, q]))
  const subjectsById = new Map(subjectRows.map(s => [s.id, s]))
  const sectionsById = new Map(sectionRows.map(s => [s.id, s]))
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
      sectionName: question.sectionId !== null ? (sectionsById.get(question.sectionId)?.name ?? null) : null,
      imageUrl: `/uploads/${question.imagePath}`,
      workedSolutionImageUrl: question.workedSolutionImagePath ? `/uploads/${question.workedSolutionImagePath}` : null,
      hintText: question.hintText,
      hintUsed: sq.hintUsed,
      flagged: sq.flagged,
      timeSpentMs: sq.timeSpentMs,
      isCorrect: sq.isCorrect,
      selfMarkScorePercent: sq.selfMarkScorePercent,
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
}
