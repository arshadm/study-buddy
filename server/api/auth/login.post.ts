import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { users } from '../../database/schema'
import { verifyPasswordScrypt } from '../../utils/hash-password'

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const { username, password } = await readValidatedBody(event, bodySchema.parse)

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1)

  if (!user || !user.isActive || !(await verifyPasswordScrypt(user.passwordHash, password))) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })
  }

  await setUserSession(event, {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role
    },
    loggedInAt: Date.now()
  })

  return { role: user.role }
})
