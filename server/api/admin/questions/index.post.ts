import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { questions, questionOptions, sections } from '../../../database/schema'
import { parseMultipartForm } from '../../../utils/multipart'
import { saveQuestionImage } from '../../../utils/uploads'
import { optionsSchema, parseQuestionType, parseDifficulty, parseFreeResponseFields, emptyFreeResponseFields } from '../../../utils/question-validation'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const { fields, files } = await parseMultipartForm(event)

  const sectionId = Number(fields.sectionId)
  if (!sectionId) {
    throw createError({ statusCode: 400, statusMessage: 'sectionId is required' })
  }

  const [section] = await db.select().from(sections).where(eq(sections.id, sectionId)).limit(1)
  if (!section) {
    throw createError({ statusCode: 400, statusMessage: 'Section not found' })
  }
  const subjectId = section.subjectId

  if (!files.image) {
    throw createError({ statusCode: 400, statusMessage: 'Question image is required' })
  }

  const type = parseQuestionType(fields)
  const difficulty = parseDifficulty(fields)

  let options: { text: string, isCorrect: boolean }[] = []
  let freeResponseFields = emptyFreeResponseFields

  if (type === 'multiple_choice') {
    try {
      options = optionsSchema.parse(JSON.parse(fields.options || '[]'))
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: err instanceof Error ? err.message : 'Invalid options' })
    }
  } else {
    freeResponseFields = parseFreeResponseFields(fields)
  }

  const imagePath = await saveQuestionImage(files.image)
  const workedSolutionImagePath = files.workedSolutionImage ? await saveQuestionImage(files.workedSolutionImage) : null
  const now = Date.now()

  const [question] = await db.insert(questions).values({
    subjectId,
    sectionId,
    imagePath,
    workedSolutionImagePath,
    hintText: fields.hintText || null,
    difficulty,
    type,
    ...freeResponseFields,
    createdAt: now,
    updatedAt: now
  }).returning()

  if (!question) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create question' })
  }

  if (type === 'multiple_choice') {
    await db.insert(questionOptions).values(
      options.map((opt, index) => ({
        questionId: question.id,
        optionText: opt.text,
        isCorrect: opt.isCorrect,
        sortOrder: index
      }))
    )
  }

  return question
})
