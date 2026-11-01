import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../database/client'
import { studentSubjects } from '../database/schema'

export async function getAssignedSubjectIds(studentId: number): Promise<Set<number>> {
  const rows = await db.select({ subjectId: studentSubjects.subjectId })
    .from(studentSubjects)
    .where(eq(studentSubjects.studentId, studentId))
  return new Set(rows.map(r => r.subjectId))
}

// Rejects with 403 unless every subject in `subjectIds` is assigned to the student. Used by the
// student-facing "start" endpoints so an unassigned subject can't be reached by calling the API
// directly, even though the listing endpoints already hide it.
export async function assertSubjectsAssigned(studentId: number, subjectIds: number[]) {
  const unique = [...new Set(subjectIds)]
  if (unique.length === 0) return

  const rows = await db.select({ subjectId: studentSubjects.subjectId })
    .from(studentSubjects)
    .where(and(eq(studentSubjects.studentId, studentId), inArray(studentSubjects.subjectId, unique)))

  if (rows.length !== unique.length) {
    throw createError({ statusCode: 403, statusMessage: 'You are not assigned to this subject' })
  }
}

export async function setAssignedSubjects(studentId: number, subjectIds: number[]) {
  const unique = [...new Set(subjectIds)]
  const now = Date.now()
  db.transaction((tx) => {
    tx.delete(studentSubjects).where(eq(studentSubjects.studentId, studentId)).run()
    if (unique.length > 0) {
      tx.insert(studentSubjects).values(unique.map(subjectId => ({ studentId, subjectId, createdAt: now }))).run()
    }
  })
}
