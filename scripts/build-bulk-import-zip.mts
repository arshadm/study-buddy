// Packages a folder of chronologically-named question/answer screenshots into a zip ready for
// the admin "Bulk import" (self-marked image) flow at /admin/subjects/:id — i.e.
// server/api/admin/questions/bulk-import.post.ts, which expects one CSV with
// question_image_filename/answer_image_filename columns plus the images it references.
//
// This only does the mechanical packaging step: pairing files strictly by sorted filename
// (question, answer, question, answer, ...) and renaming them q01.ext/a01.ext etc. It does NOT
// look at image content, so a folder must already be verified by hand — e.g. by reading through
// the screenshots — to confirm they really do alternate question/answer in chronological order
// with nothing missing, duplicated, or out of place (screenshots can jump around if a worked
// solution spans two photos, or if a stray screenshot got mixed in). Use --exclude to drop any
// stray files once you've spotted them.
//
// Usage:
//   npx tsx scripts/build-bulk-import-zip.mts "<folder>" [--output <path>] [--exclude a.png,b.png]
//
// Default output: "<folder>/<slugified-folder-name>-import.zip" (e.g. "02 - Argand Diagrams" ->
// "argand-diagrams-import.zip"), matching the naming used for prior imports in this project.

import { readdirSync } from 'fs'
import { basename, extname, join, resolve } from 'path'
import AdmZip from 'adm-zip'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

function parseArgs(argv: string[]) {
  const positional: string[] = []
  let output: string | undefined
  let exclude: Set<string> = new Set()

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--output') {
      output = argv[++i]
    } else if (arg === '--exclude') {
      exclude = new Set((argv[++i] ?? '').split(',').map(s => s.trim()).filter(Boolean))
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`)
    } else {
      positional.push(arg)
    }
  }

  if (positional.length !== 1) {
    throw new Error('Usage: build-bulk-import-zip.mts "<folder>" [--output <path>] [--exclude a.png,b.png]')
  }

  return { sourceDir: resolve(positional[0]!), output, exclude }
}

function slugify(name: string) {
  return name
    .replace(/^\d+\s*-\s*/, '') // drop a leading "NN - " ordering prefix
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const { sourceDir, output, exclude } = parseArgs(process.argv.slice(2))

const files = readdirSync(sourceDir, { withFileTypes: true })
  .filter(e => e.isFile())
  .map(e => e.name)
  .filter(name => !name.startsWith('.'))
  .filter(name => IMAGE_EXTENSIONS.has(extname(name).toLowerCase()))
  .filter(name => !exclude.has(name))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

if (files.length === 0) {
  throw new Error(`No image files found in ${sourceDir}`)
}

if (files.length % 2 !== 0) {
  throw new Error(
    `Found an odd number of images (${files.length}) — can't pair question/answer evenly.\n`
    + `Files in sorted order:\n${files.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}\n`
    + 'Review the list above, then re-run with --exclude for any stray file.'
  )
}

const pairCount = files.length / 2
const pad = String(pairCount).length < 2 ? 2 : String(pairCount).length

const zip = new AdmZip()
const csvRows = ['question_image_filename,answer_image_filename']
const mapping: { index: number, question: string, answer: string }[] = []

for (let i = 0; i < pairCount; i++) {
  const questionFile = files[i * 2]!
  const answerFile = files[i * 2 + 1]!
  const idx = String(i + 1).padStart(pad, '0')
  const qName = `q${idx}${extname(questionFile).toLowerCase()}`
  const aName = `a${idx}${extname(answerFile).toLowerCase()}`

  zip.addLocalFile(join(sourceDir, questionFile), '', qName)
  zip.addLocalFile(join(sourceDir, answerFile), '', aName)
  csvRows.push(`${qName},${aName}`)
  mapping.push({ index: i + 1, question: questionFile, answer: answerFile })
}

zip.addFile('manifest.csv', Buffer.from(csvRows.join('\n') + '\n', 'utf-8'))

const outputPath = output ? resolve(output) : join(sourceDir, `${slugify(basename(sourceDir))}-import.zip`)
zip.writeZip(outputPath)

console.log(`Wrote ${pairCount} question/answer pair(s) to ${outputPath}\n`)
for (const m of mapping) {
  console.log(`  ${String(m.index).padStart(pad, '0')}: ${m.question}  ->  ${m.answer}`)
}
