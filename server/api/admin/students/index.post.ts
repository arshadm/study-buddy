import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { users } from '../../../database/schema'
import { hashPasswordScrypt } from '../../../utils/hash-password'

const bodySchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/, 'Only letters, numbers, dots, dashes and underscores'),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100)
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const body = await readValidatedBody(event, bodySchema.parse)

  const [existing] = await db.select().from(users).where(eq(users.username, body.username)).limit(1)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Username already taken' })
  }

  const now = Date.now()
  const [student] = await db.insert(users).values({
    username: body.username,
    passwordHash: await hashPasswordScrypt(body.password),
    displayName: body.displayName,
    role: 'student',
    createdAt: now,
    updatedAt: now
  }).returning({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    isActive: users.isActive,
    createdAt: users.createdAt
  })

  return student
})
