import { getSessionHistory } from '../../utils/history'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const query = getQuery(event)
  const subjectId = query.subjectId ? Number(query.subjectId) : undefined

  return getSessionHistory(user!.id, subjectId)
})
