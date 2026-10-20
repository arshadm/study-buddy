import { and, eq, gte, isNotNull, isNull, or } from 'drizzle-orm'
import { db } from '../../../database/client'
import { sections, questions, quizSessions, quizSessionQuestions, paperAttempts } from '../../../database/schema'
import { computeWindows, WINDOWS_DAYS, DAY_MS } from '../../../utils/performance-windows'

// Mirrors subject-performance.get.ts one level down — sections double as "categories" for
// this (see server/utils/weighting.ts, which weights question selection the same way).
// MCQ only: discussion activities aren't part of the adaptive question pool this explains.
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const maxWindowMs = Math.max(...WINDOWS_DAYS) * DAY_MS
  const cutoff = Date.now() - maxWindowMs

  const allSections = await db.select({ id: sections.id, name: sections.name, subjectId: sections.subjectId })
    .from(sections)
    .orderBy(sections.subjectId, sections.name)

  const rows = await db.select({
    sectionId: questions.sectionId,
    isCorrect: quizSessionQuestions.isCorrect,
    startedAt: quizSessions.startedAt
  }).from(quizSessionQuestions)
    .innerJoin(quizSessions, eq(quizSessions.id, quizSessionQuestions.quizSessionId))
    .innerJoin(questions, eq(questions.id, quizSessionQuestions.questionId))
    .leftJoin(paperAttempts, eq(paperAttempts.id, quizSessions.paperAttemptId))
    .where(and(
      eq(quizSessions.status, 'completed'),
      gte(quizSessions.startedAt, cutoff),
      isNotNull(questions.sectionId),
      or(isNull(quizSessions.paperAttemptId), eq(paperAttempts.status, 'completed'))
    ))

  return allSections.map(section => ({
    sectionId: section.id,
    sectionName: section.name,
    subjectId: section.subjectId,
    windows: computeWindows(rows.filter(r => r.sectionId === section.id))
  }))
})
