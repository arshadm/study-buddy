import { and, eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { paperAttempts, quizSessions } from '../../database/schema'
import { getPaperWithSections } from '../../utils/paper-summary'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const id = Number(getRouterParam(event, 'id'))

  const [attempt] = await db.select().from(paperAttempts)
    .where(and(eq(paperAttempts.id, id), eq(paperAttempts.studentId, user!.id)))
    .limit(1)

  if (!attempt) {
    throw createError({ statusCode: 404, statusMessage: 'Paper attempt not found' })
  }

  const paper = await getPaperWithSections(attempt.paperId)
  if (!paper) {
    throw createError({ statusCode: 500, statusMessage: 'Paper data missing' })
  }

  const [currentSession] = await db.select({ id: quizSessions.id }).from(quizSessions)
    .where(and(eq(quizSessions.paperAttemptId, id), eq(quizSessions.paperSectionIndex, attempt.currentSectionIndex)))
    .limit(1)

  const sections = paper.sections.map(section => ({
    ...section,
    status: section.sortOrder < attempt.currentSectionIndex || attempt.status === 'completed'
      ? 'completed'
      : section.sortOrder === attempt.currentSectionIndex
        ? 'current'
        : 'locked'
  }))

  return {
    attempt,
    paperName: paper.name,
    sections,
    currentSessionId: currentSession?.id ?? null
  }
})
