import { getSlowQuestions } from '../../../../utils/slow-questions'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'id'))
  const query = getQuery(event)
  const subjectId = query.subjectId ? Number(query.subjectId) : undefined

  return getSlowQuestions(id, subjectId)
})
