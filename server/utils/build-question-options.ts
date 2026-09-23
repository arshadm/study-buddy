import { textOptionsSchema } from './question-validation'

export interface OptionRow {
  optionText: string | null
  optionImagePath: string | null
  isCorrect: boolean
}

// Only used for optionFormat 'text' — 'image' questions have no question_options rows at all.
export function buildQuestionOptions(fields: Record<string, string>): OptionRow[] {
  let parsed
  try {
    parsed = textOptionsSchema.parse(JSON.parse(fields.options || '[]'))
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: err instanceof Error ? err.message : 'Invalid options' })
  }
  return parsed.map(opt => ({ optionText: opt.text, optionImagePath: null, isCorrect: opt.isCorrect }))
}
