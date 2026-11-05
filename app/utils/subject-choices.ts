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
  // The student's percent correct over this tag's questions; null = not tried yet.
  score: number | null
  attempts: number
}

export type TagBand = 'weak' | 'fair' | 'strong' | 'untried'

export function tagBand(score: number | null): TagBand {
  if (score === null) return 'untried'
  if (score < 50) return 'weak'
  if (score < 75) return 'fair'
  return 'strong'
}

// Full class strings (not built dynamically) so Tailwind keeps them.
export const TAG_BAND_CLASSES: Record<TagBand, { idle: string, selected: string, dot: string, label: string }> = {
  weak: { idle: 'border-error/50 bg-error/10 hover:bg-error/20', selected: 'border-error bg-error text-inverted', dot: 'bg-error', label: 'Needs work (under 50%)' },
  fair: { idle: 'border-warning/50 bg-warning/10 hover:bg-warning/20', selected: 'border-warning bg-warning text-inverted', dot: 'bg-warning', label: 'Getting there (50–74%)' },
  strong: { idle: 'border-success/50 bg-success/10 hover:bg-success/20', selected: 'border-success bg-success text-inverted', dot: 'bg-success', label: 'Strong (75%+)' },
  untried: { idle: 'border-default bg-default hover:bg-elevated', selected: 'border-inverted bg-inverted text-inverted', dot: 'bg-accented', label: 'Not tried yet' }
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
