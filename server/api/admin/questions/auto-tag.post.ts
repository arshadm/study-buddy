import { z } from 'zod'
import { queueAutoTagging } from '../../../utils/tag-suggestions'

// (Re)queues questions for background tag suggestion — used by the section page's retry button.
const bodySchema = z.object({ questionIds: z.array(z.number().int()).min(1).max(500) })

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const { questionIds } = await readValidatedBody(event, bodySchema.parse)
  await queueAutoTagging(questionIds)
  return { queued: questionIds.length }
})
