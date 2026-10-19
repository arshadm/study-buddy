<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface ExistingSet { id: number, title: string }

interface Round {
  roundIndex: number
  promptText: string
  studentAnswerText: string | null
  gradingStatus: 'pending' | 'graded' | 'failed'
  llmVerdict: 'acceptable' | 'needs_more_info' | null
  llmFeedbackText: string | null
  answeredAt: number | null
  gradedAt: number | null
}
interface AttemptQuestion {
  openQuestionId: number
  promptText: string
  status: 'in_progress' | 'acceptable' | 'needs_review'
  roundCount: number
  rounds: Round[]
}
interface Attempt {
  setAttemptId: number
  studentId: number
  studentName: string
  status: 'in_progress' | 'completed'
  startedAt: number
  completedAt: number | null
  needsReviewCount: number
  questions: AttemptQuestion[]
}

const route = useRoute()
const subjectId = route.params.id as string
const sectionId = route.params.sectionId as string
const setId = route.params.setId as string

const { data: set } = await useFetch<ExistingSet>(`/api/admin/open-question-sets/${setId}`)
const { data: attempts } = await useFetch<Attempt[]>('/api/admin/open-question-set-attempts', {
  query: { setId }
})

const expanded = ref<Set<number>>(new Set())
function toggle(setAttemptId: number) {
  const next = new Set(expanded.value)
  if (next.has(setAttemptId)) next.delete(setAttemptId)
  else next.add(setAttemptId)
  expanded.value = next
}

function statusLabel(status: AttemptQuestion['status']) {
  if (status === 'acceptable') return 'Acceptable'
  if (status === 'needs_review') return 'Needs review'
  return 'In progress'
}

function formatDate(ms: number | null) {
  if (!ms) return ''
  return new Date(ms).toLocaleString()
}
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6">
    <div class="flex items-center gap-3">
      <UButton
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
        :to="`/admin/subjects/${subjectId}/sections/${sectionId}/open-question-sets/${setId}`"
      />
      <h1 class="text-2xl font-bold tracking-tight">
        {{ set?.title }} — review
      </h1>
    </div>

    <p
      v-if="!attempts?.length"
      class="text-center py-16 text-muted"
    >
      No students have attempted this activity yet.
    </p>

    <div
      v-else
      class="space-y-3"
    >
      <div
        v-for="attempt in attempts"
        :key="attempt.setAttemptId"
        class="rounded-lg border p-4 space-y-3"
        :class="attempt.needsReviewCount > 0 ? 'border-warning/40' : 'border-default'"
      >
        <button
          type="button"
          class="w-full flex items-center justify-between gap-3 text-left"
          @click="toggle(attempt.setAttemptId)"
        >
          <div>
            <p class="font-medium">
              {{ attempt.studentName }}
            </p>
            <p class="text-xs font-mono text-muted">
              {{ attempt.status === 'completed' ? 'Completed' : 'In progress' }} · started {{ formatDate(attempt.startedAt) }}
              <span
                v-if="attempt.needsReviewCount > 0"
                class="text-warning"
              > · {{ attempt.needsReviewCount }} need{{ attempt.needsReviewCount === 1 ? 's' : '' }} review</span>
            </p>
          </div>
          <UIcon
            :name="expanded.has(attempt.setAttemptId) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="shrink-0"
          />
        </button>

        <div
          v-if="expanded.has(attempt.setAttemptId)"
          class="space-y-3"
        >
          <div
            v-for="question in attempt.questions"
            :key="question.openQuestionId"
            class="rounded-md border p-3 space-y-2"
            :class="question.status === 'needs_review' ? 'border-warning/40 bg-warning/5' : 'border-default'"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="font-medium text-sm">
                <MathText :text="question.promptText" />
              </p>
              <span
                class="text-xs font-mono shrink-0"
                :class="question.status === 'acceptable' ? 'text-success' : question.status === 'needs_review' ? 'text-warning' : 'text-muted'"
              >{{ statusLabel(question.status) }}</span>
            </div>

            <div
              v-for="round in question.rounds"
              :key="round.roundIndex"
              class="rounded bg-elevated p-2 text-sm space-y-1"
            >
              <p
                v-if="round.roundIndex > 0"
                class="text-xs text-muted"
              >
                Follow-up: <MathText :text="round.promptText" />
              </p>
              <p v-if="round.studentAnswerText">
                Answer: {{ round.studentAnswerText }}
              </p>
              <p
                v-if="round.gradingStatus === 'failed'"
                class="text-xs text-error"
              >
                Grading failed for this round
              </p>
              <p
                v-else-if="round.llmFeedbackText"
                class="text-xs text-muted"
              >
                Feedback: {{ round.llmFeedbackText }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
