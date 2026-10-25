<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface ReviewItem {
  sequenceIndex: number
  subjectName?: string
  imageUrl: string
  workedSolutionImageUrl: string | null
  hintText: string | null
  hintUsed: boolean
  flagged: boolean
  timeSpentMs: number | null
  isCorrect: boolean | null
  selfMarkScorePercent: number | null
  type: 'multiple_choice' | 'self_marked_image'
  optionFormat: 'text' | 'image'
  selectedOptionId: number | null
  submittedAnswerText: string | null
  correctAnswerText: string | null
  submittedAnswerImageUrl: string | null
  options: { id: number, optionText: string | null, optionImageUrl: string | null, isCorrect: boolean }[]
}

interface ReviewResponse {
  session: { id: number, scoreCorrect: number | null, scoreTotal: number | null, timeLimitSeconds: number | null, startedAt: number, finishedAt: number | null }
  items: ReviewItem[]
}

const route = useRoute()
const studentId = route.params.id as string
const sessionId = route.params.sessionId as string

const { data } = await useFetch<ReviewResponse>(`/api/admin/students/${studentId}/sessions/${sessionId}/review`)

const percent = computed(() => {
  const s = data.value?.session
  if (!s?.scoreTotal) return 0
  return Math.round(((s.scoreCorrect ?? 0) / s.scoreTotal) * 100)
})
</script>

<template>
  <div
    v-if="data"
    class="max-w-2xl mx-auto space-y-8"
  >
    <UButton
      label="Back to student"
      icon="i-lucide-arrow-left"
      variant="subtle"
      color="neutral"
      size="sm"
      :to="`/admin/students/${studentId}`"
    />

    <div class="rounded-lg border border-default p-6 text-center">
      <p class="text-4xl font-bold tracking-tight font-mono">
        {{ formatScore(data.session.scoreCorrect) }} / {{ data.session.scoreTotal }}
      </p>
      <p class="text-muted mt-1">
        {{ percent }}% correct
      </p>
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
