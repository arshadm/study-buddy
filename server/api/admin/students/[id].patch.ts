import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { users } from '../../../database/schema'
import { hashPasswordScrypt } from '../../../utils/hash-password'

const bodySchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const id = Number(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, bodySchema.parse)

  const updates: Partial<typeof users.$inferInsert> = { updatedAt: Date.now() }
  if (body.displayName !== undefined) updates.displayName = body.displayName
  if (body.isActive !== undefined) updates.isActive = body.isActive
  if (body.password) updates.passwordHash = await hashPasswordScrypt(body.password)

  const [student] = await db.update(users)
    .set(updates)
    .where(and(eq(users.id, id), eq(users.role, 'student')))
    .returning({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      isActive: users.isActive,
      createdAt: users.createdAt
    })

  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  }

  return student
})
