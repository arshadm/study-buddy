import { z } from 'zod'

export type QuestionType = 'multiple_choice' | 'free_response'

export const optionsSchema = z.array(z.object({
  text: z.string().min(1),
  isCorrect: z.boolean()
})).min(2).refine(opts => opts.filter(o => o.isCorrect).length === 1, {
  message: 'Exactly one option must be marked correct'
})

const numericAnswerSchema = z.object({
  answerType: z.literal('numeric'),
  answerNumericValue: z.number(),
  answerTolerancePercent: z.number().min(0).max(100),
  answerUnitHint: z.string().max(50).optional()
})

const textAnswerSchema = z.object({
  answerType: z.literal('text'),
  answerText: z.string().min(1),
  answerUnitHint: z.string().max(50).optional()
})

export const freeResponseAnswerSchema = z.discriminatedUnion('answerType', [numericAnswerSchema, textAnswerSchema])

export function parseQuestionType(fields: Record<string, string>): QuestionType {
  return fields.type === 'free_response' ? 'free_response' : 'multiple_choice'
}

export function parseDifficulty(fields: Record<string, string>): number | null {
  if (!fields.difficulty) return null
  const value = Number(fields.difficulty)
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw createError({ statusCode: 400, statusMessage: 'Difficulty must be an integer between 1 and 5' })
  }
  return value
}

interface FreeResponseFields {
  answerType: 'numeric' | 'text' | null
  answerNumericValue: number | null
  answerTolerancePercent: number | null
  answerText: string | null
  answerUnitHint: string | null
}

export function parseFreeResponseFields(fields: Record<string, string>): FreeResponseFields {
  let parsed
  try {
    parsed = freeResponseAnswerSchema.parse({
      answerType: fields.answerType,
      answerNumericValue: fields.answerNumericValue !== undefined && fields.answerNumericValue !== '' ? Number(fields.answerNumericValue) : undefined,
      answerTolerancePercent: fields.answerTolerancePercent !== undefined && fields.answerTolerancePercent !== '' ? Number(fields.answerTolerancePercent) : undefined,
      answerText: fields.answerText,
      answerUnitHint: fields.answerUnitHint || undefined
    })
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: err instanceof Error ? err.message : 'Invalid free-response answer configuration' })
  }

  if (parsed.answerType === 'numeric') {
    return {
      answerType: 'numeric',
      answerNumericValue: parsed.answerNumericValue,
      answerTolerancePercent: parsed.answerTolerancePercent,
      answerText: null,
      answerUnitHint: parsed.answerUnitHint ?? null
    }
  }

  return {
    answerType: 'text',
    answerText: parsed.answerText,
    answerNumericValue: null,
    answerTolerancePercent: null,
    answerUnitHint: parsed.answerUnitHint ?? null
  }
}

export const emptyFreeResponseFields: FreeResponseFields = {
  answerType: null,
  answerNumericValue: null,
  answerTolerancePercent: null,
  answerText: null,
  answerUnitHint: null
}
