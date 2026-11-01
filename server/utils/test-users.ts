import { notLike } from 'drizzle-orm'
import { users } from '../database/schema'

// The admin dashboard's aggregate stats ignore test accounts — any user whose username contains
// "test" (SQLite's LIKE is case-insensitive for ASCII, so "Test", "TEST" etc. match too).
// Per-student pages are unaffected; an admin can still inspect a test account directly.
const TEST_USERNAME_PATTERN = '%test%'

export function excludeTestUsers() {
  return notLike(users.username, TEST_USERNAME_PATTERN)
}

// Raw-SQL equivalent for the hand-written queries in progress-series.ts. `alias` is the users
// table alias used in that query.
export function excludeTestUsersSql(alias: string) {
  return `${alias}.username NOT LIKE '${TEST_USERNAME_PATTERN}'`
}
