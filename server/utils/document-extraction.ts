import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

export interface ExtractionResult {
  text: string | null
  error: string | null
}

export async function extractDocumentText(data: Buffer, mimeType: string): Promise<ExtractionResult> {
  try {
    const text = mimeType === 'application/pdf'
      ? await extractPdfText(data)
      : await extractDocxText(data)

    if (!text.trim()) {
      return { text: null, error: 'No extractable text was found in this document (it may be a scanned/image-only file).' }
    }
    return { text, error: null }
  } catch (err) {
    return { text: null, error: err instanceof Error ? err.message : 'Could not extract text from this document' }
  }
}

async function extractPdfText(data: Buffer): Promise<string> {
  const parser = new PDFParse({ data })
  try {
    const result = await parser.getText()
    return result.text
  } finally {
    await parser.destroy()
  }
}

async function extractDocxText(data: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: data })
  return result.value
}
