import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../../../database/client'
import { paperSections } from '../../../../../database/schema'

const bodySchema = z.object({
  subjectId: z.number().int().optional(),
  questionCount: z.number().int().min(1).max(200).optional(),
  timeLimitSeconds: z.number().int().min(30).max(24 * 60 * 60).optional()
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const paperId = Number(getRouterParam(event, 'id'))
  const sectionId = Number(getRouterParam(event, 'sectionId'))
  const body = await readValidatedBody(event, bodySchema.parse)

  const [section] = await db.update(paperSections)
    .set(body)
    .where(and(eq(paperSections.id, sectionId), eq(paperSections.paperId, paperId)))
    .returning()

  if (!section) {
    throw createError({ statusCode: 404, statusMessage: 'Section not found' })
  }

  return section
})
