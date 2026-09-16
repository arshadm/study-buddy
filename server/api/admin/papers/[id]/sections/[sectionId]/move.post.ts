import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../../../../database/client'
import { paperSections } from '../../../../../../database/schema'

const bodySchema = z.object({
  direction: z.enum(['up', 'down'])
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const paperId = Number(getRouterParam(event, 'id'))
  const sectionId = Number(getRouterParam(event, 'sectionId'))
  const { direction } = await readValidatedBody(event, bodySchema.parse)

  const [section] = await db.select().from(paperSections)
    .where(and(eq(paperSections.id, sectionId), eq(paperSections.paperId, paperId)))
    .limit(1)

  if (!section) {
    throw createError({ statusCode: 404, statusMessage: 'Section not found' })
  }

  const targetOrder = direction === 'up' ? section.sortOrder - 1 : section.sortOrder + 1

  const [neighbor] = await db.select().from(paperSections)
    .where(and(eq(paperSections.paperId, paperId), eq(paperSections.sortOrder, targetOrder)))
    .limit(1)

  if (!neighbor) {
    return { ok: true }
  }

  // Swap via a temporary out-of-range value to avoid a transient unique-index collision.
  await db.update(paperSections).set({ sortOrder: -1 }).where(eq(paperSections.id, section.id))
  await db.update(paperSections).set({ sortOrder: section.sortOrder }).where(eq(paperSections.id, neighbor.id))
  await db.update(paperSections).set({ sortOrder: targetOrder }).where(eq(paperSections.id, section.id))

  return { ok: true }
})
