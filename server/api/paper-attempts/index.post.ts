import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { papers, paperSections, paperAttempts, quizSessions } from '../../database/schema'
import { startPaperSection } from '../../utils/session-selection'

const bodySchema = z.object({
  paperId: z.number().int()
})

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const { paperId } = await readValidatedBody(event, bodySchema.parse)

  const [existingSession] = await db.select({ id: quizSessions.id }).from(quizSessions)
    .where(and(eq(quizSessions.studentId, user!.id), eq(quizSessions.status, 'in_progress')))
    .limit(1)

  if (existingSession) {
    throw createError({ statusCode: 409, statusMessage: 'A session is already in progress' })
  }

  const [paper] = await db.select().from(papers).where(and(eq(papers.id, paperId), eq(papers.isActive, true))).limit(1)
  if (!paper) {
    throw createError({ statusCode: 404, statusMessage: 'Paper not found' })
  }

  const sectionCount = await db.$count(paperSections, eq(paperSections.paperId, paperId))
  if (sectionCount === 0) {
    throw createError({ statusCode: 400, statusMessage: 'This paper has no sections configured yet' })
  }

  const now = Date.now()
  const [attempt] = await db.insert(paperAttempts).values({
    paperId,
    studentId: user!.id,
    status: 'in_progress',
    currentSectionIndex: 0,
    startedAt: now,
    createdAt: now
  }).returning()

  if (!attempt) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to start paper attempt' })
  }

  const { sessionId } = await startPaperSection(attempt.id, 0, user!.id)

  return { paperAttemptId: attempt.id, sessionId }
})
