import { and, eq } from 'drizzle-orm'
import { db } from '../../../../../database/client'
import { subjectTags } from '../../../../../database/schema'

// Removing a tag also removes it from every question that had it (question_tags cascades).
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const subjectId = Number(getRouterParam(event, 'id'))
  const tagId = Number(getRouterParam(event, 'tagId'))

  const [deleted] = await db.delete(subjectTags)
    .where(and(eq(subjectTags.id, tagId), eq(subjectTags.subjectId, subjectId)))
    .returning({ id: subjectTags.id })
  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Tag not found' })
  return { ok: true }
})
