import { asc, and, eq } from 'drizzle-orm'
import { db } from '../../../../../database/client'
import { paperSections } from '../../../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const paperId = Number(getRouterParam(event, 'id'))
  const sectionId = Number(getRouterParam(event, 'sectionId'))

  const [section] = await db.select().from(paperSections)
    .where(and(eq(paperSections.id, sectionId), eq(paperSections.paperId, paperId)))
    .limit(1)

  if (!section) {
    throw createError({ statusCode: 404, statusMessage: 'Section not found' })
  }

  await db.delete(paperSections).where(eq(paperSections.id, sectionId))

  // Re-sequence the remaining sections to a contiguous 0..N-1 sortOrder, since
  // section index is used directly to key paper attempts' progress.
  const remaining = await db.select().from(paperSections)
    .where(eq(paperSections.paperId, paperId))
    .orderBy(asc(paperSections.sortOrder))

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i]!.sortOrder !== i) {
      await db.update(paperSections).set({ sortOrder: i }).where(eq(paperSections.id, remaining[i]!.id))
    }
  }

  return { ok: true }
})
