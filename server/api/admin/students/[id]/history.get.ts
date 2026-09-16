import { getSessionHistory } from '../../../../utils/history'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const id = Number(getRouterParam(event, 'id'))
  const query = getQuery(event)
  const subjectId = query.subjectId ? Number(query.subjectId) : undefined

  return getSessionHistory(id, subjectId)
})
