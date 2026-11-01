import { eq, sql } from 'drizzle-orm'
import { db } from '../../../database/client'
import { categories, subjects } from '../../../database/schema'

// Flat list — the client assembles the tree (see app/utils/category-tree.ts).
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  return db.select({
    id: categories.id,
    parentId: categories.parentId,
    name: categories.name,
    sortOrder: categories.sortOrder,
    subjectCount: sql<number>`COUNT(${subjects.id})`
  }).from(categories)
    .leftJoin(subjects, eq(subjects.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(categories.sortOrder, categories.id)
})
