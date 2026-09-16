import { defineConfig } from 'drizzle-kit'
import { getDbPath } from './server/utils/data-dir'

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dbCredentials: {
    url: getDbPath()
  }
})
