import { z } from 'zod'

export type QuestionType = 'multiple_choice' | 'self_marked_image'
export type OptionFormat = 'text' | 'image'

export const textOptionsSchema = z.array(z.object({
  text: z.string().min(1),
  isCorrect: z.boolean()
})).min(2).refine(opts => opts.filter(o => o.isCorrect).length === 1, {
  message: 'Exactly one option must be marked correct'
})

export function parseQuestionType(fields: Record<string, string>): QuestionType {
  return fields.type === 'self_marked_image' ? 'self_marked_image' : 'multiple_choice'
}

export function parseOptionFormat(fields: Record<string, string>): OptionFormat {
  return fields.optionFormat === 'image' ? 'image' : 'text'
}

// For a multiple_choice question with optionFormat 'image' — the question image already
// shows the options, so this is just the short label the student must type (e.g. "a").
export function parseCorrectAnswerText(fields: Record<string, string>): string {
  const value = (fields.correctAnswerText || '').trim()
  if (!value) {
    throw createError({ statusCode: 400, statusMessage: 'A correct answer is required' })
  }
  return value
}

export function parseDifficulty(fields: Record<string, string>): number | null {
  if (!fields.difficulty) return null
  const value = Number(fields.difficulty)
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw createError({ statusCode: 400, statusMessage: 'Difficulty must be an integer between 1 and 5' })
  }
  return value
}

// Sent by the question form alongside difficulty when Claude suggested it: the raw 1–100 score,
// and whether the chosen difficulty is still Claude's (so it may be re-banded later).
export function parseDifficultyScore(fields: Record<string, string>): number | null {
  if (!fields.difficultyScore) return null
  const value = Number(fields.difficultyScore)
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw createError({ statusCode: 400, statusMessage: 'Difficulty score must be an integer between 1 and 100' })
  }
  return value
}

// A cleared difficulty with a score is left for re-banding to fill in.
export function parseDifficultyAuto(fields: Record<string, string>, difficulty: number | null, score: number | null): boolean {
  return difficulty === null ? score !== null : fields.difficultyAuto === 'true'
}
