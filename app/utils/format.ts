// scoreCorrect can be fractional — self-marked questions contribute partial credit (e.g. 7.75).
// Rounds away float noise while keeping the quarter-point precision visible (e.g. "7.75").
export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0'
  return (Math.round(value * 100) / 100).toString()
}
