import { and, eq } from 'drizzle-orm'
import { db } from '../../../../../database/client'
import { sections } from '../../../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const subjectId = Number(getRouterParam(event, 'id'))
  const sectionId = Number(getRouterParam(event, 'sectionId'))

  const [section] = await db.delete(sections)
    .where(and(eq(sections.id, sectionId), eq(sections.subjectId, subjectId)))
    .returning()

  if (!section) {
    throw createError({ statusCode: 404, statusMessage: 'Section not found' })
  }

  return { ok: true }
})
