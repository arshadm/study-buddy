import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../database/client'
import { questions, sections } from '../database/schema'

// Sections were added after questions already existed directly under a
// subject. Bucket any question still missing a section into a "General"
// section for its subject, created on demand. Idempotent — safe to run on
// every startup — and only ever touches rows that still lack a section.
export async function backfillUncategorizedQuestionsIntoSections() {
  const orphaned = await db.selectDistinct({ subjectId: questions.subjectId })
    .from(questions)
    .where(isNull(questions.sectionId))

  for (const { subjectId } of orphaned) {
    let [section] = await db.select().from(sections)
      .where(and(eq(sections.subjectId, subjectId), eq(sections.name, 'General')))
      .limit(1)

    if (!section) {
      const now = Date.now()
      ;[section] = await db.insert(sections).values({
        subjectId,
        name: 'General',
        createdAt: now,
        updatedAt: now
      }).returning()
    }

    await db.update(questions)
      .set({ sectionId: section!.id })
      .where(and(eq(questions.subjectId, subjectId), isNull(questions.sectionId)))
  }
}
