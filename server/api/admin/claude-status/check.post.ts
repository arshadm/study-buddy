import { checkAuthStatusLive, ClaudeGradingError } from '../../../utils/claude-cli'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  try {
    return await checkAuthStatusLive()
  } catch (err) {
    if (err instanceof ClaudeGradingError) {
      throw createError({ statusCode: 502, statusMessage: err.message })
    }
    throw err
  }
})
