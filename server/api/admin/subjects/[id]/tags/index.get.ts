import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../../../../database/client'
import { questions, questionTags, subjectTags } from '../../../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const subjectId = Number(getRouterParam(event, 'id'))

  // questionCount counts active questions only — soft-deleted ones keep their tag rows but
  // aren't something the admin can see or edit any more.
  return db.select({
    id: subjectTags.id,
    name: subjectTags.name,
    questionCount: sql<number>`COUNT(${questions.id})`
  }).from(subjectTags)
    .leftJoin(questionTags, eq(questionTags.tagId, subjectTags.id))
    .leftJoin(questions, and(eq(questions.id, questionTags.questionId), eq(questions.isActive, true)))
    .where(eq(subjectTags.subjectId, subjectId))
    .groupBy(subjectTags.id)
    .orderBy(sql`lower(${subjectTags.name})`)
})
