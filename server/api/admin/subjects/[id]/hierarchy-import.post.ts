// Bulk-creates a subject's chapter/section hierarchy from a CSV with chapter_title/section_name
// columns — one row per section, rows sharing the same chapter_title grouped under one chapter.
// Mirrors the validate-everything-then-write-nothing-on-error pattern used by the question
// bulk-import endpoint.

import { parse } from 'csv-parse/sync'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../../database/client'
import { documents, sections, subjects } from '../../../../database/schema'
import { parseMultipartForm } from '../../../../utils/multipart'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const subjectId = Number(getRouterParam(event, 'id'))

  const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1)
  if (!subject) {
    throw createError({ statusCode: 404, statusMessage: 'Subject not found' })
  }

  const { files } = await parseMultipartForm(event)
  if (!files.file) {
    throw createError({ statusCode: 400, statusMessage: 'A CSV file is required' })
  }

  let records: Record<string, string>[]
  try {
    records = parse(files.file.data.toString('utf-8'), {
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
  if (!('chapter_title' in records[0]!) || !('section_name' in records[0]!)) {
    throw createError({ statusCode: 400, statusMessage: 'CSV must have chapter_title and section_name columns' })
  }

  const existingChapters = await db.select({ id: documents.id, title: documents.title })
    .from(documents)
    .where(and(eq(documents.subjectId, subjectId), eq(documents.role, 'chapter')))
  const existingChapterByTitle = new Map(existingChapters.map(c => [c.title, c.id]))

  const existingSections = await db.select({ name: sections.name })
    .from(sections)
    .where(eq(sections.subjectId, subjectId))
  const existingSectionNames = new Set(existingSections.map(s => s.name))

  const errors: string[] = []
  const seenSectionNames = new Set<string>()

  records.forEach((row, index) => {
    const rowNumber = index + 2 // +1 for 0-index, +1 for the header row
    const chapterTitle = row.chapter_title?.trim()
    const sectionName = row.section_name?.trim()

    if (!chapterTitle) {
      errors.push(`Row ${rowNumber}: chapter_title is required`)
    }
    if (!sectionName) {
      errors.push(`Row ${rowNumber}: section_name is required`)
    } else if (existingSectionNames.has(sectionName)) {
      errors.push(`Row ${rowNumber}: a section named "${sectionName}" already exists in this subject`)
    } else if (seenSectionNames.has(sectionName)) {
      errors.push(`Row ${rowNumber}: section_name "${sectionName}" is duplicated elsewhere in this CSV`)
    } else {
      seenSectionNames.add(sectionName)
    }
  })

  if (errors.length > 0) {
    throw createError({ statusCode: 400, statusMessage: 'CSV validation failed', data: { errors } })
  }

  const now = Date.now()
  let chaptersCreated = 0
  const sectionIds: number[] = []

  for (const row of records) {
    const chapterTitle = row.chapter_title!.trim()
    const sectionName = row.section_name!.trim()

    let chapterDocumentId = existingChapterByTitle.get(chapterTitle)
    if (!chapterDocumentId) {
      const [chapter] = await db.insert(documents).values({
        subjectId,
        role: 'chapter',
        title: chapterTitle,
        filePath: null,
        extractedText: null,
        extractionError: null,
        // New chapters start unpublished, same as the "Add chapter" flow — an admin opts in
        // once its sections and questions are ready.
        isActive: false,
        createdAt: now,
        updatedAt: now
      }).returning({ id: documents.id })
      chapterDocumentId = chapter!.id
      existingChapterByTitle.set(chapterTitle, chapterDocumentId)
      chaptersCreated++
    }

    const [section] = await db.insert(sections).values({
      subjectId,
      name: sectionName,
      description: null,
      chapterDocumentId,
      createdAt: now,
      updatedAt: now
    }).returning({ id: sections.id })
    sectionIds.push(section!.id)
  }

  return { chaptersCreated, sectionsCreated: sectionIds.length, sectionIds }
})
