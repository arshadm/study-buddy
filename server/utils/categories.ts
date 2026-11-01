import { and, eq, isNull, ne, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { categories } from '../database/schema'

export async function getCategory(id: number) {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1)
  return row
}

function siblingsCondition(parentId: number | null) {
  return parentId === null ? isNull(categories.parentId) : eq(categories.parentId, parentId)
}

// Sibling names must be unique (case-insensitive) — enforced here rather than by a unique index
// because SQLite treats NULL parentIds as distinct, so top-level duplicates would slip through.
export async function assertUniqueSiblingName(parentId: number | null, name: string, excludeId?: number) {
  const [clash] = await db.select({ id: categories.id }).from(categories)
    .where(and(
      siblingsCondition(parentId),
      sql`lower(${categories.name}) = lower(${name})`,
      excludeId !== undefined ? ne(categories.id, excludeId) : undefined
    ))
    .limit(1)
  if (clash) {
    throw createError({ statusCode: 409, statusMessage: `A category named "${name}" already exists here` })
  }
}

export async function nextSortOrder(parentId: number | null) {
  const [row] = await db.select({ max: sql<number | null>`MAX(${categories.sortOrder})` })
    .from(categories).where(siblingsCondition(parentId))
  return (row?.max ?? -1) + 1
}

export async function getSiblings(parentId: number | null) {
  return db.select().from(categories).where(siblingsCondition(parentId)).orderBy(categories.sortOrder, categories.id)
}

// True if `candidateAncestorId` is `id` itself or one of its descendants — moving a category
// under such a node would create a cycle.
export async function isSelfOrDescendant(id: number, candidateAncestorId: number) {
  const all = await db.select({ id: categories.id, parentId: categories.parentId }).from(categories)
  const parentOf = new Map(all.map(c => [c.id, c.parentId]))
  let cursor: number | null | undefined = candidateAncestorId
  const seen = new Set<number>()
  while (cursor !== null && cursor !== undefined && !seen.has(cursor)) {
    if (cursor === id) return true
    seen.add(cursor)
    cursor = parentOf.get(cursor)
  }
  return false
}
