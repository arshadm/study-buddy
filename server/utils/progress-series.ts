import { sql } from 'drizzle-orm'
import { db } from '../database/client'

export interface ProgressPoint {
  x: number // startedAt timestamp, ms
  percent: number
}

export interface StudentSeries {
  studentId: number
  studentName: string
  points: ProgressPoint[]
}

export interface SubjectProgress {
  subjectId: number
  subjectName: string
  students: StudentSeries[]
}

interface PaperAttemptRow {
  student_id: number
  student_name: string
  started_at: number
  correct: number
  total: number
}

interface SubjectSessionRow {
  subject_id: number
  subject_name: string
  student_id: number
  student_name: string
  started_at: number
  correct: number
  total: number
}

function groupIntoStudentSeries(rows: { student_id: number, student_name: string, started_at: number, correct: number, total: number }[]): StudentSeries[] {
  const byStudent = new Map<number, StudentSeries>()

  for (const row of rows) {
    if (!byStudent.has(row.student_id)) {
      byStudent.set(row.student_id, { studentId: row.student_id, studentName: row.student_name, points: [] })
    }
    if (row.total > 0) {
      byStudent.get(row.student_id)!.points.push({
        x: row.started_at,
        percent: Math.round((row.correct / row.total) * 100)
      })
    }
  }

  return Array.from(byStudent.values()).filter(s => s.points.length > 0)
}

export function getPaperAttemptsProgress(): StudentSeries[] {
  const rows = db.all<PaperAttemptRow>(sql`
    SELECT
      pa.student_id AS student_id,
      u.display_name AS student_name,
      pa.started_at AS started_at,
      SUM(qs.score_correct) AS correct,
      SUM(qs.score_total) AS total
    FROM paper_attempts pa
    INNER JOIN users u ON u.id = pa.student_id
    INNER JOIN quiz_sessions qs ON qs.paper_attempt_id = pa.id
    WHERE pa.status = 'completed'
    GROUP BY pa.id
    ORDER BY pa.started_at ASC
  `)

  return groupIntoStudentSeries(rows)
}

export function getSubjectSessionsProgress(): SubjectProgress[] {
  const rows = db.all<SubjectSessionRow>(sql`
    SELECT
      ssq.subject_id AS subject_id,
      sub.name AS subject_name,
      qs.student_id AS student_id,
      u.display_name AS student_name,
      qs.started_at AS started_at,
      SUM(CASE WHEN ssq.is_correct = 1 THEN 1 ELSE 0 END) AS correct,
      COUNT(*) AS total
    FROM quiz_session_questions ssq
    INNER JOIN quiz_sessions qs ON qs.id = ssq.quiz_session_id AND qs.status = 'completed'
    INNER JOIN users u ON u.id = qs.student_id
    INNER JOIN subjects sub ON sub.id = ssq.subject_id
    LEFT JOIN paper_attempts pa ON pa.id = qs.paper_attempt_id
    WHERE qs.paper_attempt_id IS NULL OR pa.status = 'completed'
    GROUP BY ssq.subject_id, qs.id
    ORDER BY qs.started_at ASC
  `)

  const bySubject = new Map<number, { subjectName: string, rows: SubjectSessionRow[] }>()
  for (const row of rows) {
    if (!bySubject.has(row.subject_id)) {
      bySubject.set(row.subject_id, { subjectName: row.subject_name, rows: [] })
    }
    bySubject.get(row.subject_id)!.rows.push(row)
  }

  return Array.from(bySubject.entries()).map(([subjectId, { subjectName, rows: subjectRows }]) => ({
    subjectId,
    subjectName,
    students: groupIntoStudentSeries(subjectRows)
  }))
}
