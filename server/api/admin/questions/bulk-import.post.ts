import AdmZip from 'adm-zip'
import { parse } from 'csv-parse/sync'
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { questions, sections, subjectTags } from '../../../database/schema'
import { parseMultipartForm } from '../../../utils/multipart'
import { saveQuestionImage } from '../../../utils/uploads'
import { normalizeTagName, setQuestionTags } from '../../../utils/subject-tags'

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

  const importType = fields.type === 'self_marked_image' ? 'self_marked_image' : 'multiple_choice'

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

  const errors: string[] = []
  const now = Date.now()
  const createdIds: number[] = []

  async function saveZipImage(filename: string) {
    const entry = imagesByName.get(filename)!
    return saveQuestionImage({ data: entry.getData(), type: EXTENSION_MIME[extensionOf(entry.entryName)]! })
  }

  // Optional in both import types — leave the column out, or a row's cell blank, for no mark scheme.
  function validateMarkScheme(row: Record<string, string>, rowNumber: number) {
    const filename = row.mark_scheme_image_filename?.trim()
    if (filename && !imagesByName.has(filename)) {
      errors.push(`Row ${rowNumber}: no mark scheme image named "${filename}" found in the zip`)
    }
  }

  async function saveMarkScheme(row: Record<string, string>) {
    const filename = row.mark_scheme_image_filename?.trim()
    return filename ? saveZipImage(filename) : null
  }

  // Optional `tags` column in both import types: semicolon-separated names from this subject's
  // tag list, matched case-insensitively (e.g. "Vectors; proof by induction"). Unknown names fail
  // the import — tags must already exist on the subject (add or import them there first).
  const subjectTagRows = await db.select({ id: subjectTags.id, name: subjectTags.name }).from(subjectTags)
    .where(eq(subjectTags.subjectId, section.subjectId))
  const tagIdByName = new Map(subjectTagRows.map(t => [t.name.toLowerCase(), t.id]))
  const tagIdsByRow = new Map<number, number[]>()

  function validateTags(row: Record<string, string>, index: number, rowNumber: number) {
    const names = (row.tags ?? '').split(';').map(normalizeTagName).filter(Boolean)
    const ids = new Set<number>()
    for (const name of names) {
      const id = tagIdByName.get(name.toLowerCase())
      if (id === undefined) errors.push(`Row ${rowNumber}: "${name}" isn't one of this subject's tags`)
      else ids.add(id)
    }
    tagIdsByRow.set(index, [...ids])
  }

  function applyTags(questionId: number, index: number) {
    const ids = tagIdsByRow.get(index) ?? []
    if (ids.length > 0) setQuestionTags(questionId, ids)
  }

  if (importType === 'multiple_choice') {
    if (!('image_filename' in records[0]!) || !('correct_answer' in records[0]!)) {
      throw createError({ statusCode: 400, statusMessage: 'CSV must have image_filename and correct_answer columns' })
    }

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

      const explanationFilename = row.explanation_image_filename?.trim()
      if (explanationFilename && !imagesByName.has(explanationFilename)) {
        errors.push(`Row ${rowNumber}: no explanation image named "${explanationFilename}" found in the zip`)
      }

      validateMarkScheme(row, rowNumber)
      validateTags(row, index, rowNumber)
    })

    if (errors.length > 0) {
      throw createError({ statusCode: 400, statusMessage: 'CSV validation failed', data: { errors } })
    }

    for (const [index, row] of records.entries()) {
      const entry = imagesByName.get(row.image_filename!.trim())!
      const type = EXTENSION_MIME[extensionOf(entry.entryName)]!
      const imagePath = await saveQuestionImage({ data: entry.getData(), type })

      const explanationFilename = row.explanation_image_filename?.trim()
      let workedSolutionImagePath: string | null = null
      if (explanationFilename) {
        const explanationEntry = imagesByName.get(explanationFilename)!
        workedSolutionImagePath = await saveQuestionImage({
          data: explanationEntry.getData(),
          type: EXTENSION_MIME[extensionOf(explanationEntry.entryName)]!
        })
      }

      const [question] = await db.insert(questions).values({
        subjectId: section.subjectId,
        sectionId,
        imagePath,
        workedSolutionImagePath,
        markSchemeImagePath: await saveMarkScheme(row),
        type: 'multiple_choice',
        optionFormat: 'image',
        correctAnswerText: row.correct_answer!.trim(),
        createdAt: now,
        updatedAt: now
      }).returning()

      applyTags(question!.id, index)
      createdIds.push(question!.id)
    }
  } else {
    if (!('question_image_filename' in records[0]!) || !('answer_image_filename' in records[0]!)) {
      throw createError({ statusCode: 400, statusMessage: 'CSV must have question_image_filename and answer_image_filename columns' })
    }

    records.forEach((row, index) => {
      const rowNumber = index + 2 // +1 for 0-index, +1 for the header row
      const questionImageFilename = row.question_image_filename?.trim()
      const answerImageFilename = row.answer_image_filename?.trim()

      if (!questionImageFilename) {
        errors.push(`Row ${rowNumber}: question_image_filename is required`)
      } else if (!imagesByName.has(questionImageFilename)) {
        errors.push(`Row ${rowNumber}: no image named "${questionImageFilename}" found in the zip`)
      }
      if (!answerImageFilename) {
        errors.push(`Row ${rowNumber}: answer_image_filename is required`)
      } else if (!imagesByName.has(answerImageFilename)) {
        errors.push(`Row ${rowNumber}: no image named "${answerImageFilename}" found in the zip`)
      }

      validateMarkScheme(row, rowNumber)
      validateTags(row, index, rowNumber)
    })

    if (errors.length > 0) {
      throw createError({ statusCode: 400, statusMessage: 'CSV validation failed', data: { errors } })
    }

    for (const [index, row] of records.entries()) {
      const questionEntry = imagesByName.get(row.question_image_filename!.trim())!
      const imagePath = await saveQuestionImage({
        data: questionEntry.getData(),
        type: EXTENSION_MIME[extensionOf(questionEntry.entryName)]!
      })

      const answerEntry = imagesByName.get(row.answer_image_filename!.trim())!
      const workedSolutionImagePath = await saveQuestionImage({
        data: answerEntry.getData(),
        type: EXTENSION_MIME[extensionOf(answerEntry.entryName)]!
      })

      const [question] = await db.insert(questions).values({
        subjectId: section.subjectId,
        sectionId,
        imagePath,
        workedSolutionImagePath,
        markSchemeImagePath: await saveMarkScheme(row),
        type: 'self_marked_image',
        createdAt: now,
        updatedAt: now
      }).returning()

      applyTags(question!.id, index)
      createdIds.push(question!.id)
    }
  }

  return { imported: createdIds.length, questionIds: createdIds }
})
