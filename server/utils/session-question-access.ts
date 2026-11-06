import type { H3Event } from 'h3'
import { and, eq } from 'drizzle-orm'
import { db } from '../database/client'
import { questions, quizSessionQuestions, quizSessions } from '../database/schema'

// Resolves /api/sessions/:id/questions/:seq to its question id for the signed-in student, for
// asking Claude to explain it. Mid-session that's only allowed for self-marked questions — the
// button sits beside "Check answer", which multiple choice doesn't have, so explaining one would
// give the answer away. Once the session is over (the review page) any question can be explained.
export async function explainableQuestionId(event: H3Event): Promise<number> {
  const { user } = await requireRole(event, 'student')
  const sessionId = Number(getRouterParam(event, 'id'))
  const sequenceIndex = Number(getRouterParam(event, 'seq'))

  const [session] = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.id, sessionId), eq(quizSessions.studentId, user!.id)))
    .limit(1)
  if (!session) throw createError({ statusCode: 404, statusMessage: 'Session not found' })

  const [row] = await db.select({ questionId: quizSessionQuestions.questionId, type: questions.type })
    .from(quizSessionQuestions)
    .innerJoin(questions, eq(questions.id, quizSessionQuestions.questionId))
    .where(and(eq(quizSessionQuestions.quizSessionId, sessionId), eq(quizSessionQuestions.sequenceIndex, sequenceIndex)))
    .limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Question not found in this session' })

  if (session.status === 'in_progress' && row.type !== 'self_marked_image') {
    throw createError({ statusCode: 403, statusMessage: 'Explanations for this question are available after the session' })
  }
  return row.questionId
}
