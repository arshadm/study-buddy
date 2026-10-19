import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { unlink, writeFile } from 'node:fs/promises'
import { getUploadsDir } from './data-dir'

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
}
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export function documentMimeType(file: { type?: string }) {
  if (!file.type || !(file.type in EXTENSION_BY_MIME)) {
    throw createError({ statusCode: 400, statusMessage: 'Document must be a PDF or Word (.docx) file' })
  }
  return file.type
}

export async function saveDocumentFile(file: { data: Buffer, type?: string }) {
  const type = documentMimeType(file)
  if (file.data.length > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Document must be under 20MB' })
  }

  const filename = `${randomUUID()}.${EXTENSION_BY_MIME[type]}`
  const relativePath = join('documents', filename)
  await writeFile(join(getUploadsDir(), relativePath), file.data)
  return relativePath
}

export async function deleteDocumentFile(relativePath: string) {
  const safePath = resolveSafeUploadPath(relativePath)
  if (!safePath) return
  await unlink(safePath).catch(() => {})
}
