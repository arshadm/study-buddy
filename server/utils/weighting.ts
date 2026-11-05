import { sql } from 'drizzle-orm'
import { db } from '../database/client'
import { documents, questions, questionTags, quizSessionQuestions, quizSessions, sections, subjectTags } from '../database/schema'
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

// Tag-level weakness (see computeTagWeight). Unlike the per-question factor this uses the
// *proportion* answered wrong, not the count, so a broad tag on many questions doesn't win picks
// just by having more attempts. TAG_PRIOR_* smooth the rate toward 50% until a tag has a few
// attempts, so one lucky/unlucky answer doesn't dominate.
const TAG_WRONG_RATE_WEIGHT = 3
const TAG_PRIOR_WRONG = 0.5
const TAG_PRIOR_SEEN = 1

// Questions with no tags compete as one pseudo-tag when no tag filter is applied.
const UNTAGGED_KEY = 'untagged'
type TagKey = number | typeof UNTAGGED_KEY

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

// Weakness weight for a tag (or the untagged pseudo-tag), from the stats of its questions —
// full credit: a question carrying several tags counts in full towards each.
function computeTagWeight(agg: TagAggregate): number {
  const wrongRate = (agg.timesWrong + TAG_PRIOR_WRONG) / (agg.timesSeen + TAG_PRIOR_SEEN)
  const wrongFactor = 1 + wrongRate * TAG_WRONG_RATE_WEIGHT

  let recencyBoost = 1.0
  if (agg.lastSeenAt !== null) {
    const daysSince = (Date.now() - agg.lastSeenAt) / (1000 * 60 * 60 * 24)
    recencyBoost = 1 + Math.max(0, 1 - daysSince / RECENCY_WINDOW_DAYS) * RECENCY_MAX_BOOST
  }

  const unseenBoost = agg.timesSeen === 0 ? UNSEEN_BOOST : 1.0

  return wrongFactor * recencyBoost * unseenBoost
}

export interface TagAggregate {
  timesSeen: number
  timesWrong: number
  lastSeenAt: number | null
}

function aggregate(rows: QuestionStatsRow[]): TagAggregate {
  return {
    timesSeen: rows.reduce((sum, s) => sum + s.timesSeen, 0),
    timesWrong: rows.reduce((sum, s) => sum + s.timesWrong, 0),
    lastSeenAt: rows.reduce<number | null>(
      (latest, s) => (s.lastSeenAt === null ? latest : latest === null ? s.lastSeenAt : Math.max(latest, s.lastSeenAt)),
      null
    )
  }
}

// tag id -> question ids, for this subject's tags.
function getQuestionTagMap(subjectId: number): Map<number, number[]> {
  const rows = db.all<{ tag_id: number, question_id: number }>(sql`
    SELECT qt.tag_id AS tag_id, qt.question_id AS question_id
    FROM ${questionTags} qt
    INNER JOIN ${subjectTags} t ON t.id = qt.tag_id
    WHERE t.subject_id = ${subjectId}
  `)
  const byTag = new Map<number, number[]>()
  for (const r of rows) {
    const list = byTag.get(r.tag_id)
    if (list) list.push(r.question_id)
    else byTag.set(r.tag_id, [r.question_id])
  }
  return byTag
}

// The student's record per tag over the subject's available questions (start page colours).
// score = percent correct (fractional credit for self-marks); null when never attempted.
export function getTagScores(studentId: number, subjectId: number): Map<number, { score: number | null, attempts: number }> {
  const statsById = new Map(getQuestionStats(studentId, subjectId).map(s => [s.questionId, s]))
  const result = new Map<number, { score: number | null, attempts: number }>()
  for (const [tagId, questionIds] of getQuestionTagMap(subjectId)) {
    const agg = aggregate(questionIds.map(id => statsById.get(id)).filter((s): s is QuestionStatsRow => s !== undefined))
    result.set(tagId, {
      score: agg.timesSeen > 0 ? Math.round(100 * (1 - agg.timesWrong / agg.timesSeen)) : null,
      attempts: agg.timesSeen
    })
  }
  return result
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

// Picks `count` questions for a subject in two steps per pick: first a tag, weighted by how weak
// the student is in it (see computeTagWeight), then a question carrying that tag, weighted by its
// own factor (see computeWeight). A tag's share of picks therefore reflects weakness rather than
// how many questions it has.
//
// `selectedTagIds` (the start page's filter) limits the competing tags to those — and so the
// questions to ones carrying at least one of them. With no filter, every tag of the subject
// competes, plus one pseudo-tag holding the untagged questions. A question with several tags sits
// in each of their pools and is removed from all of them once picked. Target difficulty is always
// computed from the whole subject, so a narrow filter doesn't skew it.
export function pickWeightedQuestionsForSubject(studentId: number, subjectId: number, count: number, expectedTimePerQuestionMs: number, selectedTagIds: number[] = []): number[] {
  const stats = getQuestionStats(studentId, subjectId)
  const targetDifficulty = computeTargetDifficulty(stats)
  const statsById = new Map(stats.map(s => [s.questionId, s]))
  const questionWeight = new Map(stats.map(s => [s.questionId, computeWeight(s, expectedTimePerQuestionMs, targetDifficulty)]))

  const tagMap = getQuestionTagMap(subjectId)
  const groups = new Map<TagKey, number[]>()
  const wanted = new Set(selectedTagIds)
  for (const [tagId, questionIds] of tagMap) {
    if (wanted.size > 0 && !wanted.has(tagId)) continue
    // Only available questions (getQuestionStats applies the active/published filter).
    const available = questionIds.filter(id => statsById.has(id))
    if (available.length > 0) groups.set(tagId, available)
  }
  if (wanted.size === 0) {
    const tagged = new Set([...tagMap.values()].flat())
    const untagged = stats.filter(s => !tagged.has(s.questionId)).map(s => s.questionId)
    if (untagged.length > 0) groups.set(UNTAGGED_KEY, untagged)
  }

  interface TagPool { weight: number, questions: Set<number> }
  const pools: TagPool[] = [...groups.values()].map(ids => ({
    weight: computeTagWeight(aggregate(ids.map(id => statsById.get(id)!))),
    questions: new Set(ids)
  }))

  const picked: number[] = []
  for (let i = 0; i < count; i++) {
    for (let p = pools.length - 1; p >= 0; p--) {
      if (pools[p]!.questions.size === 0) pools.splice(p, 1)
    }
    if (pools.length === 0) break

    const pool = pools[weightedRandomIndex(pools.map(tp => tp.weight))]!
    const candidates = [...pool.questions]
    const questionId = candidates[weightedRandomIndex(candidates.map(id => questionWeight.get(id)!))]!
    picked.push(questionId)
    for (const tp of pools) tp.questions.delete(questionId)
  }

  return picked
}
