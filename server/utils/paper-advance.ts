import { and, eq } from 'drizzle-orm'
import { db } from '../database/client'
import { paperAttempts, paperSections, quizSessions } from '../database/schema'
import { finishSession } from './finish-session'
import { startPaperSection } from './session-selection'

export async function advancePaperAttempt(paperAttemptId: number, studentId: number) {
  const [attempt] = await db.select().from(paperAttempts)
    .where(and(eq(paperAttempts.id, paperAttemptId), eq(paperAttempts.studentId, studentId)))
    .limit(1)

  if (!attempt || attempt.status !== 'in_progress') {
    return { done: true, sessionId: null }
  }

  const [currentSession] = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.paperAttemptId, paperAttemptId), eq(quizSessions.paperSectionIndex, attempt.currentSectionIndex)))
    .limit(1)

  if (currentSession && currentSession.status === 'in_progress') {
    await finishSession(currentSession.id)
  }

  const totalSections = await db.$count(paperSections, eq(paperSections.paperId, attempt.paperId))
  const nextIndex = attempt.currentSectionIndex + 1

  if (nextIndex < totalSections) {
    await db.update(paperAttempts).set({ currentSectionIndex: nextIndex }).where(eq(paperAttempts.id, paperAttemptId))
    const { sessionId } = await startPaperSection(paperAttemptId, nextIndex, studentId)
    return { done: false, sessionId }
  }

  await db.update(paperAttempts).set({ status: 'completed', finishedAt: Date.now() }).where(eq(paperAttempts.id, paperAttemptId))
  return { done: true, sessionId: null }
}
