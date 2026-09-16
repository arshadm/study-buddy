<script setup lang="ts">
definePageMeta({ layout: 'student' })

interface ReviewItem {
  sequenceIndex: number
  subjectName?: string
  imageUrl: string
  hintText: string | null
  hintUsed: boolean
  timeSpentMs: number | null
  isCorrect: boolean | null
  selectedOptionId: number | null
  options: { id: number, optionText: string, isCorrect: boolean }[]
}

interface ReviewResponse {
  session: { id: number, scoreCorrect: number | null, scoreTotal: number | null, timeLimitSeconds: number, startedAt: number, finishedAt: number | null }
  items: ReviewItem[]
}

const route = useRoute()
const { data } = await useFetch<ReviewResponse>(`/api/sessions/${route.params.id}/review`)

const percent = computed(() => {
  const s = data.value?.session
  if (!s?.scoreTotal) return 0
  return Math.round(((s.scoreCorrect ?? 0) / s.scoreTotal) * 100)
})

const timeTakenLabel = computed(() => {
  const s = data.value?.session
  if (!s?.finishedAt) return null
  const minutes = Math.round((s.finishedAt - s.startedAt) / 60000)
  return `${minutes} min`
})
</script>

<template>
  <div
    v-if="data"
    class="max-w-2xl mx-auto space-y-10"
  >
    <div class="rounded-lg border border-default p-6 text-center">
      <p class="text-sm font-mono text-primary mb-2">
        Session complete
      </p>
      <p class="text-4xl font-bold tracking-tight font-mono">
        {{ data.session.scoreCorrect }} / {{ data.session.scoreTotal }}
      </p>
      <p class="text-muted mt-1">
        {{ percent }}% correct<span v-if="timeTakenLabel"> · took {{ timeTakenLabel }}</span>
      </p>
      <div class="flex justify-center gap-3 mt-6">
        <UButton
          label="Start another session"
          to="/start"
        />
        <UButton
          label="View history"
          to="/history"
          variant="subtle"
          color="neutral"
        />
      </div>
    </div>

    <div class="space-y-6">
      <h2 class="text-lg font-bold tracking-tight">
        Question-by-question review
      </h2>

      <ReviewQuestionRow
        v-for="item in data.items"
        :key="item.sequenceIndex"
        :item="item"
        :index="item.sequenceIndex"
      />
    </div>
  </div>
</template>
