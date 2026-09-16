interface FreeResponseQuestion {
  answerType: 'numeric' | 'text' | null
  answerNumericValue: number | null
  answerTolerancePercent: number | null
  answerText: string | null
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function checkFreeResponseAnswer(question: FreeResponseQuestion, submitted: string): boolean {
  if (question.answerType === 'numeric') {
    const parsed = Number(submitted)
    if (Number.isNaN(parsed) || question.answerNumericValue === null) return false
    const tolerance = Math.abs(question.answerNumericValue) * ((question.answerTolerancePercent ?? 0) / 100)
    return Math.abs(parsed - question.answerNumericValue) <= tolerance
  }

  if (question.answerType === 'text') {
    if (question.answerText === null) return false
    return normalizeText(submitted) === normalizeText(question.answerText)
  }

  return false
}
