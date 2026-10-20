export const WINDOWS_DAYS = [7, 14, 28] as const
export const DAY_MS = 24 * 60 * 60 * 1000

export interface PerformanceEvent {
  isCorrect: boolean | null
  startedAt: number
}

// Shared by the subject- and category-level performance dashboards — rolling accuracy over
// each window, counting only answered events (isCorrect !== null).
export function computeWindows(rows: PerformanceEvent[]): Record<number, { percent: number | null, questions: number }> {
  const now = Date.now()

  return Object.fromEntries(WINDOWS_DAYS.map((days) => {
    const windowCutoff = now - days * DAY_MS
    const inWindow = rows.filter(r => r.startedAt >= windowCutoff)
    const answered = inWindow.filter(r => r.isCorrect !== null)
    const correct = answered.filter(r => r.isCorrect).length

    return [days, {
      percent: answered.length > 0 ? Math.round((correct / answered.length) * 100) : null,
      questions: answered.length
    }]
  }))
}
