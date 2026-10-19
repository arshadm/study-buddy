import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '../../database/client'
import { openQuestionSets, openQuestions, openQuestionSetAttempts, subjects } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')

  const sets = await db.select({
    id: openQuestionSets.id,
    title: openQuestionSets.title,
    subjectId: openQuestionSets.subjectId
  }).from(openQuestionSets)
    .where(eq(openQuestionSets.isActive, true))
    .orderBy(asc(openQuestionSets.createdAt))

  if (sets.length === 0) return []

  const setIds = sets.map(s => s.id)

  const subjectRows = await db.select().from(subjects).where(inArray(subjects.id, [...new Set(sets.map(s => s.subjectId))]))
  const subjectNameById = new Map(subjectRows.map(s => [s.id, s.name]))

  const questionRows = await db.select({ setId: openQuestions.setId }).from(openQuestions)
    .where(and(inArray(openQuestions.setId, setIds), eq(openQuestions.isActive, true)))
  const questionCountBySet = new Map<number, number>()
  for (const q of questionRows) {
    questionCountBySet.set(q.setId, (questionCountBySet.get(q.setId) ?? 0) + 1)
  }

  const attempts = await db.select().from(openQuestionSetAttempts)
    .where(and(inArray(openQuestionSetAttempts.setId, setIds), eq(openQuestionSetAttempts.studentId, user!.id)))
  const attemptBySet = new Map(attempts.map(a => [a.setId, a]))

  return sets.map(s => ({
    id: s.id,
    title: s.title,
    subjectName: subjectNameById.get(s.subjectId) ?? '',
    questionCount: questionCountBySet.get(s.id) ?? 0,
    status: attemptBySet.get(s.id)?.status ?? null,
    attemptId: attemptBySet.get(s.id)?.id ?? null
  }))
})
