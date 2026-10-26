import { and, eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { quizSessions, quizSessionSubjects, subjects, quizSessionQuestions } from '../../database/schema'
import { isSessionExpired } from '../../utils/session-selection'
import { finishSession } from '../../utils/finish-session'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')

  const [existing] = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.studentId, user!.id), eq(quizSessions.status, 'in_progress')))
    .limit(1)

  if (!existing) {
    return null
  }

  // Self-cleaning, same as the check in sessions/index.post.ts — an expired session shouldn't
  // show up as "in progress" to resume.
  if (isSessionExpired(existing)) {
    await finishSession(existing.id)
    return null
  }

  const subjectLinks = await db.select({ subjectName: subjects.name })
    .from(quizSessionSubjects)
    .innerJoin(subjects, eq(subjects.id, quizSessionSubjects.subjectId))
    .where(eq(quizSessionSubjects.quizSessionId, existing.id))

  const questionRows = await db.select({ answeredAt: quizSessionQuestions.answeredAt })
    .from(quizSessionQuestions)
    .where(eq(quizSessionQuestions.quizSessionId, existing.id))

  return {
    sessionId: existing.id,
    isPaper: existing.paperAttemptId !== null,
    subjectNames: subjectLinks.map(s => s.subjectName),
    answeredCount: questionRows.filter(q => q.answeredAt !== null).length,
    totalCount: questionRows.length
  }
})
