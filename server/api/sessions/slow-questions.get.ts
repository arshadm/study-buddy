import { getSlowQuestions } from '../../utils/slow-questions'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const query = getQuery(event)
  const subjectId = query.subjectId ? Number(query.subjectId) : undefined

  return getSlowQuestions(user!.id, subjectId)
})
