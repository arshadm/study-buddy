import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../../../database/client'
import { sections } from '../../../../../database/schema'

const bodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional()
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const subjectId = Number(getRouterParam(event, 'id'))
  const sectionId = Number(getRouterParam(event, 'sectionId'))
  const body = await readValidatedBody(event, bodySchema.parse)

  try {
    const [section] = await db.update(sections)
      .set({ ...body, updatedAt: Date.now() })
      .where(and(eq(sections.id, sectionId), eq(sections.subjectId, subjectId)))
      .returning()

    if (!section) {
      throw createError({ statusCode: 404, statusMessage: 'Section not found' })
    }

    return section
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      throw createError({ statusCode: 409, statusMessage: 'A section with this name already exists for this subject' })
    }
    throw err
  }
})
