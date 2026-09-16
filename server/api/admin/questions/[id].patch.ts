import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { questions, questionOptions } from '../../../database/schema'
import { parseMultipartForm } from '../../../utils/multipart'
import { saveQuestionImage, deleteQuestionImage } from '../../../utils/uploads'

const optionsSchema = z.array(z.object({
  text: z.string().min(1),
  isCorrect: z.boolean()
})).min(2).refine(opts => opts.filter(o => o.isCorrect).length === 1, {
  message: 'Exactly one option must be marked correct'
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const id = Number(getRouterParam(event, 'id'))
  const [existing] = await db.select().from(questions).where(eq(questions.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Question not found' })
  }

  const { fields, files } = await parseMultipartForm(event)

  const updates: Partial<typeof questions.$inferInsert> = { updatedAt: Date.now() }

  if (fields.subjectId) updates.subjectId = Number(fields.subjectId)
  if ('hintText' in fields) updates.hintText = fields.hintText || null

  let newImagePath: string | null = null
  if (files.image) {
    newImagePath = await saveQuestionImage(files.image)
    updates.imagePath = newImagePath
  }

  await db.update(questions).set(updates).where(eq(questions.id, id))

  if (fields.options) {
    let options
    try {
      options = optionsSchema.parse(JSON.parse(fields.options))
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: err instanceof Error ? err.message : 'Invalid options' })
    }

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

  const [updated] = await db.select().from(questions).where(eq(questions.id, id)).limit(1)
  return updated
})
