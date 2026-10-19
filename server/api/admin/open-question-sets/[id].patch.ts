import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../../database/client'
import { openQuestionSets, openQuestions, sections, documents } from '../../../database/schema'
import { bodySchema } from '../../../utils/open-question-set-validation'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'id'))

  const [existing] = await db.select().from(openQuestionSets).where(eq(openQuestionSets.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Question set not found' })
  }

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

  await db.update(openQuestionSets).set({
    subjectId: section.subjectId,
    sectionId: body.sectionId,
    chapterDocumentId: body.chapterDocumentId ?? null,
    title: body.title,
    passageText: body.passageText || null,
    updatedAt: now
  }).where(eq(openQuestionSets.id, id))

  const existingQuestions = await db.select({ id: openQuestions.id }).from(openQuestions)
    .where(and(eq(openQuestions.setId, id), eq(openQuestions.isActive, true)))
  const keptIds = new Set(body.questions.map(q => q.id).filter((qid): qid is number => qid !== undefined))

  const removedIds = existingQuestions.map(q => q.id).filter(qid => !keptIds.has(qid))
  if (removedIds.length > 0) {
    await db.update(openQuestions).set({ isActive: false, updatedAt: now }).where(inArray(openQuestions.id, removedIds))
  }

  for (const [index, q] of body.questions.entries()) {
    if (q.id !== undefined) {
      await db.update(openQuestions).set({ promptText: q.promptText, sortOrder: index, updatedAt: now })
        .where(and(eq(openQuestions.id, q.id), eq(openQuestions.setId, id)))
    } else {
      await db.insert(openQuestions).values({ setId: id, promptText: q.promptText, sortOrder: index, createdAt: now, updatedAt: now })
    }
  }

  const [updated] = await db.select().from(openQuestionSets).where(eq(openQuestionSets.id, id)).limit(1)
  return updated
})
