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

  const { files } = await parseMultipartForm(event)
  if (!files.file) {
    throw createError({ statusCode: 400, statusMessage: 'A document file is required' })
  }

  const mimeType = documentMimeType(files.file)
  const filePath = await saveDocumentFile(files.file)
  const { text, error } = await extractDocumentText(files.file.data, mimeType)

  const [document] = await db.update(documents).set({
    filePath,
    extractedText: text,
    extractionError: error,
    updatedAt: Date.now()
  }).where(eq(documents.id, docId)).returning({
    id: documents.id,
    subjectId: documents.subjectId,
    role: documents.role,
    title: documents.title,
    filePath: documents.filePath,
    extractionError: documents.extractionError,
    createdAt: documents.createdAt,
    updatedAt: documents.updatedAt
  })

  await deleteDocumentFile(existing.filePath)

  return document
})
