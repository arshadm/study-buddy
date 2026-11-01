import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../../../../database/client'
import { subjects, subjectTags } from '../../../../../database/schema'
import { findTagByName, MAX_TAG_LENGTH, normalizeTagName } from '../../../../../utils/subject-tags'

const bodySchema = z.object({ name: z.string() })

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const subjectId = Number(getRouterParam(event, 'id'))
  const name = normalizeTagName((await readValidatedBody(event, bodySchema.parse)).name)

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Tag name is required' })
  if (name.length > MAX_TAG_LENGTH) throw createError({ statusCode: 400, statusMessage: `Tag names can be at most ${MAX_TAG_LENGTH} characters` })

  const [subject] = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.id, subjectId)).limit(1)
  if (!subject) throw createError({ statusCode: 404, statusMessage: 'Subject not found' })

  if (await findTagByName(subjectId, name)) {
    throw createError({ statusCode: 409, statusMessage: `This subject already has a tag named "${name}"` })
  }

  const [tag] = await db.insert(subjectTags).values({ subjectId, name, createdAt: Date.now() }).returning()
  return tag
})
