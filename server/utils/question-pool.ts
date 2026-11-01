import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm'
import { db } from '../database/client'
import { documents, questions, questionTags, sections, subjectTags } from '../database/schema'

// Questions a session can draw from for a subject: active, and not in an unpublished chapter.
// Mirrors the filter in weighting.ts's getQuestionStats — the two must stay in sync so the
// counts shown on the start page match what's actually pickable.
export async function getEligibleQuestionIds(subjectId: number): Promise<number[]> {
  const rows = await db.select({ id: questions.id }).from(questions)
    .leftJoin(sections, eq(sections.id, questions.sectionId))
    .leftJoin(documents, eq(documents.id, sections.chapterDocumentId))
    .where(and(
      eq(questions.subjectId, subjectId),
      eq(questions.isActive, true),
      or(isNull(documents.id), eq(documents.isActive, true))
    ))
  return rows.map(r => r.id)
}

// The subject's tags that are on at least one eligible question, each with those question ids
// (the start page unions them client-side to show how many questions a tag selection matches).
export async function getEligibleQuestionTags(subjectId: number, eligibleIds?: number[]) {
  const ids = eligibleIds ?? await getEligibleQuestionIds(subjectId)
  if (ids.length === 0) return []
  const rows = await db.select({ tagId: subjectTags.id, name: subjectTags.name, questionId: questionTags.questionId })
    .from(questionTags)
    .innerJoin(subjectTags, eq(subjectTags.id, questionTags.tagId))
    .where(and(eq(subjectTags.subjectId, subjectId), inArray(questionTags.questionId, ids)))
    .orderBy(asc(subjectTags.name))

  const byTag = new Map<number, { id: number, name: string, questionIds: number[] }>()
  for (const r of rows) {
    const tag = byTag.get(r.tagId) ?? { id: r.tagId, name: r.name, questionIds: [] }
    tag.questionIds.push(r.questionId)
    byTag.set(r.tagId, tag)
  }
  return [...byTag.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

// Eligible questions carrying ANY of `tagIds` (tags from other subjects simply match nothing).
// An empty tagIds list means no filter: every eligible question.
export async function getEligibleQuestionIdsForTags(subjectId: number, tagIds: number[]): Promise<number[]> {
  const eligible = await getEligibleQuestionIds(subjectId)
  if (tagIds.length === 0) return eligible
  const wanted = new Set(tagIds)
  const matching = new Set<number>()
  for (const tag of await getEligibleQuestionTags(subjectId, eligible)) {
    if (wanted.has(tag.id)) tag.questionIds.forEach(id => matching.add(id))
  }
  return eligible.filter(id => matching.has(id))
}
