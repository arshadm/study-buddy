import { db } from '../../database/client'
import { categories } from '../../database/schema'

// The category tree for grouping subjects on the student start page. Flat; the client builds
// the tree and drops any branch with none of the student's subjects in it (see
// buildSubjectTree in app/utils/category-tree.ts).
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  return db.select({
    id: categories.id,
    parentId: categories.parentId,
    name: categories.name,
    sortOrder: categories.sortOrder
  }).from(categories).orderBy(categories.sortOrder, categories.id)
})
