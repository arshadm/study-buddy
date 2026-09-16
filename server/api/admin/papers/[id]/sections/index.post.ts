import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../../../../database/client'
import { paperSections } from '../../../../../database/schema'

const bodySchema = z.object({
  subjectId: z.number().int(),
  questionCount: z.number().int().min(1).max(200),
  timeLimitSeconds: z.number().int().min(30).max(24 * 60 * 60)
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const paperId = Number(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, bodySchema.parse)

  const sortOrder = await db.$count(paperSections, eq(paperSections.paperId, paperId))

  const [section] = await db.insert(paperSections).values({
    paperId,
    subjectId: body.subjectId,
    questionCount: body.questionCount,
    timeLimitSeconds: body.timeLimitSeconds,
    sortOrder
  }).returning()

  return section
})
