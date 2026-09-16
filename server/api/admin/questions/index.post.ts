import { z } from 'zod'
import { db } from '../../../database/client'
import { questions, questionOptions } from '../../../database/schema'
import { parseMultipartForm } from '../../../utils/multipart'
import { saveQuestionImage } from '../../../utils/uploads'

const optionsSchema = z.array(z.object({
  text: z.string().min(1),
  isCorrect: z.boolean()
})).min(2).refine(opts => opts.filter(o => o.isCorrect).length === 1, {
  message: 'Exactly one option must be marked correct'
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const { fields, files } = await parseMultipartForm(event)

  const subjectId = Number(fields.subjectId)
  if (!subjectId) {
    throw createError({ statusCode: 400, statusMessage: 'subjectId is required' })
  }

  if (!files.image) {
    throw createError({ statusCode: 400, statusMessage: 'Question image is required' })
  }

  let options
  try {
    options = optionsSchema.parse(JSON.parse(fields.options || '[]'))
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: err instanceof Error ? err.message : 'Invalid options' })
  }

  const imagePath = await saveQuestionImage(files.image)
  const now = Date.now()

  const [question] = await db.insert(questions).values({
    subjectId,
    imagePath,
    hintText: fields.hintText || null,
    createdAt: now,
    updatedAt: now
  }).returning()

  if (!question) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create question' })
  }

  await db.insert(questionOptions).values(
    options.map((opt, index) => ({
      questionId: question.id,
      optionText: opt.text,
      isCorrect: opt.isCorrect,
      sortOrder: index
    }))
  )

  return question
})
