import { db } from '../../../database/client'
import { papers } from '../../../database/schema'
import { getPaperWithSections } from '../../../utils/paper-summary'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const allPapers = await db.select({ id: papers.id }).from(papers).orderBy(papers.name)
  const withSections = await Promise.all(allPapers.map(p => getPaperWithSections(p.id)))
  return withSections.filter(p => p !== null)
})
