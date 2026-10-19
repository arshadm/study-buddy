import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../../database/client'
import { openQuestionSetAttempts } from '../../../../database/schema'
import { submitDiscussionAnswer } from '../../../../utils/discussion-attempts'

const bodySchema = z.object({ answerText: z.string().optional() })

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const attemptId = Number(getRouterParam(event, 'attemptId'))
  const body = await readValidatedBody(event, bodySchema.parse)

  const [setAttempt] = await db.select().from(openQuestionSetAttempts)
    .where(and(eq(openQuestionSetAttempts.id, attemptId), eq(openQuestionSetAttempts.studentId, user!.id)))
    .limit(1)
  if (!setAttempt) {
    throw createError({ statusCode: 404, statusMessage: 'Attempt not found' })
  }

  return submitDiscussionAnswer(attemptId, body.answerText)
})
