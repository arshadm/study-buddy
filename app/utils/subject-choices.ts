export interface StartSubject {
  id: number
  name: string
  description: string | null
  categoryId: number | null
}

export interface SubjectChoice {
  questionCount: number
  timeLimitMinutes: number | null
}

// Shared by the start page and the subject cards nested inside its category accordions, so
// selections made at any depth land in the one `choices` map the page submits.
export interface SubjectChoicesContext {
  choices: Record<number, SubjectChoice | undefined>
  toggle: (id: number) => void
}
export const SUBJECT_CHOICES_KEY = Symbol('subject-choices') as InjectionKey<SubjectChoicesContext>
