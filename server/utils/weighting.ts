import { sql } from 'drizzle-orm'
import { db } from '../database/client'
import { documents, questions, quizSessionQuestions, quizSessions, sections } from '../database/schema'
import { effectivePercentSql } from './scoring'

const EFFECTIVE_PERCENT = effectivePercentSql('ssq.')

// Tunable constants for the adaptive weighting formula.
const WRONG_ATTEMPT_WEIGHT = 1.5
const RECENCY_MAX_BOOST = 0.5
const RECENCY_WINDOW_DAYS = 30
const SLOWNESS_THRESHOLD_MULTIPLIER = 1.3
const SLOWNESS_FACTOR = 1.25
const UNSEEN_BOOST = 1.2
const DIFFICULTY_DISTANCE_PENALTY = 0.25
// Section-level equivalent of WRONG_ATTEMPT_WEIGHT, used when picking which section a question
// comes from (see pickWeightedQuestionsForSubject) — same shape as the per-question factor,
// applied one level up so a section's share of picks reflects weakness, not pool size.
const SECTION_WRONG_WEIGHT = 1.5

// Groups questions with no sectionId into one pseudo-section so they still compete for
// selection instead of being excluded from the section-first pick.
const UNSECTIONED_KEY = 'unsectioned'
type SectionKey = number | typeof UNSECTIONED_KEY

interface QuestionStatsRow {
  questionId: number
  sectionId: number | null
  timesSeen: number
  timesWrong: number
  lastSeenAt: number | null
  avgCorrectTimeMs: number | null
  difficulty: number | null
}

interface WeightedQuestion {
  id: number
  weight: number
}

export function getQuestionStats(studentId: number, subjectId: number): QuestionStatsRow[] {
  const rows = db.all<{
    question_id: number
    section_id: number | null
    times_seen: number
    times_wrong: number
    last_seen_at: number | null
    avg_correct_time_ms: number | null
    difficulty: number | null
  }>(sql`
    SELECT
      q.id AS question_id,
      q.section_id AS section_id,
      q.difficulty AS difficulty,
      COUNT(ssq.id) AS times_seen,
      -- Fractional: a self-marked partial-credit score contributes less "wrong" than a flat miss.
      -- Guarded on ssq.id IS NOT NULL because this is a LEFT JOIN: a question with zero attempts
      -- still produces one phantom row with every ssq.* column null, and effectivePercentSql
      -- would otherwise read that as "0% i.e. completely wrong" instead of "no data".
      SUM(CASE WHEN ssq.id IS NOT NULL THEN (100 - ${sql.raw(EFFECTIVE_PERCENT)}) / 100.0 ELSE 0 END) AS times_wrong,
      MAX(ssq.answered_at) AS last_seen_at,
      AVG(CASE WHEN ${sql.raw(EFFECTIVE_PERCENT)} = 100 THEN ssq.time_spent_ms END) AS avg_correct_time_ms
    FROM ${questions} q
    -- A question's section may belong to an unpublished chapter, which pulls it out of
    -- selection without touching q.is_active (see documents.isActive). No section, or a section
    -- with no chapter, is never excluded by this join.
    LEFT JOIN ${sections} sec ON sec.id = q.section_id
    LEFT JOIN ${documents} chap ON chap.id = sec.chapter_document_id
    -- Pre-filtered to this student's completed sessions before joining, not after: a plain
    -- "LEFT JOIN ssq ... LEFT JOIN sessions ... AND student_id = ?" matches every student's
    -- attempts at the first join and only nulls out the session columns for a mismatch, so
    -- another student's wrong answers on the same question would otherwise count here too.
    LEFT JOIN (
      SELECT ssq.* FROM ${quizSessionQuestions} ssq
      INNER JOIN ${quizSessions} s ON s.id = ssq.quiz_session_id AND s.student_id = ${studentId} AND s.status = 'completed'
    ) ssq ON ssq.question_id = q.id
    WHERE q.subject_id = ${subjectId} AND q.is_active = 1
      AND (chap.id IS NULL OR chap.is_active = 1)
    GROUP BY q.id
  `)

  return rows.map(r => ({
    questionId: r.question_id,
    sectionId: r.section_id,
    timesSeen: r.times_seen ?? 0,
    timesWrong: r.times_wrong ?? 0,
    lastSeenAt: r.last_seen_at,
    avgCorrectTimeMs: r.avg_correct_time_ms,
    difficulty: r.difficulty
  }))
}

// A struggling student (low recent accuracy in this subject) gets easier questions weighted
// up; a student doing well gets harder ones weighted up. 3 is the neutral/no-data default.
function computeTargetDifficulty(stats: QuestionStatsRow[]): number {
  const totalSeen = stats.reduce((sum, s) => sum + s.timesSeen, 0)
  if (totalSeen === 0) return 3

  const totalWrong = stats.reduce((sum, s) => sum + s.timesWrong, 0)
  const accuracy = 1 - totalWrong / totalSeen

  if (accuracy < 0.4) return 1
  if (accuracy < 0.6) return 2
  if (accuracy < 0.75) return 3
  if (accuracy < 0.9) return 4
  return 5
}

export function computeWeight(stats: QuestionStatsRow, expectedTimePerQuestionMs: number, targetDifficulty: number): number {
  const wrongFactor = 1 + stats.timesWrong * WRONG_ATTEMPT_WEIGHT

  let recencyBoost = 1.0
  if (stats.lastSeenAt !== null) {
    const daysSince = (Date.now() - stats.lastSeenAt) / (1000 * 60 * 60 * 24)
    recencyBoost = 1 + Math.max(0, 1 - daysSince / RECENCY_WINDOW_DAYS) * RECENCY_MAX_BOOST
  }

  const slownessFactor
    = stats.timesSeen > 0
      && stats.avgCorrectTimeMs !== null
      && stats.avgCorrectTimeMs > expectedTimePerQuestionMs * SLOWNESS_THRESHOLD_MULTIPLIER
      ? SLOWNESS_FACTOR
      : 1.0

  const unseenBoost = stats.timesSeen === 0 ? UNSEEN_BOOST : 1.0

  const difficultyFactor = stats.difficulty === null
    ? 1.0
    : 1 / (1 + Math.abs(stats.difficulty - targetDifficulty) * DIFFICULTY_DISTANCE_PENALTY)

  return wrongFactor * recencyBoost * slownessFactor * unseenBoost * difficultyFactor
}

// Weakness score for a section (or the unsectioned pseudo-section), aggregated from its
// questions' stats. Deliberately mirrors only the wrong-rate/recency/unseen shape of
// computeWeight — slowness and difficulty-distance are inherently per-question signals that
// don't aggregate meaningfully to section granularity.
function computeSectionWeight(timesSeen: number, timesWrong: number, lastSeenAt: number | null): number {
  const wrongFactor = 1 + timesWrong * SECTION_WRONG_WEIGHT

  let recencyBoost = 1.0
  if (lastSeenAt !== null) {
    const daysSince = (Date.now() - lastSeenAt) / (1000 * 60 * 60 * 24)
    recencyBoost = 1 + Math.max(0, 1 - daysSince / RECENCY_WINDOW_DAYS) * RECENCY_MAX_BOOST
  }

  const unseenBoost = timesSeen === 0 ? UNSEEN_BOOST : 1.0

  return wrongFactor * recencyBoost * unseenBoost
}

// Picks a random index from `weights`, proportional to each entry's share of the total.
function weightedRandomIndex(weights: number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0)
  let r = Math.random() * total
  let idx = 0
  for (; idx < weights.length - 1; idx++) {
    r -= weights[idx]!
    if (r <= 0) break
  }
  return idx
}

export function weightedSampleWithoutReplacement(items: WeightedQuestion[], n: number): number[] {
  const pool = [...items]
  const picked: number[] = []

  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = weightedRandomIndex(pool.map(it => it.weight))
    picked.push(pool[idx]!.id)
    pool.splice(idx, 1)
  }

  return picked
}

// Picks `count` questions for a subject in two steps per pick: first a section, weighted by how
// weak the student is in it (see computeSectionWeight), then a question within that section,
// weighted by its own factor (see computeWeight). This keeps a section's share of picks
// proportional to its weakness rather than to how many questions it happens to contain — a
// section with 50 questions no longer crowds out a weaker section with only 5.
export function pickWeightedQuestionsForSubject(studentId: number, subjectId: number, count: number, expectedTimePerQuestionMs: number): number[] {
  const stats = getQuestionStats(studentId, subjectId)
  const targetDifficulty = computeTargetDifficulty(stats)

  const bySection = new Map<SectionKey, QuestionStatsRow[]>()
  for (const s of stats) {
    const key: SectionKey = s.sectionId ?? UNSECTIONED_KEY
    const group = bySection.get(key)
    if (group) group.push(s)
    else bySection.set(key, [s])
  }

  interface SectionPool { weight: number, questions: WeightedQuestion[] }

  const sectionPool: SectionPool[] = [...bySection.values()].map((group) => {
    const timesSeen = group.reduce((sum, s) => sum + s.timesSeen, 0)
    const timesWrong = group.reduce((sum, s) => sum + s.timesWrong, 0)
    const lastSeenAt = group.reduce<number | null>(
      (latest, s) => (s.lastSeenAt === null ? latest : latest === null ? s.lastSeenAt : Math.max(latest, s.lastSeenAt)),
      null
    )

    return {
      weight: computeSectionWeight(timesSeen, timesWrong, lastSeenAt),
      questions: group.map(s => ({ id: s.questionId, weight: computeWeight(s, expectedTimePerQuestionMs, targetDifficulty) }))
    }
  })

  const picked: number[] = []
  for (let i = 0; i < count && sectionPool.length > 0; i++) {
    const sectionIdx = weightedRandomIndex(sectionPool.map(sec => sec.weight))
    const section = sectionPool[sectionIdx]!

    const questionIdx = weightedRandomIndex(section.questions.map(q => q.weight))
    picked.push(section.questions[questionIdx]!.id)
    section.questions.splice(questionIdx, 1)

    if (section.questions.length === 0) sectionPool.splice(sectionIdx, 1)
  }

  return picked
}
