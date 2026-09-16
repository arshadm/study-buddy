import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { papers } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'id'))

  const [paper] = await db.update(papers)
    .set({ isActive: false, updatedAt: Date.now() })
    .where(eq(papers.id, id))
    .returning()

  if (!paper) {
    throw createError({ statusCode: 404, statusMessage: 'Paper not found' })
  }

  return { ok: true }
})
