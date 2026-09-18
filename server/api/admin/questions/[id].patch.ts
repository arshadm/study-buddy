import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { questions, questionOptions, sections } from '../../../database/schema'
import { parseMultipartForm } from '../../../utils/multipart'
import { saveQuestionImage, deleteQuestionImage } from '../../../utils/uploads'
import { optionsSchema, parseQuestionType, parseDifficulty, parseFreeResponseFields, emptyFreeResponseFields } from '../../../utils/question-validation'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const id = Number(getRouterParam(event, 'id'))
  const [existing] = await db.select().from(questions).where(eq(questions.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Question not found' })
  }

  const { fields, files } = await parseMultipartForm(event)

  const updates: Partial<typeof questions.$inferInsert> = { updatedAt: Date.now() }

  if (fields.sectionId) {
    const sectionId = Number(fields.sectionId)
    const [section] = await db.select().from(sections).where(eq(sections.id, sectionId)).limit(1)
    if (!section) {
      throw createError({ statusCode: 400, statusMessage: 'Section not found' })
    }
    updates.sectionId = sectionId
    updates.subjectId = section.subjectId
  }
  if ('hintText' in fields) updates.hintText = fields.hintText || null
  if ('difficulty' in fields) updates.difficulty = parseDifficulty(fields)

  let options: { text: string, isCorrect: boolean }[] | null = null

  if (fields.type) {
    const type = parseQuestionType(fields)
    updates.type = type

    if (type === 'multiple_choice') {
      try {
        options = optionsSchema.parse(JSON.parse(fields.options || '[]'))
      } catch (err) {
        throw createError({ statusCode: 400, statusMessage: err instanceof Error ? err.message : 'Invalid options' })
      }
      Object.assign(updates, emptyFreeResponseFields)
    } else {
      Object.assign(updates, parseFreeResponseFields(fields))
    }
  }

  let newImagePath: string | null = null
  if (files.image) {
    newImagePath = await saveQuestionImage(files.image)
    updates.imagePath = newImagePath
  }

  let workedSolutionReplaced = false
  if (files.workedSolutionImage) {
    updates.workedSolutionImagePath = await saveQuestionImage(files.workedSolutionImage)
    workedSolutionReplaced = true
  } else if (fields.removeWorkedSolutionImage === 'true') {
    updates.workedSolutionImagePath = null
    workedSolutionReplaced = true
  }

  await db.update(questions).set(updates).where(eq(questions.id, id))

  if (options) {
    await db.delete(questionOptions).where(eq(questionOptions.questionId, id))
    await db.insert(questionOptions).values(
      options.map((opt, index) => ({
        questionId: id,
        optionText: opt.text,
        isCorrect: opt.isCorrect,
        sortOrder: index
      }))
    )
  }

  if (newImagePath) {
    await deleteQuestionImage(existing.imagePath)
  }
  if (workedSolutionReplaced && existing.workedSolutionImagePath) {
    await deleteQuestionImage(existing.workedSolutionImagePath)
  }

  const [updated] = await db.select().from(questions).where(eq(questions.id, id)).limit(1)
  return updated
})
