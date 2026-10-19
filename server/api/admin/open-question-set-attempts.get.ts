import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '../../database/client'
import {
  openQuestionSets,
  openQuestions,
  openQuestionSetAttempts,
  openQuestionAttempts,
  openQuestionRounds,
  users
} from '../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const query = getQuery(event)
  const setId = Number(query.setId)
  if (!setId) {
    throw createError({ statusCode: 400, statusMessage: 'setId is required' })
  }

  const [set] = await db.select().from(openQuestionSets).where(eq(openQuestionSets.id, setId)).limit(1)
  if (!set) {
    throw createError({ statusCode: 404, statusMessage: 'Question set not found' })
  }

  const questions = await db.select().from(openQuestions)
    .where(and(eq(openQuestions.setId, setId), eq(openQuestions.isActive, true)))
    .orderBy(asc(openQuestions.sortOrder))
  const questionById = new Map(questions.map(q => [q.id, q]))

  const setAttempts = await db.select({
    id: openQuestionSetAttempts.id,
    studentId: openQuestionSetAttempts.studentId,
    studentName: users.displayName,
    status: openQuestionSetAttempts.status,
    startedAt: openQuestionSetAttempts.startedAt,
    completedAt: openQuestionSetAttempts.completedAt
  }).from(openQuestionSetAttempts)
    .innerJoin(users, eq(users.id, openQuestionSetAttempts.studentId))
    .where(eq(openQuestionSetAttempts.setId, setId))

  if (setAttempts.length === 0) return []

  const questionAttempts = await db.select().from(openQuestionAttempts)
    .where(inArray(openQuestionAttempts.setAttemptId, setAttempts.map(a => a.id)))

  const roundRows = questionAttempts.length
    ? await db.select().from(openQuestionRounds)
        .where(inArray(openQuestionRounds.attemptId, questionAttempts.map(a => a.id)))
        .orderBy(asc(openQuestionRounds.roundIndex))
    : []
  const roundsByAttempt = new Map<number, typeof roundRows>()
  for (const round of roundRows) {
    if (!roundsByAttempt.has(round.attemptId)) roundsByAttempt.set(round.attemptId, [])
    roundsByAttempt.get(round.attemptId)!.push(round)
  }

  const questionAttemptsBySetAttempt = new Map<number, typeof questionAttempts>()
  for (const qa of questionAttempts) {
    if (!questionAttemptsBySetAttempt.has(qa.setAttemptId)) questionAttemptsBySetAttempt.set(qa.setAttemptId, [])
    questionAttemptsBySetAttempt.get(qa.setAttemptId)!.push(qa)
  }

  const results = setAttempts.map((attempt) => {
    const attemptQuestions = (questionAttemptsBySetAttempt.get(attempt.id) ?? [])
      .slice()
      .sort((a, b) => {
        const qa = questionById.get(a.openQuestionId)?.sortOrder ?? 0
        const qb = questionById.get(b.openQuestionId)?.sortOrder ?? 0
        return qa - qb
      })
      .map(qa => ({
        openQuestionId: qa.openQuestionId,
        promptText: questionById.get(qa.openQuestionId)?.promptText ?? '(question removed)',
        status: qa.status,
        roundCount: qa.roundCount,
        rounds: (roundsByAttempt.get(qa.id) ?? []).map(r => ({
          roundIndex: r.roundIndex,
          promptText: r.promptText,
          studentAnswerText: r.studentAnswerText,
          gradingStatus: r.gradingStatus,
          llmVerdict: r.llmVerdict,
          llmFeedbackText: r.llmFeedbackText,
          answeredAt: r.answeredAt,
          gradedAt: r.gradedAt
        }))
      }))

    const needsReviewCount = attemptQuestions.filter(q => q.status === 'needs_review').length

    return {
      setAttemptId: attempt.id,
      studentId: attempt.studentId,
      studentName: attempt.studentName,
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      needsReviewCount,
      questions: attemptQuestions
    }
  })

  return results.sort((a, b) => {
    if (a.needsReviewCount !== b.needsReviewCount) return b.needsReviewCount - a.needsReviewCount
    return b.startedAt - a.startedAt
  })
})
