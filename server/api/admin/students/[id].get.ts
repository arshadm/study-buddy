import { and, eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { users } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const id = Number(getRouterParam(event, 'id'))

  const [student] = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    isActive: users.isActive,
    createdAt: users.createdAt
  }).from(users).where(and(eq(users.id, id), eq(users.role, 'student'))).limit(1)

  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  }

  return student
})
