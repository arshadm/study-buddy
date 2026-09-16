import { advancePaperAttempt } from '../../../utils/paper-advance'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const id = Number(getRouterParam(event, 'id'))

  return advancePaperAttempt(id, user!.id)
})
