import { readFile } from 'node:fs/promises'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import sharp from 'sharp'
import { db } from '../database/client'
import { questions, questionTags, subjects, subjectTags } from '../database/schema'
import { suggestTagsAndDifficulty, type SuggestionImage } from './claude-cli'
import { resolveSafeUploadPath } from './uploads'
import { bandForNewScore, rebandSubject } from './difficulty-bands'

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

// Asks Claude for tags and a 1–100 difficulty score; `difficulty` is where that score would band
// among the subject's other questions (excludeQuestionId: the question being edited). Tags are mapped back onto this subject's tag list
// (case-insensitive), silently dropping anything not on it — so a suggestion can never break the
// "tags come from the question's own subject" rule. Claude is still asked when the subject has no
// tags, for the difficulty.
export async function suggestForImages(subjectId: number, images: SuggestionImage[], excludeQuestionId?: number): Promise<{ tagIds: number[], difficulty: number | null, difficultyScore: number | null }> {
  if (images.length === 0) return { tagIds: [], difficulty: null, difficultyScore: null }
  const tags = await db.select({ id: subjectTags.id, name: subjectTags.name }).from(subjectTags)
    .where(eq(subjectTags.subjectId, subjectId))

  const [subject] = await db.select({ name: subjects.name }).from(subjects).where(eq(subjects.id, subjectId)).limit(1)
  const suggestion = await suggestTagsAndDifficulty(images, tags.map(t => t.name), subject?.name ?? 'exam')

  const idByName = new Map(tags.map(t => [t.name.toLowerCase(), t.id]))
  const ids = suggestion.tags.map(n => idByName.get(n.trim().toLowerCase())).filter((id): id is number => id !== undefined)
  const difficulty = await bandForNewScore(subjectId, suggestion.difficultyScore, excludeQuestionId)
  return { tagIds: [...new Set(ids)], difficulty, difficultyScore: suggestion.difficultyScore }
}

export async function imagesForQuestion(question: typeof questions.$inferSelect) {
  const images = await Promise.all([
    imageFromStoredPath('Question', question.imagePath),
    imageFromStoredPath('Worked solution', question.workedSolutionImagePath),
    imageFromStoredPath('Mark scheme', question.markSchemeImagePath)
  ])
  return images.filter((img): img is SuggestionImage => img !== null)
}

// --- Background queue (bulk import) ---
//
// One Claude call takes several seconds, so bulk-imported questions are tagged and rated after
// the import request has returned: rows are marked 'pending' and a single in-process worker
// drains them one at a time. State lives on the row, not in memory, so a restart just resumes the
// queue. The worker only fills gaps — tags if the question has none, difficulty if it's unset —
// so anything an admin set (by CSV or by hand while it waited) is never overwritten. It always
// stores Claude's score, which feeds the subject's ranking either way.

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
        const { tagIds, difficultyScore } = await suggestForImages(question.subjectId, await imagesForQuestion(question), question.id)
        const [existingTag] = await db.select({ tagId: questionTags.tagId }).from(questionTags)
          .where(eq(questionTags.questionId, question.id)).limit(1)
        if (tagIds.length > 0 && !existingTag) {
          await db.insert(questionTags).values(tagIds.map(tagId => ({ questionId: question.id, tagId }))).onConflictDoNothing()
        }
        if (difficultyScore !== null) {
          await db.update(questions).set({ difficultyScore }).where(eq(questions.id, question.id))
          await db.update(questions).set({ difficultyAuto: true })
            .where(and(eq(questions.id, question.id), isNull(questions.difficulty)))
          await rebandSubject(question.subjectId)
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
