import { randomUUID } from 'node:crypto'
import { join, normalize, sep } from 'node:path'
import { unlink, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { getUploadsDir } from './data-dir'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

export async function saveQuestionImage(file: { data: Buffer, type?: string }) {
  if (!file.type || !ALLOWED_MIME.has(file.type)) {
    throw createError({ statusCode: 400, statusMessage: 'Image must be PNG, JPEG or WebP' })
  }
  if (file.data.length > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Image must be under 8MB' })
  }

  const filename = `${randomUUID()}.webp`
  const relativePath = join('questions', filename)
  const absolutePath = join(getUploadsDir(), relativePath)

  const processed = await sharp(file.data)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()

  await writeFile(absolutePath, processed)
  return relativePath
}

export async function deleteQuestionImage(relativePath: string) {
  const safePath = resolveSafeUploadPath(relativePath)
  if (!safePath) return
  await unlink(safePath).catch(() => {})
}

export function resolveSafeUploadPath(relativePath: string) {
  const uploadsDir = getUploadsDir()
  const resolved = normalize(join(uploadsDir, relativePath))
  if (resolved !== uploadsDir && !resolved.startsWith(uploadsDir + sep)) {
    return null
  }
  return resolved
}
