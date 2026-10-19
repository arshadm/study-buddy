import { z } from 'zod'
import { gradeOpenQuestionAnswer } from '../../utils/open-question-grading'
import { ClaudeAuthError, ClaudeGradingError } from '../../utils/claude-cli'

const bodySchema = z.object({
  openQuestionId: z.number().int(),
  answerText: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const body = await readValidatedBody(event, bodySchema.parse)

  try {
    return await gradeOpenQuestionAnswer(body.openQuestionId, [], undefined, body.answerText)
  } catch (err) {
    if (err instanceof ClaudeAuthError) {
      throw createError({ statusCode: 503, statusMessage: 'Claude CLI needs re-authentication — see the banner on the admin dashboard' })
    }
    if (err instanceof ClaudeGradingError) {
      throw createError({ statusCode: 502, statusMessage: err.message })
    }
    throw err
  }
})
