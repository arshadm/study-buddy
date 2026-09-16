import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { questions, questionOptions } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const id = Number(getRouterParam(event, 'id'))

  const [question] = await db.select().from(questions).where(eq(questions.id, id)).limit(1)
  if (!question) {
    throw createError({ statusCode: 404, statusMessage: 'Question not found' })
  }

  const options = await db.select().from(questionOptions)
    .where(eq(questionOptions.questionId, id))
    .orderBy(questionOptions.sortOrder)

  return { ...question, options }
})
