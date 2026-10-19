import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '../../../database/client'
import { openQuestionSets, openQuestions, openQuestionSetAttempts, openQuestionAttempts } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const query = getQuery(event)
  const subjectId = query.subjectId ? Number(query.subjectId) : undefined
  const sectionId = query.sectionId ? Number(query.sectionId) : undefined

  const conditions = [eq(openQuestionSets.isActive, true)]
  if (subjectId) conditions.push(eq(openQuestionSets.subjectId, subjectId))
  if (sectionId) conditions.push(eq(openQuestionSets.sectionId, sectionId))

  const setRows = await db.select().from(openQuestionSets)
    .where(and(...conditions))
    .orderBy(asc(openQuestionSets.createdAt))

  if (setRows.length === 0) return []

  const questionRows = await db.select().from(openQuestions)
    .where(and(inArray(openQuestions.setId, setRows.map(s => s.id)), eq(openQuestions.isActive, true)))
    .orderBy(asc(openQuestions.sortOrder))

  const questionsBySet = new Map<number, typeof questionRows>()
  for (const q of questionRows) {
    if (!questionsBySet.has(q.setId)) questionsBySet.set(q.setId, [])
    questionsBySet.get(q.setId)!.push(q)
  }

  const needsReviewRows = await db.select({
    setId: openQuestionSetAttempts.setId
  }).from(openQuestionAttempts)
    .innerJoin(openQuestionSetAttempts, eq(openQuestionSetAttempts.id, openQuestionAttempts.setAttemptId))
    .where(and(inArray(openQuestionSetAttempts.setId, setRows.map(s => s.id)), eq(openQuestionAttempts.status, 'needs_review')))

  const needsReviewCountBySet = new Map<number, number>()
  for (const row of needsReviewRows) {
    needsReviewCountBySet.set(row.setId, (needsReviewCountBySet.get(row.setId) ?? 0) + 1)
  }

  return setRows.map(s => ({
    ...s,
    questions: questionsBySet.get(s.id) || [],
    needsReviewCount: needsReviewCountBySet.get(s.id) ?? 0
  }))
})
