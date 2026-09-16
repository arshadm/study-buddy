import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { paperAttempts } from '../../database/schema'
import { getPaperAttemptResults } from '../../utils/paper-attempt-results'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')

  const attempts = await db.select({ id: paperAttempts.id }).from(paperAttempts)
    .where(and(eq(paperAttempts.studentId, user!.id), eq(paperAttempts.status, 'completed')))
    .orderBy(desc(paperAttempts.startedAt))

  return Promise.all(attempts.map(a => getPaperAttemptResults(a.id)))
})
