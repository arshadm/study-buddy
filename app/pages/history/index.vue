<script setup lang="ts">
definePageMeta({ layout: 'student' })

interface Subject { id: number, name: string }
interface HistoryItem {
  id: number
  scoreCorrect: number | null
  scoreTotal: number | null
  startedAt: number
  finishedAt: number | null
  subjects: { subjectId: number, subjectName: string }[]
}
interface SlowQuestion {
  questionId: number
  imageUrl: string
  subjectName: string
  avgTimeMs: number
  timesSeen: number
  timesCorrect: number
}
interface PaperAttemptResult {
  attempt: { id: number, status: string, startedAt: number }
  paperName: string
  overall: { correct: number, total: number }
}

const { data: subjects } = await useFetch<Subject[]>('/api/subjects')
const subjectFilter = ref<number | undefined>(undefined)

const { data: sessions, refresh } = await useFetch<HistoryItem[]>('/api/sessions', {
  query: computed(() => ({ subjectId: subjectFilter.value }))
})

const { data: slowQuestions } = await useFetch<SlowQuestion[]>('/api/sessions/slow-questions')
const { data: paperAttempts } = await useFetch<PaperAttemptResult[]>('/api/paper-attempts')

watch(subjectFilter, () => refresh())

function timeLabel(ms: number) {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function paperPercent(item: PaperAttemptResult) {
  if (!item.overall.total) return 0
  return Math.round((item.overall.correct / item.overall.total) * 100)
}

function percentFor(item: HistoryItem) {
  if (!item.scoreTotal) return 0
  return Math.round(((item.scoreCorrect ?? 0) / item.scoreTotal) * 100)
}

function dateLabel(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-8">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold tracking-tight">
        History
      </h1>
      <USelectMenu
        v-model="subjectFilter"
        :items="[{ label: 'All subjects', value: undefined }, ...(subjects || []).map(s => ({ label: s.name, value: s.id }))]"
        value-key="value"
        placeholder="All subjects"
        class="w-48"
      />
    </div>

    <div
      v-if="!sessions?.length"
      class="text-center py-16 text-muted"
    >
      No completed sessions yet.
    </div>

    <div
      v-else
      class="space-y-3"
    >
      <NuxtLink
        v-for="item in sessions"
        :key="item.id"
        :to="`/review/${item.id}`"
        class="block rounded-lg border border-default p-4 hover:border-muted transition-colors"
      >
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="font-medium">
              {{ item.subjects.map(s => s.subjectName).join(', ') }}
            </p>
            <p class="text-sm text-muted">
              {{ dateLabel(item.startedAt) }}
            </p>
          </div>
          <div class="text-right">
            <p class="font-mono font-semibold">
              {{ item.scoreCorrect }} / {{ item.scoreTotal }}
            </p>
            <p class="text-xs text-muted">
              {{ percentFor(item) }}%
            </p>
          </div>
        </div>
        <div class="mt-3 h-1.5 rounded-full bg-elevated overflow-hidden">
          <div
            class="h-full bg-primary rounded-full"
            :style="{ width: percentFor(item) + '%' }"
          />
        </div>
      </NuxtLink>
    </div>

    <div
      v-if="paperAttempts?.length"
      class="space-y-3"
    >
      <h2 class="text-lg font-bold tracking-tight">
        Mock papers
      </h2>
      <NuxtLink
        v-for="item in paperAttempts"
        :key="item.attempt.id"
        :to="`/paper-attempts/${item.attempt.id}/results`"
        class="rounded-lg border border-default p-4 flex items-center justify-between hover:border-muted transition-colors"
      >
        <div>
          <p class="font-medium">
            {{ item.paperName }}
          </p>
          <p class="text-sm text-muted">
            {{ dateLabel(item.attempt.startedAt) }}
          </p>
        </div>
        <div class="text-right">
          <p class="font-mono font-semibold">
            {{ item.overall.correct }} / {{ item.overall.total }}
          </p>
          <p class="text-xs text-muted">
            {{ paperPercent(item) }}%
          </p>
        </div>
      </NuxtLink>
    </div>

    <div
      v-if="slowQuestions?.length"
      class="space-y-3"
    >
      <h2 class="text-lg font-bold tracking-tight">
        Where time is going
      </h2>
      <p class="text-sm text-muted -mt-2">
        Your slowest questions on average, across completed sessions.
      </p>
      <div
        v-for="q in slowQuestions"
        :key="q.questionId"
        class="rounded-lg border border-default p-3 flex items-center gap-4"
      >
        <img
          :src="q.imageUrl"
          alt="Question"
          class="size-14 rounded-md object-contain bg-white border border-default shrink-0"
        >
        <div class="min-w-0 flex-1">
          <p class="text-xs font-mono text-muted">
            {{ q.subjectName }}
          </p>
          <p class="text-sm">
            Seen {{ q.timesSeen }}×, correct {{ q.timesCorrect }}×
          </p>
        </div>
        <p class="font-mono font-semibold shrink-0">
          {{ timeLabel(q.avgTimeMs) }}
        </p>
      </div>
    </div>
  </div>
</template>
