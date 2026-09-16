import { sql } from 'drizzle-orm'
import { db } from '../database/client'
import { questions, quizSessionQuestions, quizSessions } from '../database/schema'

// Tunable constants for the adaptive weighting formula.
const WRONG_ATTEMPT_WEIGHT = 1.5
const RECENCY_MAX_BOOST = 0.5
const RECENCY_WINDOW_DAYS = 30
const SLOWNESS_THRESHOLD_MULTIPLIER = 1.3
const SLOWNESS_FACTOR = 1.25
const UNSEEN_BOOST = 1.2
const DIFFICULTY_DISTANCE_PENALTY = 0.25

interface QuestionStatsRow {
  questionId: number
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
    times_seen: number
    times_wrong: number
    last_seen_at: number | null
    avg_correct_time_ms: number | null
    difficulty: number | null
  }>(sql`
    SELECT
      q.id AS question_id,
      q.difficulty AS difficulty,
      COUNT(ssq.id) AS times_seen,
      SUM(CASE WHEN ssq.is_correct = 0 THEN 1 ELSE 0 END) AS times_wrong,
      MAX(ssq.answered_at) AS last_seen_at,
      AVG(CASE WHEN ssq.is_correct = 1 THEN ssq.time_spent_ms END) AS avg_correct_time_ms
    FROM ${questions} q
    LEFT JOIN ${quizSessionQuestions} ssq ON ssq.question_id = q.id
    LEFT JOIN ${quizSessions} s ON s.id = ssq.quiz_session_id AND s.student_id = ${studentId} AND s.status = 'completed'
    WHERE q.subject_id = ${subjectId} AND q.is_active = 1
    GROUP BY q.id
  `)

  return rows.map(r => ({
    questionId: r.question_id,
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
  const targetDifficulty = computeTargetDifficulty(stats)
  const weighted = stats.map(s => ({ id: s.questionId, weight: computeWeight(s, expectedTimePerQuestionMs, targetDifficulty) }))
  return weightedSampleWithoutReplacement(weighted, count)
}
