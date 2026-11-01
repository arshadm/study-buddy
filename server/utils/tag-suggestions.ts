import { readFile } from 'node:fs/promises'
import { and, asc, eq, inArray } from 'drizzle-orm'
import sharp from 'sharp'
import { db } from '../database/client'
import { questions, questionTags, subjects, subjectTags } from '../database/schema'
import { suggestTagNames, type SuggestionImage } from './claude-cli'
import { resolveSafeUploadPath } from './uploads'

// Downscales before sending — a full-resolution scan costs far more tokens than it adds accuracy.
async function toSuggestionImage(label: string, data: Buffer): Promise<SuggestionImage> {
  const resized = await sharp(data)
    .rotate()
    .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()
  return { label, data: resized, mediaType: 'image/webp' }
}

export async function imageFromUpload(label: string, data: Buffer) {
  return toSuggestionImage(label, data)
}

export async function imageFromStoredPath(label: string, relativePath: string | null) {
  if (!relativePath) return null
  const absolute = resolveSafeUploadPath(relativePath)
  if (!absolute) return null
  const data = await readFile(absolute).catch(() => null)
  return data ? toSuggestionImage(label, data) : null
}

// Asks Claude for tags and maps the answer back onto this subject's tag list (case-insensitive),
// silently dropping anything not on it — so a suggestion can never break the "tags come from the
// question's own subject" rule. Returns [] without calling Claude when the subject has no tags.
export async function suggestTagIdsForImages(subjectId: number, images: SuggestionImage[]): Promise<number[]> {
  if (images.length === 0) return []
  const tags = await db.select({ id: subjectTags.id, name: subjectTags.name }).from(subjectTags)
    .where(eq(subjectTags.subjectId, subjectId))
  if (tags.length === 0) return []

  const [subject] = await db.select({ name: subjects.name }).from(subjects).where(eq(subjects.id, subjectId)).limit(1)
  const names = await suggestTagNames(images, tags.map(t => t.name), subject?.name ?? 'exam')

  const idByName = new Map(tags.map(t => [t.name.toLowerCase(), t.id]))
  const ids = names.map(n => idByName.get(n.trim().toLowerCase())).filter((id): id is number => id !== undefined)
  return [...new Set(ids)]
}

async function imagesForQuestion(question: typeof questions.$inferSelect) {
  const images = await Promise.all([
    imageFromStoredPath('Question', question.imagePath),
    imageFromStoredPath('Worked solution', question.workedSolutionImagePath),
    imageFromStoredPath('Mark scheme', question.markSchemeImagePath)
  ])
  return images.filter((img): img is SuggestionImage => img !== null)
}

// --- Background queue (bulk import) ---
//
// One Claude call takes several seconds, so bulk-imported questions are tagged after the import
// request has returned: rows are marked 'pending' and a single in-process worker drains them one
// at a time. State lives on the row, not in memory, so a restart just resumes the queue.

let draining = false

export async function queueAutoTagging(questionIds: number[]) {
  if (questionIds.length === 0) return
  await db.update(questions).set({ autoTagStatus: 'pending' }).where(inArray(questions.id, questionIds))
  void drainAutoTagQueue()
}

export async function drainAutoTagQueue() {
  if (draining) return
  draining = true
  try {
    for (;;) {
      const [question] = await db.select().from(questions)
        .where(eq(questions.autoTagStatus, 'pending'))
        .orderBy(asc(questions.id))
        .limit(1)
      if (!question) break

      try {
        const tagIds = await suggestTagIdsForImages(question.subjectId, await imagesForQuestion(question))
        // Adds to whatever the question has now — an admin may have tagged it by hand while it
        // waited in the queue, and those choices are kept.
        if (tagIds.length > 0) {
          await db.insert(questionTags).values(tagIds.map(tagId => ({ questionId: question.id, tagId }))).onConflictDoNothing()
        }
        await db.update(questions).set({ autoTagStatus: 'done' })
          .where(and(eq(questions.id, question.id), eq(questions.autoTagStatus, 'pending')))
      } catch (err) {
        console.warn(`[study-buddy] Auto-tagging question ${question.id} failed:`, err instanceof Error ? err.message : err)
        await db.update(questions).set({ autoTagStatus: 'failed' }).where(eq(questions.id, question.id))
      }
    }
  } finally {
    draining = false
  }
}
