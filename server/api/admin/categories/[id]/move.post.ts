import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../../../database/client'
import { categories } from '../../../../database/schema'
import { getCategory, getSiblings } from '../../../../utils/categories'

const bodySchema = z.object({ direction: z.enum(['up', 'down']) })

// Reorders a category among its siblings by one place. Renumbers the sibling list 0..n-1 as it
// goes, so any gaps or duplicate sortOrders (e.g. after re-parenting) get normalized.
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'id'))
  const { direction } = await readValidatedBody(event, bodySchema.parse)

  const category = await getCategory(id)
  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  const siblings = await getSiblings(category.parentId)
  const index = siblings.findIndex(s => s.id === id)
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= siblings.length) return { ok: true }

  const reordered = [...siblings]
  ;[reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!]

  db.transaction((tx) => {
    reordered.forEach((s, i) => {
      tx.update(categories).set({ sortOrder: i }).where(eq(categories.id, s.id)).run()
    })
  })

  return { ok: true }
})
