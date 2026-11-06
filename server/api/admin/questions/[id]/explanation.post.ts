import { requestExplanation } from '../../../../utils/question-explanations'

// Generates (or regenerates, replacing the saved one) Claude's explanation for this question.
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  return requestExplanation(Number(getRouterParam(event, 'id')), { force: true })
})
