// Adds tags to a subject from a CSV with a `tag` column (one tag per row). Additive and safe to
// re-run: names the subject already has — or that repeat within the file — are skipped, not
// errors (case-insensitive). Malformed rows fail the whole import with nothing written, matching
// the other CSV imports.

import { parse } from 'csv-parse/sync'
import { eq } from 'drizzle-orm'
import { db } from '../../../../../database/client'
import { subjects, subjectTags } from '../../../../../database/schema'
import { parseMultipartForm } from '../../../../../utils/multipart'
import { MAX_TAG_LENGTH, normalizeTagName } from '../../../../../utils/subject-tags'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const subjectId = Number(getRouterParam(event, 'id'))

  const [subject] = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.id, subjectId)).limit(1)
  if (!subject) throw createError({ statusCode: 404, statusMessage: 'Subject not found' })

  const { files } = await parseMultipartForm(event)
  if (!files.file) throw createError({ statusCode: 400, statusMessage: 'A CSV file is required' })

  let records: Record<string, string>[]
  try {
    records = parse(files.file.data.toString('utf-8'), {
      columns: (header: string[]) => header.map(h => h.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      bom: true
    })
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: `Could not parse CSV: ${err instanceof Error ? err.message : 'invalid format'}` })
  }

  if (records.length === 0) throw createError({ statusCode: 400, statusMessage: 'CSV has no rows' })
  if (!('tag' in records[0]!)) throw createError({ statusCode: 400, statusMessage: 'CSV must have a "tag" column' })

  const existing = await db.select({ name: subjectTags.name }).from(subjectTags).where(eq(subjectTags.subjectId, subjectId))
  const seen = new Set(existing.map(t => t.name.toLowerCase()))

  const errors: string[] = []
  const toCreate: string[] = []
  let skipped = 0

  records.forEach((row, index) => {
    const rowNumber = index + 2 // +1 for 0-index, +1 for the header row
    const name = normalizeTagName(row.tag ?? '')
    if (!name) {
      errors.push(`Row ${rowNumber}: tag is empty`)
    } else if (name.length > MAX_TAG_LENGTH) {
      errors.push(`Row ${rowNumber}: "${name.slice(0, 20)}…" is longer than ${MAX_TAG_LENGTH} characters`)
    } else if (seen.has(name.toLowerCase())) {
      skipped++
    } else {
      seen.add(name.toLowerCase())
      toCreate.push(name)
    }
  })

  if (errors.length > 0) {
    throw createError({ statusCode: 400, statusMessage: 'CSV validation failed', data: { errors } })
  }

  if (toCreate.length > 0) {
    const now = Date.now()
    await db.insert(subjectTags).values(toCreate.map(name => ({ subjectId, name, createdAt: now })))
  }

  return { created: toCreate.length, skipped }
})
