import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { subjects } from '../../../database/schema'

const bodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  defaultQuestionCount: z.number().int().min(1).max(200).optional(),
  defaultTimeLimitSeconds: z.number().int().min(30).max(24 * 60 * 60).optional(),
  isActive: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const id = Number(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, bodySchema.parse)

  const [subject] = await db.update(subjects)
    .set({ ...body, updatedAt: Date.now() })
    .where(eq(subjects.id, id))
    .returning()

  if (!subject) {
    throw createError({ statusCode: 404, statusMessage: 'Subject not found' })
  }

  return subject
})
