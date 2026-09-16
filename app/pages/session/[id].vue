<script setup lang="ts">
definePageMeta({ layout: 'student' })

interface Question {
  sequenceIndex: number
  imageUrl: string
  hintText: string | null
  selectedOptionId: number | null
  hintUsed: boolean
  options: { id: number, optionText: string, sortOrder: number }[]
}

interface SessionOverview {
  session: { id: number, status: string }
  remainingMs: number
  totalQuestions: number
  firstUnansweredIndex: number | null
}

const route = useRoute()
const sessionId = route.params.id as string

const overview = ref<SessionOverview | null>(null)
const currentQuestion = ref<Question | null>(null)
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
  const data = await $fetch<SessionOverview>(`/api/sessions/${sessionId}`)
  overview.value = data
  sync(data.remainingMs)

  if (data.session.status !== 'in_progress') {
    await navigateTo(`/review/${sessionId}`)
    return
  }

  if (data.totalQuestions === 0) {
    await finishSession()
    return
  }

  start()
  await goTo(data.firstUnansweredIndex ?? 0)
}

async function goTo(index: number) {
  if (!overview.value) return
  const clamped = Math.max(0, Math.min(index, overview.value.totalQuestions - 1))
  loadingQuestion.value = true
  try {
    currentQuestion.value = await $fetch<Question>(`/api/sessions/${sessionId}/questions/${clamped}`)
    currentIndex.value = clamped
    visitStartedAt.value = Date.now()
  } catch {
    await loadOverview()
  } finally {
    loadingQuestion.value = false
  }
}

async function handleAnswer(optionId: number, hintUsed: boolean) {
  saving.value = true
  try {
    await $fetch(`/api/sessions/${sessionId}/answer`, {
      method: 'POST',
      body: {
        sequenceIndex: currentIndex.value,
        selectedOptionId: optionId,
        hintUsed,
        clientElapsedMs: Date.now() - visitStartedAt.value
      }
    })
  } catch {
    // ignore transient save errors — the student can still navigate, and re-selecting retries
  } finally {
    saving.value = false
  }
}

async function finishSession() {
  finishing.value = true
  try {
    await $fetch(`/api/sessions/${sessionId}/finish`, { method: 'POST' })
  } catch {
    // if it already expired/finished server-side, fall through to review anyway
  }
  await navigateTo(`/review/${sessionId}`)
}

async function handleExpire() {
  await finishSession()
}

onMounted(loadOverview)
</script>

<template>
  <div
    v-if="overview"
    class="max-w-2xl mx-auto"
  >
    <div class="sticky top-0 z-10 -mx-4 px-4 py-3 bg-default/95 backdrop-blur border-b border-default space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-sm font-mono text-muted">
          Question {{ currentIndex + 1 }} / {{ overview.totalQuestions }}
        </p>
        <div class="flex items-center gap-4">
          <p class="text-lg font-mono font-semibold tabular-nums">
            {{ formatted }}
          </p>
          <UButton
            label="Finish session"
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
    </div>

    <div class="pt-6 space-y-6">
      <QuizQuestionCard
        v-if="currentQuestion"
        :key="currentQuestion.sequenceIndex"
        :image-url="currentQuestion.imageUrl"
        :hint-text="currentQuestion.hintText"
        :options="currentQuestion.options"
        :selected-option-id="currentQuestion.selectedOptionId"
        :hint-used="currentQuestion.hintUsed"
        :saving="saving"
        @answer="handleAnswer"
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
          label="Finish session"
          trailing-icon="i-lucide-check"
          :loading="finishing"
          @click="finishSession"
        />
      </div>
    </div>
  </div>
</template>
