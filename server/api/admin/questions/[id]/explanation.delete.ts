import { deleteExplanation } from '../../../../utils/question-explanations'

// Removes the saved explanation; the next student to ask gets a fresh one.
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  await deleteExplanation(Number(getRouterParam(event, 'id')))
  return { ok: true }
})
