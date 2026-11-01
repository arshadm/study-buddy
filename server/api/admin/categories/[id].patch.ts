import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { categories } from '../../../database/schema'
import { assertUniqueSiblingName, getCategory, isSelfOrDescendant, nextSortOrder } from '../../../utils/categories'

// Rename and/or re-parent. Moving to a new parent puts the category last among its new siblings.
const bodySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  parentId: z.number().int().nullable().optional()
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, bodySchema.parse)

  const category = await getCategory(id)
  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  const newParentId = body.parentId !== undefined ? body.parentId : category.parentId
  const parentChanged = newParentId !== category.parentId

  if (parentChanged && newParentId !== null) {
    if (!(await getCategory(newParentId))) {
      throw createError({ statusCode: 400, statusMessage: 'Parent category not found' })
    }
    if (await isSelfOrDescendant(id, newParentId)) {
      throw createError({ statusCode: 400, statusMessage: 'A category can\'t be moved inside itself or one of its own sub-categories' })
    }
  }

  const newName = body.name ?? category.name
  await assertUniqueSiblingName(newParentId, newName, id)

  const [updated] = await db.update(categories).set({
    name: newName,
    parentId: newParentId,
    ...(parentChanged ? { sortOrder: await nextSortOrder(newParentId) } : {}),
    updatedAt: Date.now()
  }).where(eq(categories.id, id)).returning()

  return updated
})
