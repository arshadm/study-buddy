<script setup lang="ts">
definePageMeta({ layout: 'student' })

interface Question {
  sequenceIndex: number
  type: 'multiple_choice' | 'free_response'
  imageUrl: string
  hintText: string | null
  answerUnitHint: string | null
  selectedOptionId: number | null
  submittedAnswerText: string | null
  hintUsed: boolean
  flagged: boolean
  options: { id: number, optionText: string, sortOrder: number }[]
}

interface PaperContext {
  attemptId: number
  paperName: string
  sectionIndex: number
  totalSections: number
  sectionSubjectName: string | null
}

interface SessionOverview {
  session: { id: number, status: string } | null
  remainingMs: number
  totalQuestions: number
  firstUnansweredIndex: number | null
  paper: PaperContext | null
  advance?: { done: boolean, sessionId: number | null }
}

interface QuestionSummary {
  sequenceIndex: number
  answered: boolean
  flagged: boolean
}

const route = useRoute()
const sessionId = computed(() => route.params.id as string)

const overview = ref<SessionOverview | null>(null)
const currentQuestion = ref<Question | null>(null)
const questionSummaries = ref<QuestionSummary[]>([])
const currentIndex = ref(0)
const loadingQuestion = ref(false)
const saving = ref(false)
const finishing = ref(false)
const visitStartedAt = ref(Date.now())

const remainingMsRef = computed(() => overview.value?.remainingMs ?? 0)
const { formatted, start, sync } = useCountdown(remainingMsRef, handleExpire)

const isLastQuestion = computed(() => {
  if (!overview.value) return false
  return currentIndex.value >= overview.value.totalQuestions - 1
})

async function loadOverview() {
  overview.value = null
  currentQuestion.value = null

  const data = await $fetch<SessionOverview>(`/api/sessions/${sessionId.value}`)

  if (!data.session) {
    if (data.advance?.done) {
      await navigateTo(data.paper ? `/paper-attempts/${data.paper.attemptId}/results` : '/history')
    } else if (data.advance?.sessionId) {
      await navigateTo(`/session/${data.advance.sessionId}`, { replace: true })
    }
    return
  }

  overview.value = data
  sync(data.remainingMs)

  if (data.session.status !== 'in_progress') {
    await navigateTo(`/review/${sessionId.value}`)
    return
  }

  if (data.totalQuestions === 0) {
    await finishSession()
    return
  }

  await loadSummaries()
  start()
  await goTo(data.firstUnansweredIndex ?? 0)
}

async function loadSummaries() {
  questionSummaries.value = await $fetch<QuestionSummary[]>(`/api/sessions/${sessionId.value}/questions`)
}

async function goTo(index: number) {
  if (!overview.value) return
  const clamped = Math.max(0, Math.min(index, overview.value.totalQuestions - 1))
  loadingQuestion.value = true
  try {
    currentQuestion.value = await $fetch<Question>(`/api/sessions/${sessionId.value}/questions/${clamped}`)
    currentIndex.value = clamped
    visitStartedAt.value = Date.now()
  } catch {
    await loadOverview()
  } finally {
    loadingQuestion.value = false
  }
}

async function handleAnswer(payload: { selectedOptionId?: number, answerText?: string, hintUsed: boolean }) {
  saving.value = true
  try {
    await $fetch(`/api/sessions/${sessionId.value}/answer`, {
      method: 'POST',
      body: {
        sequenceIndex: currentIndex.value,
        ...payload,
        clientElapsedMs: Date.now() - visitStartedAt.value
      }
    })
    const summary = questionSummaries.value.find(s => s.sequenceIndex === currentIndex.value)
    if (summary) summary.answered = true
  } catch {
    // ignore transient save errors — the student can still navigate, and re-selecting retries
  } finally {
    saving.value = false
  }
}

async function toggleFlag() {
  if (!currentQuestion.value) return
  const next = !currentQuestion.value.flagged
  currentQuestion.value.flagged = next
  const summary = questionSummaries.value.find(s => s.sequenceIndex === currentIndex.value)
  if (summary) summary.flagged = next
  await $fetch(`/api/sessions/${sessionId.value}/flag`, {
    method: 'POST',
    body: { sequenceIndex: currentIndex.value, flagged: next }
  }).catch(() => {})
}

async function finishSession() {
  finishing.value = true
  try {
    if (overview.value?.paper) {
      const result = await $fetch<{ done: boolean, sessionId: number | null }>(`/api/paper-attempts/${overview.value.paper.attemptId}/advance`, { method: 'POST' })
      if (result.done) {
        await navigateTo(`/paper-attempts/${overview.value.paper.attemptId}/results`)
      } else if (result.sessionId) {
        await navigateTo(`/session/${result.sessionId}`, { replace: true })
      }
      return
    }
    await $fetch(`/api/sessions/${sessionId.value}/finish`, { method: 'POST' })
  } catch {
    // if it already expired/finished server-side, fall through to review anyway
  }
  await navigateTo(`/review/${sessionId.value}`)
}

async function handleExpire() {
  await finishSession()
}

onMounted(loadOverview)
watch(sessionId, loadOverview)
</script>

<template>
  <div
    v-if="overview"
    class="max-w-2xl mx-auto"
  >
    <div class="sticky top-0 z-10 -mx-4 px-4 py-3 bg-default/95 backdrop-blur border-b border-default space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-sm font-mono text-muted">
          <template v-if="overview.paper">
            Section {{ overview.paper.sectionIndex + 1 }} / {{ overview.paper.totalSections }}: {{ overview.paper.sectionSubjectName }} ·
          </template>
          Question {{ currentIndex + 1 }} / {{ overview.totalQuestions }}
        </p>
        <div class="flex items-center gap-4">
          <p class="text-lg font-mono font-semibold tabular-nums">
            {{ formatted }}
          </p>
          <UButton
            label="Finish"
            variant="subtle"
            color="neutral"
            size="xs"
            :loading="finishing"
            @click="finishSession"
          />
        </div>
      </div>
      <UProgress
        :model-value="currentIndex + 1"
        :max="overview.totalQuestions"
      />
      <div class="flex flex-wrap gap-1">
        <button
          v-for="summary in questionSummaries"
          :key="summary.sequenceIndex"
          type="button"
          class="size-6 rounded text-[11px] font-mono flex items-center justify-center border transition-colors"
          :class="[
            summary.sequenceIndex === currentIndex ? 'border-primary text-primary' : 'border-default text-muted',
            summary.answered && summary.sequenceIndex !== currentIndex ? 'bg-elevated' : ''
          ]"
          @click="goTo(summary.sequenceIndex)"
        >
          <UIcon
            v-if="summary.flagged"
            name="i-lucide-flag"
            class="size-3 text-warning"
          />
          <template v-else>
            {{ summary.sequenceIndex + 1 }}
          </template>
        </button>
      </div>
    </div>

    <div class="pt-6 space-y-6">
      <QuizQuestionCard
        v-if="currentQuestion"
        :key="currentQuestion.sequenceIndex"
        :type="currentQuestion.type"
        :image-url="currentQuestion.imageUrl"
        :hint-text="currentQuestion.hintText"
        :answer-unit-hint="currentQuestion.answerUnitHint"
        :options="currentQuestion.options"
        :selected-option-id="currentQuestion.selectedOptionId"
        :submitted-answer-text="currentQuestion.submittedAnswerText"
        :hint-used="currentQuestion.hintUsed"
        :flagged="currentQuestion.flagged"
        :saving="saving"
        @answer="handleAnswer"
        @toggle-flag="toggleFlag"
      />

      <div
        v-else
        class="text-center py-16 text-muted"
      >
        Loading question…
      </div>

      <div class="flex items-center justify-between gap-3">
        <UButton
          label="Back"
          icon="i-lucide-arrow-left"
          variant="subtle"
          color="neutral"
          :disabled="currentIndex === 0 || loadingQuestion"
          @click="goTo(currentIndex - 1)"
        />
        <UButton
          v-if="!isLastQuestion"
          label="Next"
          trailing-icon="i-lucide-arrow-right"
          :disabled="loadingQuestion"
          @click="goTo(currentIndex + 1)"
        />
        <UButton
          v-else
          :label="overview.paper && overview.paper.sectionIndex + 1 < overview.paper.totalSections ? 'Finish section' : 'Finish'"
          trailing-icon="i-lucide-check"
          :loading="finishing"
          @click="finishSession"
        />
      </div>
    </div>
  </div>
</template>
