import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { papers } from '../../database/schema'
import { getPaperWithSections } from '../../utils/paper-summary'
import { getAssignedSubjectIds } from '../../utils/student-subjects'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const activePapers = await db.select({ id: papers.id }).from(papers).where(eq(papers.isActive, true))

  const withSections = (await Promise.all(activePapers.map(p => getPaperWithSections(p.id))))
    .filter(p => p !== null)

  if (user.role === 'admin') return withSections

  // A paper is only offered when the student is assigned every subject it covers — otherwise
  // they'd hit a section they aren't meant to see partway through the mock.
  const assigned = await getAssignedSubjectIds(user.id)
  return withSections.filter(p => p.sections.length > 0 && p.sections.every(s => assigned.has(s.subjectId)))
})
