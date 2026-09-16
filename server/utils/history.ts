import { and, eq, desc } from 'drizzle-orm'
import { db } from '../database/client'
import { quizSessions, quizSessionSubjects, subjects } from '../database/schema'

export async function getSessionHistory(studentId: number, subjectId?: number) {
  const sessions = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.studentId, studentId), eq(quizSessions.status, 'completed')))
    .orderBy(desc(quizSessions.startedAt))

  const sessionIds = sessions.map(s => s.id)
  if (sessionIds.length === 0) return []

  // fetch all subject links for all sessions (small dataset at this scale)
  const allLinks = await db.select({
    quizSessionId: quizSessionSubjects.quizSessionId,
    subjectId: quizSessionSubjects.subjectId,
    subjectName: subjects.name
  }).from(quizSessionSubjects)
    .innerJoin(subjects, eq(subjects.id, quizSessionSubjects.subjectId))

  const subjectsBySession = new Map<number, { subjectId: number, subjectName: string }[]>()
  for (const link of allLinks) {
    if (!subjectsBySession.has(link.quizSessionId)) subjectsBySession.set(link.quizSessionId, [])
    subjectsBySession.get(link.quizSessionId)!.push({ subjectId: link.subjectId, subjectName: link.subjectName })
  }

  const withSubjects = sessions.map(s => ({
    ...s,
    subjects: subjectsBySession.get(s.id) || []
  }))

  if (subjectId) {
    return withSubjects.filter(s => s.subjects.some(sub => sub.subjectId === subjectId))
  }

  return withSubjects
}
