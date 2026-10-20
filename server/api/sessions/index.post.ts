import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { quizSessions } from '../../database/schema'
import { startSession, isSessionExpired } from '../../utils/session-selection'
import { finishSession } from '../../utils/finish-session'

const bodySchema = z.object({
  allocations: z.array(z.object({
    subjectId: z.number().int(),
    questionCount: z.number().int().min(1).max(200),
    timeLimitSeconds: z.number().int().min(30).max(24 * 60 * 60).nullable()
  })).min(1)
})

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const { allocations } = await readValidatedBody(event, bodySchema.parse)

  const [existing] = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.studentId, user!.id), eq(quizSessions.status, 'in_progress')))
    .limit(1)

  if (existing) {
    if (isSessionExpired(existing)) {
      await finishSession(existing.id)
    } else {
      throw createError({ statusCode: 409, statusMessage: 'A session is already in progress', data: { sessionId: existing.id } })
    }
  }

  return startSession(user!.id, allocations)
})
