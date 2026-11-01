import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../../../database/client'
import { subjectTags } from '../../../../../database/schema'
import { findTagByName, MAX_TAG_LENGTH, normalizeTagName } from '../../../../../utils/subject-tags'

const bodySchema = z.object({ name: z.string() })

// Rename. Questions reference the tag by id, so they pick up the new name automatically.
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const subjectId = Number(getRouterParam(event, 'id'))
  const tagId = Number(getRouterParam(event, 'tagId'))
  const name = normalizeTagName((await readValidatedBody(event, bodySchema.parse)).name)

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Tag name is required' })
  if (name.length > MAX_TAG_LENGTH) throw createError({ statusCode: 400, statusMessage: `Tag names can be at most ${MAX_TAG_LENGTH} characters` })

  if (await findTagByName(subjectId, name, tagId)) {
    throw createError({ statusCode: 409, statusMessage: `This subject already has a tag named "${name}"` })
  }

  const [tag] = await db.update(subjectTags).set({ name })
    .where(and(eq(subjectTags.id, tagId), eq(subjectTags.subjectId, subjectId)))
    .returning()
  if (!tag) throw createError({ statusCode: 404, statusMessage: 'Tag not found' })
  return tag
})
