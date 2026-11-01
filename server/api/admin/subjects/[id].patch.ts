import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { subjects } from '../../../database/schema'
import { getCategory } from '../../../utils/categories'

const bodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  gradingInstructions: z.string().max(5000).nullable().optional(),
  isActive: z.boolean().optional(),
  categoryId: z.number().int().nullable().optional()
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const id = Number(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, bodySchema.parse)
  if (body.categoryId != null && !(await getCategory(body.categoryId))) {
    throw createError({ statusCode: 400, statusMessage: 'Category not found' })
  }

  const [subject] = await db.update(subjects)
    .set({ ...body, updatedAt: Date.now() })
    .where(eq(subjects.id, id))
    .returning()

  if (!subject) {
    throw createError({ statusCode: 404, statusMessage: 'Subject not found' })
  }

  return subject
})
