import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { papers } from '../../database/schema'
import { getPaperWithSections } from '../../utils/paper-summary'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const activePapers = await db.select({ id: papers.id }).from(papers).where(eq(papers.isActive, true))

  const withSections = await Promise.all(activePapers.map(p => getPaperWithSections(p.id)))
  return withSections.filter(p => p !== null)
})
