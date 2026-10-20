import { eq, inArray } from 'drizzle-orm'
import { db } from '../../../database/client'
import { subjects, questions, questionOptions, documents } from '../../../database/schema'
import { deleteQuestionImage } from '../../../utils/uploads'
import { deleteDocumentFile } from '../../../utils/document-storage'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const id = Number(getRouterParam(event, 'id'))

  const [subject] = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1)
  if (!subject) {
    throw createError({ statusCode: 404, statusMessage: 'Subject not found' })
  }

  // Gather every file that will be orphaned if the delete succeeds, before touching the DB —
  // if it fails (FK restrict below) none of this is used.
  const subjectQuestions = await db.select().from(questions).where(eq(questions.subjectId, id))
  const questionIds = subjectQuestions.map(q => q.id)
  const optionRows = questionIds.length
    ? await db.select().from(questionOptions).where(inArray(questionOptions.questionId, questionIds))
    : []
  const documentRows = await db.select().from(documents).where(eq(documents.subjectId, id))

  const imagePaths = [
    ...subjectQuestions.map(q => q.imagePath),
    ...subjectQuestions.map(q => q.workedSolutionImagePath).filter((p): p is string => p !== null),
    ...optionRows.map(o => o.optionImagePath).filter((p): p is string => p !== null)
  ]

  try {
    // Cascades through sections, questions, question_options, open_question_sets/questions and
    // documents (all onDelete: 'cascade' from subjectId). Blocked — the whole statement rolls
    // back atomically — if any quiz session, paper section or discussion attempt ever referenced
    // this subject (those are onDelete: 'restrict' to protect history), surfaced below as a 409.
    await db.delete(subjects).where(eq(subjects.id, id))
  } catch (err) {
    if (err instanceof Error && /FOREIGN KEY constraint failed/i.test(err.message)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Can\'t delete — students have already used this subject (a session, a mock paper, or a discussion activity). Unpublish it instead to hide it.'
      })
    }
    throw err
  }

  for (const path of imagePaths) {
    await deleteQuestionImage(path).catch(() => {})
  }
  for (const doc of documentRows) {
    await deleteDocumentFile(doc.filePath).catch(() => {})
  }

  return { ok: true }
})
