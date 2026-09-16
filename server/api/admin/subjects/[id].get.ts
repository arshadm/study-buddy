import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { subjects } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'id'))

  const [subject] = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1)
  if (!subject) {
    throw createError({ statusCode: 404, statusMessage: 'Subject not found' })
  }

  return subject
})
