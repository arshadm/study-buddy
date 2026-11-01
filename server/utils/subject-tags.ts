import { and, eq, inArray, ne, notInArray, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { questionTags, subjectTags } from '../database/schema'

export const MAX_TAG_LENGTH = 50

// Trims and collapses internal whitespace so "  Vectors   proof " and "Vectors proof" are the same tag.
export function normalizeTagName(raw: string) {
  return raw.trim().replace(/\s+/g, ' ')
}

export async function findTagByName(subjectId: number, name: string, excludeId?: number) {
  const [row] = await db.select().from(subjectTags).where(and(
    eq(subjectTags.subjectId, subjectId),
    sql`lower(${subjectTags.name}) = lower(${name})`,
    excludeId !== undefined ? ne(subjectTags.id, excludeId) : undefined
  )).limit(1)
  return row
}

// Parses the multipart `tagIds` field (a JSON array) sent by the question form. Undefined when
// the field is absent, so a PATCH without it leaves existing tags alone.
export function parseTagIdsField(raw: string | undefined): number[] | undefined {
  if (raw === undefined) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw || '[]')
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'tagIds must be a JSON array' })
  }
  if (!Array.isArray(parsed) || !parsed.every(v => Number.isInteger(v))) {
    throw createError({ statusCode: 400, statusMessage: 'tagIds must be an array of tag ids' })
  }
  return [...new Set(parsed as number[])]
}

// The rule that makes question tags meaningful: every tag must come from the question's own
// subject.
export async function assertTagsBelongToSubject(subjectId: number, tagIds: number[]) {
  if (tagIds.length === 0) return
  const rows = await db.select({ id: subjectTags.id }).from(subjectTags)
    .where(and(eq(subjectTags.subjectId, subjectId), inArray(subjectTags.id, tagIds)))
  if (rows.length !== tagIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Tags must come from this question\'s subject' })
  }
}

export function setQuestionTags(questionId: number, tagIds: number[]) {
  db.transaction((tx) => {
    tx.delete(questionTags).where(eq(questionTags.questionId, questionId)).run()
    if (tagIds.length > 0) {
      tx.insert(questionTags).values(tagIds.map(tagId => ({ questionId, tagId }))).run()
    }
  })
}

// When a question moves to another subject, its old subject's tags no longer apply.
export async function dropTagsOutsideSubject(questionId: number, subjectId: number) {
  const keep = db.select({ id: subjectTags.id }).from(subjectTags).where(eq(subjectTags.subjectId, subjectId))
  await db.delete(questionTags).where(and(eq(questionTags.questionId, questionId), notInArray(questionTags.tagId, keep)))
}

export async function getTagIdsByQuestion(questionIds: number[]) {
  const map = new Map<number, number[]>()
  if (questionIds.length === 0) return map
  const rows = await db.select().from(questionTags).where(inArray(questionTags.questionId, questionIds))
  for (const r of rows) {
    const list = map.get(r.questionId) ?? []
    list.push(r.tagId)
    map.set(r.questionId, list)
  }
  return map
}
