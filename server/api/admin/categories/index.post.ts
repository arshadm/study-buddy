import { z } from 'zod'
import { db } from '../../../database/client'
import { categories } from '../../../database/schema'
import { assertUniqueSiblingName, getCategory, nextSortOrder } from '../../../utils/categories'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  parentId: z.number().int().nullable().default(null)
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const { name, parentId } = await readValidatedBody(event, bodySchema.parse)

  if (parentId !== null && !(await getCategory(parentId))) {
    throw createError({ statusCode: 400, statusMessage: 'Parent category not found' })
  }
  await assertUniqueSiblingName(parentId, name)

  const now = Date.now()
  const [category] = await db.insert(categories).values({
    name,
    parentId,
    sortOrder: await nextSortOrder(parentId),
    createdAt: now,
    updatedAt: now
  }).returning()

  return category
})
