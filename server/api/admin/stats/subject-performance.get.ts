import { and, eq, gte, isNull, or } from 'drizzle-orm'
import { db } from '../../../database/client'
import { subjects, quizSessions, quizSessionQuestions, paperAttempts, openQuestionAttempts, openQuestionSetAttempts } from '../../../database/schema'
import { computeWindows, WINDOWS_DAYS, DAY_MS } from '../../../utils/performance-windows'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const maxWindowMs = Math.max(...WINDOWS_DAYS) * DAY_MS
  const cutoff = Date.now() - maxWindowMs

  const activeSubjects = await db.select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(eq(subjects.isActive, true))
    .orderBy(subjects.name)

  const mcqRows = await db.select({
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

  // Discussion activities use the same "answered correctly or not" signal — one row per
  // question, counted only once the whole set is done, matching the mock-paper gating above.
  const discussionRows = await db.select({
    subjectId: openQuestionSetAttempts.subjectId,
    status: openQuestionAttempts.status,
    startedAt: openQuestionSetAttempts.startedAt
  }).from(openQuestionAttempts)
    .innerJoin(openQuestionSetAttempts, eq(openQuestionSetAttempts.id, openQuestionAttempts.setAttemptId))
    .where(and(
      eq(openQuestionSetAttempts.status, 'completed'),
      gte(openQuestionSetAttempts.startedAt, cutoff)
    ))

  const rows = [
    ...mcqRows,
    ...discussionRows.map(r => ({
      subjectId: r.subjectId,
      isCorrect: r.status === 'acceptable',
      startedAt: r.startedAt
    }))
  ]

  return activeSubjects.map(subject => ({
    subjectId: subject.id,
    subjectName: subject.name,
    windows: computeWindows(rows.filter(r => r.subjectId === subject.id))
  }))
})
