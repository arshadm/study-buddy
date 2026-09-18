import { textOptionsSchema, imageOptionsSchema, type OptionFormat } from './question-validation'
import { saveQuestionImage } from './uploads'
import type { ParsedMultipart } from './multipart'

export interface OptionRow {
  optionText: string | null
  optionImagePath: string | null
  isCorrect: boolean
}

export async function buildQuestionOptions(
  optionFormat: OptionFormat,
  fields: Record<string, string>,
  files: ParsedMultipart['files']
): Promise<OptionRow[]> {
  if (optionFormat === 'text') {
    let parsed
    try {
      parsed = textOptionsSchema.parse(JSON.parse(fields.options || '[]'))
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: err instanceof Error ? err.message : 'Invalid options' })
    }
    return parsed.map(opt => ({ optionText: opt.text, optionImagePath: null, isCorrect: opt.isCorrect }))
  }

  let parsed
  try {
    parsed = imageOptionsSchema.parse(JSON.parse(fields.options || '[]'))
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: err instanceof Error ? err.message : 'Invalid options' })
  }

  const rows: OptionRow[] = []
  for (let i = 0; i < parsed.length; i++) {
    const file = files[`optionImage_${i}`]
    const entry = parsed[i]!
    let optionImagePath: string
    if (file) {
      optionImagePath = await saveQuestionImage(file)
    } else if (entry.existingImagePath) {
      optionImagePath = entry.existingImagePath
    } else {
      throw createError({ statusCode: 400, statusMessage: `Missing image for option ${i + 1}` })
    }
    rows.push({ optionText: null, optionImagePath, isCorrect: entry.isCorrect })
  }
  return rows
}
