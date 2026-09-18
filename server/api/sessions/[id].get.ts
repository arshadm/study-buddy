import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '../../database/client'
import { quizSessions, quizSessionQuestions, quizSessionSubjects, subjects, paperAttempts, papers, paperSections } from '../../database/schema'
import { finishSession } from '../../utils/finish-session'
import { advancePaperAttempt } from '../../utils/paper-advance'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')
  const id = Number(getRouterParam(event, 'id'))

  const [session] = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.id, id), eq(quizSessions.studentId, user!.id)))
    .limit(1)

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  const totalQuestions = await db.$count(quizSessionQuestions, eq(quizSessionQuestions.quizSessionId, id))

  let paper: { attemptId: number, paperName: string, sectionIndex: number, totalSections: number, sectionSubjectName: string | null } | null = null
  if (session.paperAttemptId !== null && session.paperSectionIndex !== null) {
    const [attempt] = await db.select().from(paperAttempts).where(eq(paperAttempts.id, session.paperAttemptId)).limit(1)
    if (attempt) {
      const [paperRow] = await db.select({ name: papers.name }).from(papers).where(eq(papers.id, attempt.paperId)).limit(1)
      const totalSections = await db.$count(paperSections, eq(paperSections.paperId, attempt.paperId))
      const [subjectLink] = await db.select({ subjectName: subjects.name }).from(quizSessionSubjects)
        .innerJoin(subjects, eq(subjects.id, quizSessionSubjects.subjectId))
        .where(eq(quizSessionSubjects.quizSessionId, id))
        .limit(1)

      paper = {
        attemptId: attempt.id,
        paperName: paperRow?.name ?? 'Paper',
        sectionIndex: session.paperSectionIndex,
        totalSections,
        sectionSubjectName: subjectLink?.subjectName ?? null
      }
    }
  }

  if (session.status === 'in_progress' && Date.now() > session.startedAt + session.timeLimitSeconds * 1000) {
    if (paper) {
      const result = await advancePaperAttempt(paper.attemptId, user!.id)
      return { session: null, remainingMs: 0, totalQuestions, firstUnansweredIndex: null, paper, expired: true, advance: result }
    }
    const finished = await finishSession(session.id)
    return { session: finished, remainingMs: 0, totalQuestions, firstUnansweredIndex: null, paper: null }
  }

  const remainingMs = session.status === 'in_progress'
    ? Math.max(0, session.startedAt + session.timeLimitSeconds * 1000 - Date.now())
    : 0

  const [firstUnanswered] = await db.select({ sequenceIndex: quizSessionQuestions.sequenceIndex })
    .from(quizSessionQuestions)
    .where(and(
      eq(quizSessionQuestions.quizSessionId, id),
      isNull(quizSessionQuestions.isCorrect)
    ))
    .orderBy(asc(quizSessionQuestions.sequenceIndex))
    .limit(1)

  return {
    session,
    remainingMs,
    totalQuestions,
    firstUnansweredIndex: firstUnanswered?.sequenceIndex ?? null,
    paper
  }
})
