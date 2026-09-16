import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../database/client'
import { subjects, questions, quizSessions, quizSessionSubjects, quizSessionQuestions, paperSections, paperAttempts } from '../database/schema'
import { pickWeightedQuestionsForSubject } from './weighting'

interface SubjectAllocation {
  subjectId: number
  subjectName: string
  questionCount: number
  timeLimitSeconds: number
}

interface PaperContext {
  paperAttemptId: number
  sectionIndex: number
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export async function createSessionForAllocations(studentId: number, allocations: SubjectAllocation[], paperContext?: PaperContext) {
  if (allocations.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid subjects selected' })
  }

  const now = Date.now()
  const plannedQuestionCount = allocations.reduce((sum, a) => sum + a.questionCount, 0)
  const timeLimitSeconds = allocations.reduce((sum, a) => sum + a.timeLimitSeconds, 0)

  const [session] = await db.insert(quizSessions).values({
    studentId,
    status: 'in_progress',
    plannedQuestionCount,
    timeLimitSeconds,
    startedAt: now,
    createdAt: now,
    paperAttemptId: paperContext?.paperAttemptId ?? null,
    paperSectionIndex: paperContext?.sectionIndex ?? null
  }).returning()

  if (!session) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create session' })
  }

  await db.insert(quizSessionSubjects).values(
    allocations.map(a => ({
      quizSessionId: session.id,
      subjectId: a.subjectId,
      questionCount: a.questionCount,
      timeLimitSeconds: a.timeLimitSeconds
    }))
  )

  const perSubjectPicks: { subjectId: number, questionId: number }[] = []

  for (const allocation of allocations) {
    const activeQuestions = await db.select({ id: questions.id }).from(questions)
      .where(and(eq(questions.subjectId, allocation.subjectId), eq(questions.isActive, true)))

    const expectedTimePerQuestionMs = allocation.questionCount > 0
      ? (allocation.timeLimitSeconds * 1000) / allocation.questionCount
      : 0

    if (activeQuestions.length < allocation.questionCount) {
      console.warn(`[study-buddy] Subject "${allocation.subjectName}" has only ${activeQuestions.length} active question(s), fewer than the requested ${allocation.questionCount}.`)
    }

    const pickedIds = pickWeightedQuestionsForSubject(
      studentId,
      allocation.subjectId,
      Math.min(allocation.questionCount, activeQuestions.length),
      expectedTimePerQuestionMs
    )

    for (const questionId of pickedIds) {
      perSubjectPicks.push({ subjectId: allocation.subjectId, questionId })
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

export async function startSession(studentId: number, subjectIds: number[]) {
  if (subjectIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Select at least one subject' })
  }

  const chosenSubjects = await db.select().from(subjects)
    .where(and(inArray(subjects.id, subjectIds), eq(subjects.isActive, true)))

  if (chosenSubjects.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid subjects selected' })
  }

  return createSessionForAllocations(studentId, chosenSubjects.map(s => ({
    subjectId: s.id,
    subjectName: s.name,
    questionCount: s.defaultQuestionCount,
    timeLimitSeconds: s.defaultTimeLimitSeconds
  })))
}

export async function startPaperSection(paperAttemptId: number, sectionIndex: number, studentId: number) {
  const [attempt] = await db.select().from(paperAttempts).where(eq(paperAttempts.id, paperAttemptId)).limit(1)
  if (!attempt) {
    throw createError({ statusCode: 404, statusMessage: 'Paper attempt not found' })
  }

  const [section] = await db.select({
    subjectId: paperSections.subjectId,
    subjectName: subjects.name,
    questionCount: paperSections.questionCount,
    timeLimitSeconds: paperSections.timeLimitSeconds
  }).from(paperSections)
    .innerJoin(subjects, eq(subjects.id, paperSections.subjectId))
    .where(and(eq(paperSections.paperId, attempt.paperId), eq(paperSections.sortOrder, sectionIndex)))
    .limit(1)

  if (!section) {
    throw createError({ statusCode: 500, statusMessage: 'Paper section not found' })
  }

  return createSessionForAllocations(studentId, [section], { paperAttemptId, sectionIndex })
}
