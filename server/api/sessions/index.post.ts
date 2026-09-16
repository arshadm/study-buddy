import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { quizSessions } from '../../database/schema'
import { startSession } from '../../utils/session-selection'
import { finishSession } from '../../utils/finish-session'

const bodySchema = z.object({
  subjectIds: z.array(z.number().int()).min(1)
})

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const { subjectIds } = await readValidatedBody(event, bodySchema.parse)

  const [existing] = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.studentId, user!.id), eq(quizSessions.status, 'in_progress')))
    .limit(1)

  if (existing) {
    const expired = Date.now() > existing.startedAt + existing.timeLimitSeconds * 1000
    if (expired) {
      await finishSession(existing.id)
    } else {
      throw createError({ statusCode: 409, statusMessage: 'A session is already in progress', data: { sessionId: existing.id } })
    }
  }

  return startSession(user!.id, subjectIds)
})
