import { asc, eq } from 'drizzle-orm'
import { db } from '../database/client'
import { paperAttempts, papers, quizSessions, quizSessionSubjects, subjects } from '../database/schema'

export async function getPaperAttemptResults(attemptId: number) {
  const [attempt] = await db.select().from(paperAttempts).where(eq(paperAttempts.id, attemptId)).limit(1)
  if (!attempt) return null

  const [paper] = await db.select({ name: papers.name }).from(papers).where(eq(papers.id, attempt.paperId)).limit(1)

  const sessions = await db.select().from(quizSessions)
    .where(eq(quizSessions.paperAttemptId, attemptId))
    .orderBy(asc(quizSessions.paperSectionIndex))

  const sections = await Promise.all(sessions.map(async (session) => {
    const [link] = await db.select({ subjectName: subjects.name }).from(quizSessionSubjects)
      .innerJoin(subjects, eq(subjects.id, quizSessionSubjects.subjectId))
      .where(eq(quizSessionSubjects.quizSessionId, session.id))
      .limit(1)

    return {
      sectionIndex: session.paperSectionIndex,
      subjectName: link?.subjectName ?? null,
      sessionId: session.id,
      status: session.status,
      scoreCorrect: session.scoreCorrect,
      scoreTotal: session.scoreTotal
    }
  }))

  const overall = sections.reduce((acc, s) => ({
    correct: acc.correct + (s.scoreCorrect ?? 0),
    total: acc.total + (s.scoreTotal ?? 0)
  }), { correct: 0, total: 0 })

  return {
    attempt,
    paperName: paper?.name ?? 'Paper',
    sections,
    overall
  }
}
