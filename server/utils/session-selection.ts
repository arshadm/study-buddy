import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../database/client'
import { subjects, questions, quizSessions, quizSessionSubjects, quizSessionQuestions } from '../database/schema'
import { pickWeightedQuestionsForSubject } from './weighting'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export async function startSession(studentId: number, subjectIds: number[]) {
  if (subjectIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Select at least one subject' })
  }

  const chosenSubjects = await db.select().from(subjects)
    .where(and(inArray(subjects.id, subjectIds), eq(subjects.isActive, true)))

  if (chosenSubjects.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid subjects selected' })
  }

  const now = Date.now()
  const plannedQuestionCount = chosenSubjects.reduce((sum, s) => sum + s.defaultQuestionCount, 0)
  const timeLimitSeconds = chosenSubjects.reduce((sum, s) => sum + s.defaultTimeLimitSeconds, 0)

  const [session] = await db.insert(quizSessions).values({
    studentId,
    status: 'in_progress',
    plannedQuestionCount,
    timeLimitSeconds,
    startedAt: now,
    createdAt: now
  }).returning()

  if (!session) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create session' })
  }

  await db.insert(quizSessionSubjects).values(
    chosenSubjects.map(s => ({
      quizSessionId: session.id,
      subjectId: s.id,
      questionCount: s.defaultQuestionCount,
      timeLimitSeconds: s.defaultTimeLimitSeconds
    }))
  )

  const perSubjectPicks: { subjectId: number, questionId: number }[] = []

  for (const subject of chosenSubjects) {
    const activeQuestions = await db.select({ id: questions.id }).from(questions)
      .where(and(eq(questions.subjectId, subject.id), eq(questions.isActive, true)))

    const expectedTimePerQuestionMs = subject.defaultQuestionCount > 0
      ? (subject.defaultTimeLimitSeconds * 1000) / subject.defaultQuestionCount
      : 0

    if (activeQuestions.length < subject.defaultQuestionCount) {
      console.warn(`[study-buddy] Subject "${subject.name}" has only ${activeQuestions.length} active question(s), fewer than its configured ${subject.defaultQuestionCount}.`)
    }

    const pickedIds = pickWeightedQuestionsForSubject(
      studentId,
      subject.id,
      Math.min(subject.defaultQuestionCount, activeQuestions.length),
      expectedTimePerQuestionMs
    )

    for (const questionId of pickedIds) {
      perSubjectPicks.push({ subjectId: subject.id, questionId })
    }
  }

  const shuffled = shuffle(perSubjectPicks)

  if (shuffled.length > 0) {
    await db.insert(quizSessionQuestions).values(
      shuffled.map((pick, index) => ({
        quizSessionId: session.id,
        questionId: pick.questionId,
        subjectId: pick.subjectId,
        sequenceIndex: index
      }))
    )
  }

  return {
    sessionId: session.id,
    timeLimitSeconds,
    totalQuestions: shuffled.length
  }
}
