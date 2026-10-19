import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { openQuestionSets } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'id'))

  const [set] = await db.update(openQuestionSets)
    .set({ isActive: false, updatedAt: Date.now() })
    .where(eq(openQuestionSets.id, id))
    .returning()

  if (!set) {
    throw createError({ statusCode: 404, statusMessage: 'Question set not found' })
  }

  return { ok: true }
})
