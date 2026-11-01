export interface StartSubject {
  id: number
  name: string
  description: string | null
  categoryId: number | null
}

export interface SubjectChoice {
  questionCount: number
  timeLimitMinutes: number | null
  // Tag filter: questions with ANY of these tags. Empty = every question in the subject.
  tagIds: number[]
}

export interface SubjectTagOption {
  id: number
  name: string
  questionIds: number[]
}

export interface SubjectTagFilter {
  totalQuestions: number
  tags: SubjectTagOption[]
}

// How many questions a tag selection can draw from (union — a question with two selected tags
// counts once). No tags selected = the whole subject.
export function matchingQuestionCount(filter: SubjectTagFilter, tagIds: number[]): number {
  if (tagIds.length === 0) return filter.totalQuestions
  const ids = new Set<number>()
  for (const tag of filter.tags) {
    if (tagIds.includes(tag.id)) tag.questionIds.forEach(id => ids.add(id))
  }
  return ids.size
}

// Shared by the start page and the subject cards nested inside its category accordions, so
// selections made at any depth land in the one `choices` map the page submits.
export interface SubjectChoicesContext {
  choices: Record<number, SubjectChoice | undefined>
  toggle: (id: number) => void
}
export const SUBJECT_CHOICES_KEY = Symbol('subject-choices') as InjectionKey<SubjectChoicesContext>
