import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { documents } from '../../../database/schema'
import { parseMultipartForm } from '../../../utils/multipart'
import { saveDocumentFile, deleteDocumentFile, documentMimeType } from '../../../utils/document-storage'
import { extractDocumentText } from '../../../utils/document-extraction'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const docId = Number(getRouterParam(event, 'docId'))

  const [existing] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  const { fields, files } = await parseMultipartForm(event)

  const updates: Partial<typeof documents.$inferInsert> = { updatedAt: Date.now() }

  if ('title' in fields) {
    const title = fields.title?.trim()
    if (!title) {
      throw createError({ statusCode: 400, statusMessage: 'title is required' })
    }
    updates.title = title
  }

  // Only 'chapter' docs can go without a file — syllabus/mark_scheme always require one
  // (enforced on create too), so removing theirs here would leave them in an invalid state.
  if (fields.removeFile === 'true' && existing.role !== 'chapter') {
    throw createError({ statusCode: 400, statusMessage: 'A document file is required for this role' })
  }

  let oldFilePath: string | null = null
  if (files.file) {
    const mimeType = documentMimeType(files.file)
    updates.filePath = await saveDocumentFile(files.file)
    const { text, error } = await extractDocumentText(files.file.data, mimeType)
    updates.extractedText = text
    updates.extractionError = error
    oldFilePath = existing.filePath
  } else if (fields.removeFile === 'true') {
    updates.filePath = null
    updates.extractedText = null
    updates.extractionError = null
    oldFilePath = existing.filePath
  }

  const [document] = await db.update(documents).set(updates).where(eq(documents.id, docId)).returning({
    id: documents.id,
    subjectId: documents.subjectId,
    role: documents.role,
    title: documents.title,
    filePath: documents.filePath,
    extractionError: documents.extractionError,
    createdAt: documents.createdAt,
    updatedAt: documents.updatedAt
  })

  if (oldFilePath) {
    await deleteDocumentFile(oldFilePath)
  }

  return document
})
