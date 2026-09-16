import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { papers } from '../../../database/schema'

const bodySchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, bodySchema.parse)

  const [paper] = await db.update(papers)
    .set({ ...body, updatedAt: Date.now() })
    .where(eq(papers.id, id))
    .returning()

  if (!paper) {
    throw createError({ statusCode: 404, statusMessage: 'Paper not found' })
  }

  return paper
})
