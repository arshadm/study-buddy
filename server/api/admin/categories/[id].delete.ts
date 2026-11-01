import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { categories, subjects } from '../../../database/schema'
import { getCategory } from '../../../utils/categories'

// Only a category with no sub-categories can be deleted. Subjects filed under it are un-filed
// (category set to none), never deleted.
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'id'))

  if (!(await getCategory(id))) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  const childCount = await db.$count(categories, eq(categories.parentId, id))
  if (childCount > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Delete or move its sub-categories first' })
  }

  db.transaction((tx) => {
    tx.update(subjects).set({ categoryId: null }).where(eq(subjects.categoryId, id)).run()
    tx.delete(categories).where(eq(categories.id, id)).run()
  })

  return { ok: true }
})
