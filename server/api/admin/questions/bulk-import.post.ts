import AdmZip from 'adm-zip'
import { parse } from 'csv-parse/sync'
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { questions, sections } from '../../../database/schema'
import { parseMultipartForm } from '../../../utils/multipart'
import { saveQuestionImage } from '../../../utils/uploads'

const EXTENSION_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp'
}

function extensionOf(filename: string) {
  const match = /\.([a-z0-9]+)$/i.exec(filename)
  return match ? match[1]!.toLowerCase() : ''
}

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const { fields, files } = await parseMultipartForm(event)

  const sectionId = Number(fields.sectionId)
  if (!sectionId) {
    throw createError({ statusCode: 400, statusMessage: 'sectionId is required' })
  }
  const [section] = await db.select().from(sections).where(eq(sections.id, sectionId)).limit(1)
  if (!section) {
    throw createError({ statusCode: 400, statusMessage: 'Section not found' })
  }

  if (!files.zip) {
    throw createError({ statusCode: 400, statusMessage: 'A zip file is required' })
  }

  let zip: AdmZip
  try {
    zip = new AdmZip(files.zip.data)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Could not read zip file' })
  }

  const entries = zip.getEntries().filter(e => !e.isDirectory && !e.entryName.split('/').pop()?.startsWith('.'))

  const csvEntries = entries.filter(e => extensionOf(e.entryName) === 'csv')
  if (csvEntries.length !== 1) {
    throw createError({ statusCode: 400, statusMessage: `Zip must contain exactly one CSV file (found ${csvEntries.length})` })
  }

  // Matched by basename so the CSV can reference "q1.png" even if the zip nests images in a folder.
  const imagesByName = new Map<string, typeof entries[number]>()
  for (const entry of entries) {
    if (entry === csvEntries[0]) continue
    const ext = extensionOf(entry.entryName)
    if (!(ext in EXTENSION_MIME)) continue
    const basename = entry.entryName.split('/').pop()!
    imagesByName.set(basename, entry)
  }

  let records: Record<string, string>[]
  try {
    records = parse(csvEntries[0]!.getData().toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true
    })
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: `Could not parse CSV: ${err instanceof Error ? err.message : 'invalid format'}` })
  }

  if (records.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'CSV has no rows' })
  }
  if (!('image_filename' in records[0]!) || !('correct_answer' in records[0]!)) {
    throw createError({ statusCode: 400, statusMessage: 'CSV must have image_filename and correct_answer columns' })
  }

  const errors: string[] = []
  records.forEach((row, index) => {
    const rowNumber = index + 2 // +1 for 0-index, +1 for the header row
    const imageFilename = row.image_filename?.trim()
    const correctAnswer = row.correct_answer?.trim()

    if (!imageFilename) {
      errors.push(`Row ${rowNumber}: image_filename is required`)
    } else if (!imagesByName.has(imageFilename)) {
      errors.push(`Row ${rowNumber}: no image named "${imageFilename}" found in the zip`)
    }
    if (!correctAnswer) {
      errors.push(`Row ${rowNumber}: correct_answer is required`)
    }
  })

  if (errors.length > 0) {
    throw createError({ statusCode: 400, statusMessage: 'CSV validation failed', data: { errors } })
  }

  const now = Date.now()
  const createdIds: number[] = []

  for (const row of records) {
    const entry = imagesByName.get(row.image_filename!.trim())!
    const type = EXTENSION_MIME[extensionOf(entry.entryName)]!
    const imagePath = await saveQuestionImage({ data: entry.getData(), type })

    const [question] = await db.insert(questions).values({
      subjectId: section.subjectId,
      sectionId,
      imagePath,
      type: 'multiple_choice',
      optionFormat: 'image',
      correctAnswerText: row.correct_answer!.trim(),
      createdAt: now,
      updatedAt: now
    }).returning()

    createdIds.push(question!.id)
  }

  return { imported: createdIds.length, questionIds: createdIds }
})
