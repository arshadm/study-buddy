import { and, eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { studentSubjects, subjects } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role === 'admin') {
    return db.select().from(subjects).where(eq(subjects.isActive, true)).orderBy(subjects.name)
  }

  // Students only see the subjects an admin has assigned to them.
  const rows = await db.select({ subject: subjects }).from(subjects)
    .innerJoin(studentSubjects, and(eq(studentSubjects.subjectId, subjects.id), eq(studentSubjects.studentId, user.id)))
    .where(eq(subjects.isActive, true))
    .orderBy(subjects.name)
  return rows.map(r => r.subject)
})
