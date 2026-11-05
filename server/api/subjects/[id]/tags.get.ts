import { getEligibleQuestionIds, getEligibleQuestionTags } from '../../../utils/question-pool'
import { assertSubjectsAssigned } from '../../../utils/student-subjects'
import { getTagScores } from '../../../utils/weighting'

// Start-page tag filter for one subject: its tags that have at least one available question,
// with the question ids each covers, plus the subject's total available question count. For a
// student, each tag also carries their score (percent correct over its questions, null when
// never attempted) so the pills can be coloured by weakness.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const subjectId = Number(getRouterParam(event, 'id'))
  if (!subjectId) throw createError({ statusCode: 400, statusMessage: 'Invalid subject' })
  if (user.role !== 'admin') await assertSubjectsAssigned(user.id, [subjectId])

  const eligible = await getEligibleQuestionIds(subjectId)
  const tags = await getEligibleQuestionTags(subjectId, eligible)
  const scores = user.role === 'student' ? getTagScores(user.id, subjectId) : new Map()

  return {
    totalQuestions: eligible.length,
    tags: tags.map(t => ({ ...t, score: scores.get(t.id)?.score ?? null, attempts: scores.get(t.id)?.attempts ?? 0 }))
  }
})
