import { sql } from 'drizzle-orm'
import { db } from '../database/client'
import { questions, quizSessionQuestions, quizSessions } from '../database/schema'
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
// Applied to the student's wrong-rate (0..1) within a question's section ("category") — same
// shape as WRONG_ATTEMPT_WEIGHT but at category granularity, on top of the question's own factor.
const CATEGORY_WRONG_WEIGHT = 1.5

interface QuestionStatsRow {
  questionId: number
  sectionId: number | null
  timesSeen: number
  timesWrong: number
  lastSeenAt: number | null
  avgCorrectTimeMs: number | null
  difficulty: number | null
}

export interface CategoryStatsRow {
  sectionId: number
  timesSeen: number
  timesWrong: number
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
      SUM((100 - ${sql.raw(EFFECTIVE_PERCENT)}) / 100.0) AS times_wrong,
      MAX(ssq.answered_at) AS last_seen_at,
      AVG(CASE WHEN ${sql.raw(EFFECTIVE_PERCENT)} = 100 THEN ssq.time_spent_ms END) AS avg_correct_time_ms
    FROM ${questions} q
    LEFT JOIN ${quizSessionQuestions} ssq ON ssq.question_id = q.id
    LEFT JOIN ${quizSessions} s ON s.id = ssq.quiz_session_id AND s.student_id = ${studentId} AND s.status = 'completed'
    WHERE q.subject_id = ${subjectId} AND q.is_active = 1
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

// Per-section ("category") stats for a student within a subject — same signal as question
// stats (times seen/wrong), aggregated one level up, used to boost questions from sections the
// student is weak in even if that specific question hasn't been seen/gotten wrong before.
export function getCategoryStats(studentId: number, subjectId: number): CategoryStatsRow[] {
  const rows = db.all<{ section_id: number, times_seen: number, times_wrong: number }>(sql`
    SELECT
      q.section_id AS section_id,
      COUNT(ssq.id) AS times_seen,
      SUM((100 - ${sql.raw(EFFECTIVE_PERCENT)}) / 100.0) AS times_wrong
    FROM ${questions} q
    LEFT JOIN ${quizSessionQuestions} ssq ON ssq.question_id = q.id
    LEFT JOIN ${quizSessions} s ON s.id = ssq.quiz_session_id AND s.student_id = ${studentId} AND s.status = 'completed'
    WHERE q.subject_id = ${subjectId} AND q.is_active = 1 AND q.section_id IS NOT NULL
    GROUP BY q.section_id
  `)

  return rows.map(r => ({
    sectionId: r.section_id,
    timesSeen: r.times_seen ?? 0,
    timesWrong: r.times_wrong ?? 0
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

// categoryWrongRate: the student's wrong-rate (0..1) within this question's section, or 0 when
// the question is uncategorized (no sectionId) or the category has no history yet — a neutral
// factor of 1 either way.
export function computeWeight(stats: QuestionStatsRow, expectedTimePerQuestionMs: number, targetDifficulty: number, categoryWrongRate: number): number {
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

  const categoryFactor = 1 + categoryWrongRate * CATEGORY_WRONG_WEIGHT

  return wrongFactor * recencyBoost * slownessFactor * unseenBoost * difficultyFactor * categoryFactor
}

export function weightedSampleWithoutReplacement(items: WeightedQuestion[], n: number): number[] {
  const pool = [...items]
  const picked: number[] = []

  for (let i = 0; i < n && pool.length > 0; i++) {
    const total = pool.reduce((sum, it) => sum + it.weight, 0)
    let r = Math.random() * total
    let idx = 0
    for (; idx < pool.length - 1; idx++) {
      r -= pool[idx]!.weight
      if (r <= 0) break
    }
    picked.push(pool[idx]!.id)
    pool.splice(idx, 1)
  }

  return picked
}

export function pickWeightedQuestionsForSubject(studentId: number, subjectId: number, count: number, expectedTimePerQuestionMs: number): number[] {
  const stats = getQuestionStats(studentId, subjectId)
  const categoryStatsBySection = new Map(getCategoryStats(studentId, subjectId).map(c => [c.sectionId, c]))
  const targetDifficulty = computeTargetDifficulty(stats)

  const weighted = stats.map((s) => {
    const categoryStats = s.sectionId !== null ? categoryStatsBySection.get(s.sectionId) : undefined
    const categoryWrongRate = categoryStats && categoryStats.timesSeen > 0 ? categoryStats.timesWrong / categoryStats.timesSeen : 0
    return { id: s.questionId, weight: computeWeight(s, expectedTimePerQuestionMs, targetDifficulty, categoryWrongRate) }
  })

  return weightedSampleWithoutReplacement(weighted, count)
}
