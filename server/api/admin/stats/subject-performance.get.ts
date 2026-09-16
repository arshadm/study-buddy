import { and, eq, gte, isNull, or } from 'drizzle-orm'
import { db } from '../../../database/client'
import { subjects, quizSessions, quizSessionQuestions, paperAttempts } from '../../../database/schema'

const WINDOWS_DAYS = [7, 14, 28] as const
const DAY_MS = 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const maxWindowMs = Math.max(...WINDOWS_DAYS) * DAY_MS
  const cutoff = Date.now() - maxWindowMs

  const activeSubjects = await db.select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(eq(subjects.isActive, true))
    .orderBy(subjects.name)

  const rows = await db.select({
    subjectId: quizSessionQuestions.subjectId,
    isCorrect: quizSessionQuestions.isCorrect,
    startedAt: quizSessions.startedAt
  }).from(quizSessionQuestions)
    .innerJoin(quizSessions, eq(quizSessions.id, quizSessionQuestions.quizSessionId))
    .leftJoin(paperAttempts, eq(paperAttempts.id, quizSessions.paperAttemptId))
    .where(and(
      eq(quizSessions.status, 'completed'),
      gte(quizSessions.startedAt, cutoff),
      // A mock-paper section is only counted once the whole paper is done, not
      // as each section individually finishes.
      or(isNull(quizSessions.paperAttemptId), eq(paperAttempts.status, 'completed'))
    ))

  const now = Date.now()

  return activeSubjects.map((subject) => {
    const subjectRows = rows.filter(r => r.subjectId === subject.id)

    const windows = Object.fromEntries(WINDOWS_DAYS.map((days) => {
      const windowCutoff = now - days * DAY_MS
      const inWindow = subjectRows.filter(r => r.startedAt >= windowCutoff)
      const answered = inWindow.filter(r => r.isCorrect !== null)
      const correct = answered.filter(r => r.isCorrect).length

      return [days, {
        percent: answered.length > 0 ? Math.round((correct / answered.length) * 100) : null,
        questions: answered.length
      }]
    }))

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      windows
    }
  })
})
