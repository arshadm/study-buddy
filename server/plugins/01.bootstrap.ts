import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { users } from '../database/schema'
import { hashPasswordScrypt } from '../utils/hash-password'

export default defineNitroPlugin(async () => {
  migrate(db, { migrationsFolder: './server/database/migrations' })

  const [existingAdmin] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1)

  if (!existingAdmin) {
    const username = 'admin'
    const password = randomBytes(9).toString('base64url')
    const now = Date.now()

    await db.insert(users).values({
      username,
      passwordHash: await hashPasswordScrypt(password),
      displayName: 'Admin',
      role: 'admin',
      createdAt: now,
      updatedAt: now
    })

    console.log('')
    console.log('=== INITIAL ADMIN CREDENTIALS (change immediately) ===')
    console.log(`  username: ${username}`)
    console.log(`  password: ${password}`)
    console.log('========================================================')
    console.log('')
  }
})
