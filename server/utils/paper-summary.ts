import { asc, eq } from 'drizzle-orm'
import { db } from '../database/client'
import { papers, paperSections, subjects } from '../database/schema'

export async function getPaperWithSections(paperId: number) {
  const [paper] = await db.select().from(papers).where(eq(papers.id, paperId)).limit(1)
  if (!paper) return null

  const sections = await db.select({
    id: paperSections.id,
    subjectId: paperSections.subjectId,
    subjectName: subjects.name,
    questionCount: paperSections.questionCount,
    timeLimitSeconds: paperSections.timeLimitSeconds,
    sortOrder: paperSections.sortOrder
  }).from(paperSections)
    .innerJoin(subjects, eq(subjects.id, paperSections.subjectId))
    .where(eq(paperSections.paperId, paperId))
    .orderBy(asc(paperSections.sortOrder))

  return { ...paper, sections }
}
