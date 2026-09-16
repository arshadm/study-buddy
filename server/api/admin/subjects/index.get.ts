import { db } from '../../../database/client'
import { subjects } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  return db.select().from(subjects).orderBy(subjects.name)
})
