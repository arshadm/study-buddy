import { z } from 'zod'
import { db } from '../../../database/client'
import { papers } from '../../../database/schema'

const bodySchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(500).optional()
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const body = await readValidatedBody(event, bodySchema.parse)
  const now = Date.now()

  const [paper] = await db.insert(papers).values({
    name: body.name,
    description: body.description || null,
    createdAt: now,
    updatedAt: now
  }).returning()

  return paper
})
