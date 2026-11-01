import { getEligibleQuestionIds, getEligibleQuestionTags } from '../../../utils/question-pool'
import { assertSubjectsAssigned } from '../../../utils/student-subjects'

// Start-page tag filter for one subject: its tags that have at least one available question,
// with the question ids each covers, plus the subject's total available question count.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const subjectId = Number(getRouterParam(event, 'id'))
  if (!subjectId) throw createError({ statusCode: 400, statusMessage: 'Invalid subject' })
  if (user.role !== 'admin') await assertSubjectsAssigned(user.id, [subjectId])

  const eligible = await getEligibleQuestionIds(subjectId)
  return { totalQuestions: eligible.length, tags: await getEligibleQuestionTags(subjectId, eligible) }
})
