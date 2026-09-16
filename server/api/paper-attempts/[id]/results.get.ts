import { and, eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { paperAttempts } from '../../../database/schema'
import { getPaperAttemptResults } from '../../../utils/paper-attempt-results'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const id = Number(getRouterParam(event, 'id'))

  const [attempt] = await db.select({ id: paperAttempts.id }).from(paperAttempts)
    .where(and(eq(paperAttempts.id, id), eq(paperAttempts.studentId, user!.id)))
    .limit(1)

  if (!attempt) {
    throw createError({ statusCode: 404, statusMessage: 'Paper attempt not found' })
  }

  return getPaperAttemptResults(id)
})
