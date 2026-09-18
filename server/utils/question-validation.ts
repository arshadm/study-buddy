import { z } from 'zod'

export type QuestionType = 'multiple_choice' | 'self_marked_image'
export type OptionFormat = 'text' | 'image'

export const textOptionsSchema = z.array(z.object({
  text: z.string().min(1),
  isCorrect: z.boolean()
})).min(2).refine(opts => opts.filter(o => o.isCorrect).length === 1, {
  message: 'Exactly one option must be marked correct'
})

export const imageOptionsSchema = z.array(z.object({
  isCorrect: z.boolean(),
  // Set when editing and this option's image isn't being replaced — lets the server
  // reuse the existing upload instead of requiring every image to be re-selected.
  existingImagePath: z.string().optional()
})).min(2).refine(opts => opts.filter(o => o.isCorrect).length === 1, {
  message: 'Exactly one option must be marked correct'
})

export function parseQuestionType(fields: Record<string, string>): QuestionType {
  return fields.type === 'self_marked_image' ? 'self_marked_image' : 'multiple_choice'
}

export function parseOptionFormat(fields: Record<string, string>): OptionFormat {
  return fields.optionFormat === 'image' ? 'image' : 'text'
}

export function parseDifficulty(fields: Record<string, string>): number | null {
  if (!fields.difficulty) return null
  const value = Number(fields.difficulty)
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw createError({ statusCode: 400, statusMessage: 'Difficulty must be an integer between 1 and 5' })
  }
  return value
}
