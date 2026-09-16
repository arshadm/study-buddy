<script setup lang="ts">
definePageMeta({ layout: 'student' })

interface Question {
  sequenceIndex: number
  imageUrl: string
  hintText: string | null
  options: { id: number, optionText: string, sortOrder: number }[]
}

interface SessionState {
  session: { id: number, status: string }
  question: Question | null
  remainingMs: number
  totalQuestions: number
}

const route = useRoute()
const sessionId = route.params.id as string

const state = ref<SessionState | null>(null)
const submitting = ref(false)
const questionPresentedAt = ref(0)

const remainingMsRef = computed(() => state.value?.remainingMs ?? 0)
const { formatted, start, sync } = useCountdown(remainingMsRef, handleExpire)

async function loadState() {
  const data = await $fetch<SessionState>(`/api/sessions/${sessionId}`)
  state.value = data
  sync(data.remainingMs)
  questionPresentedAt.value = Date.now()

  if (!data.question) {
    if (data.session.status === 'completed') {
      await navigateTo(`/review/${sessionId}`)
    }
    return
  }

  start()
}

async function handleExpire() {
  await $fetch(`/api/sessions/${sessionId}/finish`, { method: 'POST' }).catch(() => {})
  await navigateTo(`/review/${sessionId}`)
}

async function submitAnswer(optionId: number, hintUsed: boolean) {
  if (!state.value?.question) return
  submitting.value = true
  try {
    await $fetch(`/api/sessions/${sessionId}/answer`, {
      method: 'POST',
      body: {
        sequenceIndex: state.value.question.sequenceIndex,
        selectedOptionId: optionId,
        hintUsed,
        clientElapsedMs: Date.now() - questionPresentedAt.value
      }
    })
    await loadState()
  } catch {
    await loadState()
  } finally {
    submitting.value = false
  }
}

onMounted(loadState)
</script>

<template>
  <div
    v-if="state"
    class="max-w-2xl mx-auto space-y-6"
  >
    <div class="flex items-center justify-between">
      <p class="text-sm font-mono text-muted">
        Question {{ (state.question?.sequenceIndex ?? 0) + 1 }} / {{ state.totalQuestions }}
      </p>
      <p class="text-lg font-mono font-semibold tabular-nums">
        {{ formatted }}
      </p>
    </div>

    <UProgress
      :model-value="state.question ? state.question.sequenceIndex : state.totalQuestions"
      :max="state.totalQuestions"
    />

    <QuizQuestionCard
      v-if="state.question"
      :key="state.question.sequenceIndex"
      :image-url="state.question.imageUrl"
      :hint-text="state.question.hintText"
      :options="state.question.options"
      :submitting="submitting"
      @submit="submitAnswer"
    />

    <div
      v-else
      class="text-center py-16"
    >
      <p class="text-muted">
        Finishing up…
      </p>
    </div>
  </div>
</template>
