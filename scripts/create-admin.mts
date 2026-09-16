import { parseArgs } from 'node:util'

try {
  process.loadEnvFile?.(new URL('../.env', import.meta.url))
} catch {
  // .env is optional; fall back to defaults / already-exported env vars
}

const { eq } = await import('drizzle-orm')
const { hashPasswordScrypt } = await import('../server/utils/hash-password.ts')
const { db, sqlite } = await import('../server/database/client.ts')
const { users } = await import('../server/database/schema.ts')

const { values } = parseArgs({
  options: {
    username: { type: 'string' },
    password: { type: 'string' },
    name: { type: 'string' },
    reset: { type: 'boolean', default: false }
  }
})

if (!values.username || !values.password) {
  console.error('Usage: npm run create-admin -- --username <username> --password <password> [--name "Display Name"] [--reset]')
  process.exit(1)
}

const now = Date.now()
const passwordHash = await hashPasswordScrypt(values.password)

const [existing] = await db.select().from(users).where(eq(users.username, values.username)).limit(1)

if (existing) {
  if (!values.reset) {
    console.error(`User "${values.username}" already exists. Pass --reset to update their password.`)
    process.exit(1)
  }
  await db.update(users).set({ passwordHash, role: 'admin', updatedAt: now }).where(eq(users.id, existing.id))
  console.log(`Updated admin user "${values.username}".`)
} else {
  await db.insert(users).values({
    username: values.username,
    passwordHash,
    displayName: values.name || values.username,
    role: 'admin',
    createdAt: now,
    updatedAt: now
  })
  console.log(`Created admin user "${values.username}".`)
}

sqlite.close()
