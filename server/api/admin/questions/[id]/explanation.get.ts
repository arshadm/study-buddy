import { getExplanationState } from '../../../../utils/question-explanations'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  return getExplanationState(Number(getRouterParam(event, 'id')))
})
