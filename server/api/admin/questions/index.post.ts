import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { questions, questionOptions, sections } from '../../../database/schema'
import { parseMultipartForm } from '../../../utils/multipart'
import { saveQuestionImage } from '../../../utils/uploads'
import { parseQuestionType, parseOptionFormat, parseCorrectAnswerText, parseDifficulty } from '../../../utils/question-validation'
import { buildQuestionOptions } from '../../../utils/build-question-options'

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
  const optionFormat = type === 'multiple_choice' ? parseOptionFormat(fields) : 'text'

  let options: ReturnType<typeof buildQuestionOptions> = []
  let correctAnswerText: string | null = null
  if (type === 'multiple_choice' && optionFormat === 'text') {
    options = buildQuestionOptions(fields)
  } else if (type === 'multiple_choice' && optionFormat === 'image') {
    correctAnswerText = parseCorrectAnswerText(fields)
  } else if (!files.workedSolutionImage) {
    throw createError({ statusCode: 400, statusMessage: 'A worked solution image is required for self-marked questions' })
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
    optionFormat,
    correctAnswerText,
    createdAt: now,
    updatedAt: now
  }).returning()

  if (!question) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create question' })
  }

  if (options.length > 0) {
    await db.insert(questionOptions).values(
      options.map((opt, index) => ({
        questionId: question.id,
        optionText: opt.optionText,
        optionImagePath: opt.optionImagePath,
        isCorrect: opt.isCorrect,
        sortOrder: index
      }))
    )
  }

  return question
})
