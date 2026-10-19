import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { openQuestions, openQuestionSets, documents, subjects } from '../database/schema'
import { buildGradingPrompt, gradeAnswer, type GradingResult } from './claude-cli'

export interface PriorRound { promptText: string, answerText: string, feedback: string }

export async function gradeOpenQuestionAnswer(
  openQuestionId: number,
  priorRounds: PriorRound[],
  // Omit for round 0 — defaults to the question's own prompt text.
  currentPrompt: string | undefined,
  latestAnswer: string
): Promise<GradingResult> {
  const [question] = await db.select().from(openQuestions).where(eq(openQuestions.id, openQuestionId)).limit(1)
  if (!question) {
    throw new Error('Question not found')
  }

  const [set] = await db.select().from(openQuestionSets).where(eq(openQuestionSets.id, question.setId)).limit(1)
  if (!set) {
    throw new Error('Question set not found')
  }

  const [subject] = await db.select().from(subjects).where(eq(subjects.id, set.subjectId)).limit(1)

  const subjectDocs = await db.select().from(documents).where(eq(documents.subjectId, set.subjectId))
  const syllabus = subjectDocs.find(d => d.role === 'syllabus')
  const markScheme = subjectDocs.find(d => d.role === 'mark_scheme')
  const chapter = set.chapterDocumentId ? subjectDocs.find(d => d.id === set.chapterDocumentId) : undefined

  const prompt = buildGradingPrompt({
    customInstructions: subject?.gradingInstructions ?? null,
    syllabusText: syllabus?.extractedText ?? null,
    markSchemeText: markScheme?.extractedText ?? null,
    chapterText: chapter?.extractedText ?? null,
    passageText: set.passageText,
    originalQuestion: question.promptText,
    priorRounds,
    currentPrompt: currentPrompt ?? question.promptText,
    latestAnswer
  })

  return gradeAnswer(prompt)
}
