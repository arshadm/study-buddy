import { sql } from 'drizzle-orm'
import { db } from '../database/client'

interface SlowQuestionRow {
  question_id: number
  image_path: string
  subject_name: string
  avg_time_ms: number
  times_seen: number
  times_correct: number
}

export interface SlowQuestion {
  questionId: number
  imageUrl: string
  subjectName: string
  avgTimeMs: number
  timesSeen: number
  timesCorrect: number
}

export function getSlowQuestions(studentId: number, subjectId?: number, limit = 5): SlowQuestion[] {
  const rows = db.all<SlowQuestionRow>(sql`
    SELECT
      q.id AS question_id,
      q.image_path AS image_path,
      sub.name AS subject_name,
      AVG(ssq.time_spent_ms) AS avg_time_ms,
      COUNT(*) AS times_seen,
      SUM(CASE WHEN ssq.is_correct = 1 THEN 1 ELSE 0 END) AS times_correct
    FROM quiz_session_questions ssq
    INNER JOIN quiz_sessions s ON s.id = ssq.quiz_session_id AND s.status = 'completed' AND s.student_id = ${studentId}
    LEFT JOIN paper_attempts pa ON pa.id = s.paper_attempt_id
    INNER JOIN questions q ON q.id = ssq.question_id
    INNER JOIN subjects sub ON sub.id = q.subject_id
    WHERE ssq.time_spent_ms IS NOT NULL
    -- A mock-paper section only counts once the whole paper is done, not as
    -- each section individually finishes.
    AND (s.paper_attempt_id IS NULL OR pa.status = 'completed')
    ${subjectId ? sql`AND q.subject_id = ${subjectId}` : sql``}
    GROUP BY q.id
    ORDER BY avg_time_ms DESC
    LIMIT ${limit}
  `)

  return rows.map(r => ({
    questionId: r.question_id,
    imageUrl: `/uploads/${r.image_path}`,
    subjectName: r.subject_name,
    avgTimeMs: Math.round(r.avg_time_ms),
    timesSeen: r.times_seen,
    timesCorrect: r.times_correct
  }))
}
