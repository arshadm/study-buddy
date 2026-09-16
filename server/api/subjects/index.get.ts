import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { subjects } from '../../database/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  return db.select().from(subjects).where(eq(subjects.isActive, true)).orderBy(subjects.name)
})
