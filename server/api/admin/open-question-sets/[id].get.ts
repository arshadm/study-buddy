import { and, asc, eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { openQuestionSets, openQuestions } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'id'))

  const [set] = await db.select().from(openQuestionSets).where(eq(openQuestionSets.id, id)).limit(1)
  if (!set) {
    throw createError({ statusCode: 404, statusMessage: 'Question set not found' })
  }

  const questionRows = await db.select().from(openQuestions)
    .where(and(eq(openQuestions.setId, id), eq(openQuestions.isActive, true)))
    .orderBy(asc(openQuestions.sortOrder))

  return { ...set, questions: questionRows }
})
