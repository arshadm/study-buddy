try {
  process.loadEnvFile?.(new URL('../../.env', import.meta.url))
} catch {
  // .env is optional; fall back to defaults / already-exported env vars
}

const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')
const { db, sqlite } = await import('./client.ts')

migrate(db, { migrationsFolder: './server/database/migrations' })
console.log('Migrations applied.')
sqlite.close()
