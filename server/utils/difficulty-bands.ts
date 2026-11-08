import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '../database/client'
import { questions } from '../database/schema'

// Turns Claude's 1–100 difficulty scores into the picker's 1–5 by rank within a subject: the
// easiest fifth of the subject's scored questions are 1, the hardest fifth 5. Claude orders
// questions consistently but won't spread them over the scale itself, and the picker targets
// difficulty from a student's accuracy within one subject, so a per-subject scale fits.
//
// Only questions whose difficulty Claude set (difficultyAuto) or that have none are re-banded;
// every scored question, including admin-rated ones, still counts towards the ranking.

// Below this, quintiles are mostly noise — fall back to reading the score directly.
const MIN_FOR_RANKING = 10

// `others` = the subject's other scores. Tied scores share their middle rank, so equal scores
// always land in the same band.
export function bandForScore(score: number, others: number[]): number {
  if (others.length + 1 < MIN_FOR_RANKING) return Math.min(5, Math.max(1, Math.ceil(score / 20)))
  const n = others.length + 1
  const below = others.filter(s => s < score).length
  const equal = others.filter(s => s === score).length + 1
  const middleRank = below + (equal - 1) / 2
  return Math.min(5, Math.floor(((middleRank + 0.5) / n) * 5) + 1)
}

// Where a new score would land in the subject — for the question form's Suggest button.
export async function bandForNewScore(subjectId: number, score: number, excludeQuestionId?: number): Promise<number> {
  const rows = await db.select({ id: questions.id, score: questions.difficultyScore }).from(questions)
    .where(and(eq(questions.subjectId, subjectId), isNotNull(questions.difficultyScore)))
  return bandForScore(score, rows.filter(r => r.id !== excludeQuestionId).map(r => r.score!))
}

export async function rebandSubject(subjectId: number) {
  const rows = await db.select({
    id: questions.id,
    score: questions.difficultyScore,
    difficulty: questions.difficulty,
    auto: questions.difficultyAuto
  }).from(questions).where(and(eq(questions.subjectId, subjectId), isNotNull(questions.difficultyScore)))

  const scores = rows.map(r => r.score!)
  for (const [i, row] of rows.entries()) {
    if (!row.auto && row.difficulty !== null) continue
    const band = bandForScore(row.score!, scores.filter((_, j) => j !== i))
    if (band !== row.difficulty || !row.auto) {
      await db.update(questions).set({ difficulty: band, difficultyAuto: true }).where(eq(questions.id, row.id))
    }
  }
}

// On startup, so deletions or moves between subjects since the last reband are picked up.
export async function rebandAllSubjects() {
  const subjectIds = await db.selectDistinct({ id: questions.subjectId }).from(questions)
    .where(isNotNull(questions.difficultyScore))
  for (const { id } of subjectIds) await rebandSubject(id)
}
