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

const { data: subjects } = await useFetch<Subject[]>('/api/subjects')
const subjectFilter = ref<number | undefined>(undefined)

const { data: sessions, refresh } = await useFetch<HistoryItem[]>('/api/sessions', {
  query: computed(() => ({ subjectId: subjectFilter.value }))
})

watch(subjectFilter, () => refresh())

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
      <div
        v-for="item in sessions"
        :key="item.id"
        class="rounded-lg border border-default p-4"
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
      </div>
    </div>
  </div>
</template>
