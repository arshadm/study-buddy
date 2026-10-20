import { z } from 'zod'
import { db } from '../../../database/client'
import { subjects } from '../../../database/schema'

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  defaultQuestionCount: z.number().int().min(1).max(200),
  defaultTimeLimitSeconds: z.number().int().min(30).max(24 * 60 * 60)
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const body = await readValidatedBody(event, bodySchema.parse)
  const now = Date.now()

  const [subject] = await db.insert(subjects).values({
    ...body,
    // New subjects start hidden from students (a "draft") until the admin explicitly publishes
    // them — avoids a half-built subject with no questions showing up on the student start page.
    isActive: false,
    createdAt: now,
    updatedAt: now
  }).returning()

  return subject
})
