<script setup lang="ts">
definePageMeta({ layout: 'student' })

interface PriorRound { promptText: string, answerText: string, feedback: string }
interface CurrentQuestion {
  openQuestionId: number
  index: number
  originalQuestion: string
  status: 'in_progress' | 'acceptable' | 'needs_review'
  roundCount: number
  priorRounds: PriorRound[]
  currentRound: { promptText: string, studentAnswerText: string | null, gradingStatus: 'pending' | 'graded' | 'failed' }
}
interface SummaryItem { index: number, promptText: string, status: 'in_progress' | 'acceptable' | 'needs_review' }
interface DiscussionState {
  setAttemptId: number
  setTitle: string
  passageText: string | null
  status: 'in_progress' | 'completed'
  totalQuestions: number
  currentQuestion: CurrentQuestion | null
  summary: SummaryItem[]
  lastResult?: { verdict: 'acceptable' | 'needs_more_info', feedback: string, questionStatus: 'in_progress' | 'acceptable' | 'needs_review' } | null
}

const route = useRoute()
const attemptId = route.params.attemptId as string

const { data: state, refresh } = await useFetch<DiscussionState>(`/api/discussions/attempts/${attemptId}`)

const answerText = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const transition = ref<{ feedback: string, questionStatus: string } | null>(null)
const lastQuestionId = ref<number | null>(null)

function syncLocalStateFrom(data: DiscussionState) {
  answerText.value = data.currentQuestion?.currentRound.studentAnswerText ?? ''

  const newQuestionId = data.currentQuestion?.openQuestionId ?? null
  if (data.lastResult && newQuestionId !== lastQuestionId.value) {
    transition.value = { feedback: data.lastResult.feedback, questionStatus: data.lastResult.questionStatus }
  } else {
    transition.value = null
  }
  lastQuestionId.value = newQuestionId
}

watch(state, (data) => {
  if (data) syncLocalStateFrom(data)
}, { immediate: true })

async function submitAnswer() {
  if (!answerText.value.trim()) {
    errorMessage.value = 'Type an answer first'
    return
  }

  submitting.value = true
  errorMessage.value = ''
  try {
    const result = await $fetch<DiscussionState>(`/api/discussions/attempts/${attemptId}/answer`, {
      method: 'POST',
      body: { answerText: answerText.value.trim() }
    })
    state.value = result
    syncLocalStateFrom(result)
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Could not grade this answer — your answer has been saved, try again')
    await refresh()
  } finally {
    submitting.value = false
  }
}

function summaryLabel(status: SummaryItem['status']) {
  if (status === 'acceptable') return 'Correct'
  if (status === 'needs_review') return 'Needs review'
  return 'In progress'
}
</script>

<template>
  <div
    v-if="state"
    class="max-w-2xl mx-auto space-y-6"
  >
    <div>
      <p class="text-sm font-mono text-muted">
        <template v-if="state.currentQuestion">
          Question {{ state.currentQuestion.index + 1 }} / {{ state.totalQuestions }}
        </template>
        <template v-else>
          All questions done
        </template>
      </p>
      <h1 class="text-2xl font-bold tracking-tight">
        {{ state.setTitle }}
      </h1>
    </div>

    <div
      v-if="state.passageText"
      class="rounded-lg border border-default p-4 bg-elevated"
    >
      <p class="text-xs font-mono text-muted mb-1">
        Passage
      </p>
      <p class="whitespace-pre-wrap text-sm">
        {{ state.passageText }}
      </p>
    </div>

    <template v-if="state.currentQuestion">
      <div
        v-if="transition"
        class="rounded-lg border p-4 space-y-1"
        :class="transition.questionStatus === 'acceptable' ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5'"
      >
        <p
          class="text-sm font-medium"
          :class="transition.questionStatus === 'acceptable' ? 'text-success' : 'text-warning'"
        >
          {{ transition.questionStatus === 'acceptable' ? 'Correct — nice work' : "This one will be reviewed by your teacher" }}
        </p>
        <p class="text-sm text-muted">
          {{ transition.feedback }}
        </p>
      </div>

      <div class="rounded-lg border border-default p-4 space-y-3">
        <p class="font-medium">
          <MathText :text="state.currentQuestion.originalQuestion" />
        </p>

        <div
          v-for="(round, index) in state.currentQuestion.priorRounds"
          :key="index"
          class="rounded-md bg-elevated p-3 space-y-1 text-sm"
        >
          <p
            v-if="index > 0"
            class="text-muted"
          >
            Follow-up: <MathText :text="round.promptText" />
          </p>
          <p>Your answer: {{ round.answerText }}</p>
          <p class="text-muted">
            Feedback: {{ round.feedback }}
          </p>
        </div>

        <p
          v-if="state.currentQuestion.currentRound.promptText !== state.currentQuestion.originalQuestion"
          class="text-sm font-medium"
        >
          Follow-up: <MathText :text="state.currentQuestion.currentRound.promptText" />
        </p>

        <p
          v-if="state.currentQuestion.currentRound.gradingStatus === 'failed'"
          class="text-sm text-error"
        >
          Grading failed last time — your answer below was saved, try submitting again.
        </p>

        <UTextarea
          v-model="answerText"
          class="w-full"
          :rows="4"
          placeholder="Type your answer in your own words"
        />

        <p
          v-if="errorMessage"
          class="text-sm text-error"
        >
          {{ errorMessage }}
        </p>

        <UButton
          label="Submit answer"
          :loading="submitting"
          @click="submitAnswer"
        />
      </div>
    </template>

    <div
      v-else
      class="space-y-4"
    >
      <div
        v-if="transition"
        class="rounded-lg border p-4 space-y-1"
        :class="transition.questionStatus === 'acceptable' ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5'"
      >
        <p
          class="text-sm font-medium"
          :class="transition.questionStatus === 'acceptable' ? 'text-success' : 'text-warning'"
        >
          {{ transition.questionStatus === 'acceptable' ? 'Correct — nice work' : "This one will be reviewed by your teacher" }}
        </p>
        <p class="text-sm text-muted">
          {{ transition.feedback }}
        </p>
      </div>

      <div class="rounded-lg border border-default p-4 text-center space-y-1">
        <p class="font-semibold">
          You've finished this activity
        </p>
        <p class="text-sm text-muted">
          {{ state.summary.filter(s => s.status === 'acceptable').length }} / {{ state.summary.length }} answered correctly
        </p>
      </div>

      <div class="space-y-2">
        <div
          v-for="item in state.summary"
          :key="item.index"
          class="rounded-md border border-default p-3 flex items-center justify-between gap-3"
        >
          <p class="text-sm truncate">
            {{ item.index + 1 }}. <MathText :text="item.promptText" />
          </p>
          <span
            class="text-xs font-mono shrink-0"
            :class="item.status === 'acceptable' ? 'text-success' : 'text-warning'"
          >{{ summaryLabel(item.status) }}</span>
        </div>
      </div>

      <UButton
        label="Back to discussions"
        variant="subtle"
        color="neutral"
        to="/discussions"
      />
    </div>
  </div>
</template>
