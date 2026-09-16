import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { questions } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const id = Number(getRouterParam(event, 'id'))

  const [question] = await db.update(questions)
    .set({ isActive: false, updatedAt: Date.now() })
    .where(eq(questions.id, id))
    .returning()

  if (!question) {
    throw createError({ statusCode: 404, statusMessage: 'Question not found' })
  }

  return { ok: true }
})
