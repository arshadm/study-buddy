import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../../database/client'
import { questions, questionOptions } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const query = getQuery(event)
  const subjectId = query.subjectId ? Number(query.subjectId) : undefined

  const conditions = [eq(questions.isActive, true)]
  if (subjectId) conditions.push(eq(questions.subjectId, subjectId))

  const questionRows = await db.select().from(questions)
    .where(and(...conditions))
    .orderBy(questions.createdAt)

  if (questionRows.length === 0) return []

  const optionRows = await db.select().from(questionOptions)
    .where(inArray(questionOptions.questionId, questionRows.map(q => q.id)))
    .orderBy(questionOptions.sortOrder)

  const optionsByQuestion = new Map<number, typeof optionRows>()
  for (const option of optionRows) {
    if (!optionsByQuestion.has(option.questionId)) optionsByQuestion.set(option.questionId, [])
    optionsByQuestion.get(option.questionId)!.push(option)
  }

  return questionRows.map(q => ({ ...q, options: optionsByQuestion.get(q.id) || [] }))
})
