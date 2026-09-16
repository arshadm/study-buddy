export interface ParsedMultipart {
  fields: Record<string, string>
  files: Record<string, { data: Buffer, type?: string, filename?: string }>
}

export async function parseMultipartForm(event: Parameters<typeof readMultipartFormData>[0]): Promise<ParsedMultipart> {
  const parts = await readMultipartFormData(event)
  const fields: Record<string, string> = {}
  const files: ParsedMultipart['files'] = {}

  for (const part of parts || []) {
    if (!part.name) continue
    if (part.filename) {
      files[part.name] = { data: part.data, type: part.type, filename: part.filename }
    } else {
      fields[part.name] = part.data.toString('utf-8')
    }
  }

  return { fields, files }
}
