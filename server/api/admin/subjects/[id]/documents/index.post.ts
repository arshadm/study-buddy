import { and, eq } from 'drizzle-orm'
import { db } from '../../../../../database/client'
import { documents, subjects } from '../../../../../database/schema'
import { parseMultipartForm } from '../../../../../utils/multipart'
import { saveDocumentFile, deleteDocumentFile, documentMimeType } from '../../../../../utils/document-storage'
import { extractDocumentText } from '../../../../../utils/document-extraction'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const subjectId = Number(getRouterParam(event, 'id'))

  const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1)
  if (!subject) {
    throw createError({ statusCode: 404, statusMessage: 'Subject not found' })
  }

  const { fields, files } = await parseMultipartForm(event)

  const role = fields.role
  if (role !== 'syllabus' && role !== 'mark_scheme' && role !== 'chapter') {
    throw createError({ statusCode: 400, statusMessage: 'role must be syllabus, mark_scheme or chapter' })
  }

  const title = fields.title?.trim()
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'title is required' })
  }

  // Chapter notes are optional — a chapter can be created first and have its notes added
  // later; syllabus/mark_scheme always require a file.
  if (role !== 'chapter' && !files.file) {
    throw createError({ statusCode: 400, statusMessage: 'A document file is required' })
  }

  // syllabus/mark_scheme are single-current-version per subject — replace any existing one.
  let replaced: { id: number, filePath: string | null } | null = null
  if (role !== 'chapter') {
    const [existing] = await db.select({ id: documents.id, filePath: documents.filePath })
      .from(documents)
      .where(and(eq(documents.subjectId, subjectId), eq(documents.role, role)))
      .limit(1)
    replaced = existing ?? null
  }

  let filePath: string | null = null
  let text: string | null = null
  let error: string | null = null
  if (files.file) {
    const mimeType = documentMimeType(files.file)
    filePath = await saveDocumentFile(files.file)
    const extracted = await extractDocumentText(files.file.data, mimeType)
    text = extracted.text
    error = extracted.error
  }
  const now = Date.now()

  const [document] = await db.insert(documents).values({
    subjectId,
    role,
    title,
    filePath,
    extractedText: text,
    extractionError: error,
    createdAt: now,
    updatedAt: now
  }).returning({
    id: documents.id,
    subjectId: documents.subjectId,
    role: documents.role,
    title: documents.title,
    filePath: documents.filePath,
    extractionError: documents.extractionError,
    createdAt: documents.createdAt,
    updatedAt: documents.updatedAt
  })

  if (replaced) {
    await db.delete(documents).where(eq(documents.id, replaced.id))
    await deleteDocumentFile(replaced.filePath)
  }

  return document
})
