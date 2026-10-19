import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { documents } from '../../../database/schema'
import { deleteDocumentFile } from '../../../utils/document-storage'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const docId = Number(getRouterParam(event, 'docId'))

  const [document] = await db.delete(documents).where(eq(documents.id, docId)).returning()
  if (!document) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  await deleteDocumentFile(document.filePath)

  return { ok: true }
})
