import { startOrResumeSetAttempt } from '../../../utils/discussion-attempts'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const setId = Number(getRouterParam(event, 'setId'))

  const attemptId = await startOrResumeSetAttempt(setId, user!.id)
  return { attemptId }
})
