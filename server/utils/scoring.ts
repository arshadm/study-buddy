// The "effective correctness percent" (0-100) for a quiz_session_questions row: self-marked
// questions store an explicit partial-credit score; every other question type is strictly 100
// (correct) or 0 (wrong) via is_correct. finishSession() forces is_correct to false for any
// row left unanswered, so this never sees a null is_correct on a completed session. Used as a
// raw SQL fragment (via sql.raw) wherever a row needs to contribute fractional credit to a sum
// — session score, question-selection weighting, progress charts.
export function effectivePercentSql(columnPrefix = '') {
  return `COALESCE(${columnPrefix}self_mark_score_percent, CASE WHEN ${columnPrefix}is_correct = 1 THEN 100 ELSE 0 END)`
}
