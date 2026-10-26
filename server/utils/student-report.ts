import { and, eq, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { subjects, sections, questions, quizSessionQuestions, quizSessions, paperAttempts } from '../database/schema'
import { effectivePercentSql } from './scoring'

export interface ChapterReportRow {
  // null = the "Uncategorized" pseudo-chapter, for questions with no sectionId (mirrors the
  // same pseudo-section grouping used by the question-selection weighting algorithm).
  sectionId: number | null
  sectionName: string
  attempted: boolean
  accuracyPercent: number | null
  totalAnswered: number
}

export interface SubjectReportRow {
  subjectId: number
  subjectName: string
  attempted: boolean
  accuracyPercent: number | null
  totalAnswered: number
  chapters: ChapterReportRow[]
}

interface Tally { correctSum: number, total: number }

function accuracyOf(t: Tally): number {
  return Math.round((t.correctSum / t.total) * 100)
}

// All-time accuracy per subject/chapter for one student, weakest-first — used by the admin
// student page to show where a student needs the most practice. Scoped to the MCQ/self-marked
// adaptive question pool only (not discussion activities), matching category-performance.get.ts's
// precedent that those aren't part of that pool. Uses effectivePercentSql so a self-marked
// partial-credit answer contributes fractional credit here too, rather than being collapsed to a
// flat right/wrong like the older admin dashboard's category-performance query.
export async function getStudentReport(studentId: number): Promise<SubjectReportRow[]> {
  // Only subjects/sections that actually have something to practice — a subject or chapter
  // with zero active questions has no coverage to report on, attempted or not.
  const subjectsWithQuestions = await db.selectDistinct({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .innerJoin(questions, and(eq(questions.subjectId, subjects.id), eq(questions.isActive, true)))
    .orderBy(subjects.name)

  const sectionsWithQuestions = await db.selectDistinct({ id: sections.id, name: sections.name, subjectId: sections.subjectId })
    .from(sections)
    .innerJoin(questions, and(eq(questions.sectionId, sections.id), eq(questions.isActive, true)))
    .orderBy(sections.subjectId, sections.name)

  const EFFECTIVE_PERCENT = effectivePercentSql('ssq.')
  const answeredRows = db.all<{ subject_id: number, section_id: number | null, pct: number }>(sql`
    SELECT
      ssq.subject_id AS subject_id,
      q.section_id AS section_id,
      ${sql.raw(EFFECTIVE_PERCENT)} AS pct
    FROM ${quizSessionQuestions} ssq
    INNER JOIN ${quizSessions} s ON s.id = ssq.quiz_session_id AND s.student_id = ${studentId} AND s.status = 'completed'
    INNER JOIN ${questions} q ON q.id = ssq.question_id
    LEFT JOIN ${paperAttempts} pa ON pa.id = s.paper_attempt_id
    -- A mock-paper section only counts once the whole paper is done, not as each section
    -- individually finishes (same gating as subject-performance.get.ts / category-performance.get.ts).
    WHERE s.paper_attempt_id IS NULL OR pa.status = 'completed'
  `)

  const bySubject = new Map<number, Tally>()
  const bySection = new Map<number, Tally>()
  const byUncategorizedSubject = new Map<number, Tally>()

  for (const row of answeredRows) {
    const subjTally = bySubject.get(row.subject_id) ?? { correctSum: 0, total: 0 }
    subjTally.correctSum += row.pct / 100
    subjTally.total += 1
    bySubject.set(row.subject_id, subjTally)

    if (row.section_id !== null) {
      const secTally = bySection.get(row.section_id) ?? { correctSum: 0, total: 0 }
      secTally.correctSum += row.pct / 100
      secTally.total += 1
      bySection.set(row.section_id, secTally)
    } else {
      const uncatTally = byUncategorizedSubject.get(row.subject_id) ?? { correctSum: 0, total: 0 }
      uncatTally.correctSum += row.pct / 100
      uncatTally.total += 1
      byUncategorizedSubject.set(row.subject_id, uncatTally)
    }
  }

  function sortWeakestFirst<T extends { attempted: boolean, accuracyPercent: number | null }>(rows: T[]): T[] {
    const attempted = rows.filter(r => r.attempted).sort((a, b) => a.accuracyPercent! - b.accuracyPercent!)
    const notAttempted = rows.filter(r => !r.attempted)
    return [...attempted, ...notAttempted]
  }

  const report = subjectsWithQuestions.map((subject) => {
    const chapterRows: ChapterReportRow[] = sectionsWithQuestions
      .filter(s => s.subjectId === subject.id)
      .map((section) => {
        const tally = bySection.get(section.id)
        return {
          sectionId: section.id,
          sectionName: section.name,
          attempted: Boolean(tally),
          accuracyPercent: tally ? accuracyOf(tally) : null,
          totalAnswered: tally?.total ?? 0
        }
      })

    const uncategorizedTally = byUncategorizedSubject.get(subject.id)
    if (uncategorizedTally) {
      chapterRows.push({
        sectionId: null,
        sectionName: 'Uncategorized',
        attempted: true,
        accuracyPercent: accuracyOf(uncategorizedTally),
        totalAnswered: uncategorizedTally.total
      })
    }

    const subjectTally = bySubject.get(subject.id)

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      attempted: Boolean(subjectTally),
      accuracyPercent: subjectTally ? accuracyOf(subjectTally) : null,
      totalAnswered: subjectTally?.total ?? 0,
      chapters: sortWeakestFirst(chapterRows)
    }
  })

  return sortWeakestFirst(report)
}
