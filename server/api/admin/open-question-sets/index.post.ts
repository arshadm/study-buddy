import { and, eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { openQuestionSets, openQuestions, sections, documents } from '../../../database/schema'
import { bodySchema } from '../../../utils/open-question-set-validation'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const body = await readValidatedBody(event, bodySchema.parse)

  const [section] = await db.select().from(sections).where(eq(sections.id, body.sectionId)).limit(1)
  if (!section) {
    throw createError({ statusCode: 400, statusMessage: 'Section not found' })
  }

  if (body.chapterDocumentId) {
    const [chapter] = await db.select().from(documents)
      .where(and(eq(documents.id, body.chapterDocumentId), eq(documents.subjectId, section.subjectId), eq(documents.role, 'chapter')))
      .limit(1)
    if (!chapter) {
      throw createError({ statusCode: 400, statusMessage: 'Chapter document not found for this subject' })
    }
  }

  const now = Date.now()

  const [set] = await db.insert(openQuestionSets).values({
    subjectId: section.subjectId,
    sectionId: body.sectionId,
    chapterDocumentId: body.chapterDocumentId ?? null,
    title: body.title,
    passageText: body.passageText || null,
    createdAt: now,
    updatedAt: now
  }).returning()

  if (!set) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create question set' })
  }

  await db.insert(openQuestions).values(
    body.questions.map((q, index) => ({
      setId: set.id,
      promptText: q.promptText,
      sortOrder: index,
      createdAt: now,
      updatedAt: now
    }))
  )

  return set
})
