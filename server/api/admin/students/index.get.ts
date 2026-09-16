import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { users } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const students = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    isActive: users.isActive,
    createdAt: users.createdAt
  }).from(users).where(eq(users.role, 'student')).orderBy(users.displayName)

  return students
})
