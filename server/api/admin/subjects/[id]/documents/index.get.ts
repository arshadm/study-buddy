import { asc, eq } from 'drizzle-orm'
import { db } from '../../../../../database/client'
import { documents } from '../../../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const subjectId = Number(getRouterParam(event, 'id'))

  // extractedText can be large and is only needed when building LLM prompts, not for listing.
  return db.select({
    id: documents.id,
    subjectId: documents.subjectId,
    role: documents.role,
    title: documents.title,
    filePath: documents.filePath,
    extractionError: documents.extractionError,
    isActive: documents.isActive,
    createdAt: documents.createdAt,
    updatedAt: documents.updatedAt
  }).from(documents)
    .where(eq(documents.subjectId, subjectId))
    .orderBy(asc(documents.role), asc(documents.title))
})
