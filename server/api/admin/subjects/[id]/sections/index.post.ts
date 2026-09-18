import { z } from 'zod'
import { db } from '../../../../../database/client'
import { sections } from '../../../../../database/schema'

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional()
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const subjectId = Number(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, bodySchema.parse)
  const now = Date.now()

  try {
    const [section] = await db.insert(sections).values({
      subjectId,
      name: body.name,
      description: body.description || null,
      createdAt: now,
      updatedAt: now
    }).returning()

    return section
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      throw createError({ statusCode: 409, statusMessage: 'A section with this name already exists for this subject' })
    }
    throw err
  }
})
