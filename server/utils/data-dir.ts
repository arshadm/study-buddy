import { mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

export function getDataDir() {
  const dir = resolve(process.env.STUDY_BUDDY_DATA_DIR || join(process.cwd(), '.data'))
  mkdirSync(join(dir, 'db'), { recursive: true })
  mkdirSync(join(dir, 'uploads', 'questions'), { recursive: true })
  return dir
}

export function getDbPath() {
  return join(getDataDir(), 'db', 'study-buddy.sqlite')
}

export function getUploadsDir() {
  return join(getDataDir(), 'uploads')
}
