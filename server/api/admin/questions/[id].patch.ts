import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { questions, questionOptions, sections } from '../../../database/schema'
import { parseMultipartForm } from '../../../utils/multipart'
import { saveQuestionImage, deleteQuestionImage } from '../../../utils/uploads'
import { parseQuestionType, parseOptionFormat, parseDifficulty } from '../../../utils/question-validation'
import { buildQuestionOptions } from '../../../utils/build-question-options'

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

  const resolvedType = fields.type ? parseQuestionType(fields) : existing.type
  let newOptions: Awaited<ReturnType<typeof buildQuestionOptions>> | null = null
  let clearOptions = false

  if (fields.type) {
    updates.type = resolvedType

    if (resolvedType === 'multiple_choice') {
      const optionFormat = parseOptionFormat(fields)
      updates.optionFormat = optionFormat
      newOptions = await buildQuestionOptions(optionFormat, fields, files)
    } else {
      clearOptions = true
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

  const resolvedWorkedSolution = workedSolutionReplaced ? updates.workedSolutionImagePath : existing.workedSolutionImagePath
  if (resolvedType === 'self_marked_image' && !resolvedWorkedSolution) {
    throw createError({ statusCode: 400, statusMessage: 'A worked solution image is required for self-marked questions' })
  }

  await db.update(questions).set(updates).where(eq(questions.id, id))

  let oldOptions: { optionImagePath: string | null }[] = []
  if (newOptions || clearOptions) {
    oldOptions = await db.select({ optionImagePath: questionOptions.optionImagePath }).from(questionOptions).where(eq(questionOptions.questionId, id))
    await db.delete(questionOptions).where(eq(questionOptions.questionId, id))
  }

  if (newOptions) {
    await db.insert(questionOptions).values(
      newOptions.map((opt, index) => ({
        questionId: id,
        optionText: opt.optionText,
        optionImagePath: opt.optionImagePath,
        isCorrect: opt.isCorrect,
        sortOrder: index
      }))
    )
  }

  const reusedImagePaths = new Set((newOptions ?? []).map(o => o.optionImagePath).filter((p): p is string => p !== null))
  for (const opt of oldOptions) {
    if (opt.optionImagePath && !reusedImagePaths.has(opt.optionImagePath)) {
      await deleteQuestionImage(opt.optionImagePath)
    }
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
