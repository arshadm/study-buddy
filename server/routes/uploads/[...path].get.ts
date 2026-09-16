import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { resolveSafeUploadPath } from '../../utils/uploads'

const MIME_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
}

export default defineEventHandler(async (event) => {
  const relPath = getRouterParam(event, 'path')
  if (!relPath) {
    throw createError({ statusCode: 400 })
  }

  const safePath = resolveSafeUploadPath(relPath)
  if (!safePath) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  const fileStat = await stat(safePath).catch(() => null)
  if (!fileStat || !fileStat.isFile()) {
    throw createError({ statusCode: 404 })
  }

  setHeader(event, 'Content-Type', MIME_BY_EXT[extname(safePath).toLowerCase()] || 'application/octet-stream')
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

  return sendStream(event, createReadStream(safePath))
})
