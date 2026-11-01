import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { openQuestionSets } from '../../../database/schema'
import { startOrResumeSetAttempt } from '../../../utils/discussion-attempts'
import { assertSubjectsAssigned } from '../../../utils/student-subjects'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const setId = Number(getRouterParam(event, 'setId'))

  const [set] = await db.select({ subjectId: openQuestionSets.subjectId }).from(openQuestionSets)
    .where(eq(openQuestionSets.id, setId)).limit(1)
  if (!set) {
    throw createError({ statusCode: 404, statusMessage: 'Discussion activity not found' })
  }
  await assertSubjectsAssigned(user!.id, [set.subjectId])

  const attemptId = await startOrResumeSetAttempt(setId, user!.id)
  return { attemptId }
})
