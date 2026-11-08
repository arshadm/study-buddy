// Claude tag and difficulty suggestions for the question form. Multipart: subjectId (required), plus any
// newly-chosen images (image / workedSolutionImage / markSchemeImage). questionId fills in the
// question's stored images for any slot without a new upload, so editing an existing question
// can be re-suggested without re-uploading. Suggestions only — nothing is saved here.

import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { questions } from '../../../database/schema'
import { parseMultipartForm } from '../../../utils/multipart'
import { ClaudeAuthError, ClaudeGradingError, type SuggestionImage } from '../../../utils/claude-cli'
import { imageFromStoredPath, imageFromUpload, suggestForImages } from '../../../utils/tag-suggestions'

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp'])

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const { fields, files } = await parseMultipartForm(event)

  const subjectId = Number(fields.subjectId)
  if (!subjectId) throw createError({ statusCode: 400, statusMessage: 'subjectId is required' })

  const existing = fields.questionId
    ? (await db.select().from(questions).where(eq(questions.id, Number(fields.questionId))).limit(1))[0]
    : undefined

  const slots = [
    { label: 'Question', file: files.image, stored: existing?.imagePath ?? null },
    { label: 'Worked solution', file: files.workedSolutionImage, stored: existing?.workedSolutionImagePath ?? null },
    { label: 'Mark scheme', file: files.markSchemeImage, stored: existing?.markSchemeImagePath ?? null }
  ]

  const images: SuggestionImage[] = []
  for (const slot of slots) {
    if (slot.file) {
      if (!slot.file.type || !ALLOWED.has(slot.file.type)) throw createError({ statusCode: 400, statusMessage: 'Images must be PNG, JPEG or WebP' })
      images.push(await imageFromUpload(slot.label, slot.file.data))
    } else {
      const img = await imageFromStoredPath(slot.label, slot.stored)
      if (img) images.push(img)
    }
  }
  if (!images.some(img => img.label === 'Question')) {
    throw createError({ statusCode: 400, statusMessage: 'A question image is needed to suggest tags' })
  }

  try {
    return await suggestForImages(subjectId, images, existing?.id)
  } catch (err) {
    if (err instanceof ClaudeAuthError) throw createError({ statusCode: 503, statusMessage: 'Claude needs re-authentication — see the banner on the admin dashboard' })
    if (err instanceof ClaudeGradingError) throw createError({ statusCode: 502, statusMessage: 'Tag suggestion failed — try again' })
    throw err
  }
})
