import { asc, eq } from 'drizzle-orm'
import { db } from '../../../../../database/client'
import { sections } from '../../../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const subjectId = Number(getRouterParam(event, 'id'))

  return db.select().from(sections)
    .where(eq(sections.subjectId, subjectId))
    .orderBy(asc(sections.name))
})
