import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { claudeAuthStatus } from '../../database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const [status] = await db.select().from(claudeAuthStatus).where(eq(claudeAuthStatus.id, 1)).limit(1)

  return status ?? { id: 1, status: 'ok' as const, lastCheckedAt: null, lastErrorMessage: null }
})
