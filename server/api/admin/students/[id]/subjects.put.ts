import { z } from 'zod'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../../../database/client'
import { subjects, users } from '../../../../database/schema'
import { setAssignedSubjects } from '../../../../utils/student-subjects'

const bodySchema = z.object({
  subjectIds: z.array(z.number().int())
})

// Replaces the student's full set of assigned subjects with `subjectIds`.
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'id'))
  const { subjectIds } = await readValidatedBody(event, bodySchema.parse)

  const [student] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.id, id), eq(users.role, 'student'))).limit(1)
  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  }

  const unique = [...new Set(subjectIds)]
  if (unique.length > 0) {
    const found = await db.select({ id: subjects.id }).from(subjects).where(inArray(subjects.id, unique))
    if (found.length !== unique.length) {
      throw createError({ statusCode: 400, statusMessage: 'One or more subjects do not exist' })
    }
  }

  await setAssignedSubjects(id, unique)
  return { subjectIds: unique }
})
