<script setup lang="ts">
definePageMeta({ layout: 'student' })

interface Section {
  sectionIndex: number
  subjectName: string | null
  sessionId: number
  status: string
  scoreCorrect: number | null
  scoreTotal: number | null
}

interface Results {
  paperName: string
  sections: Section[]
  overall: { correct: number, total: number }
}

const route = useRoute()
const { data } = await useFetch<Results>(`/api/paper-attempts/${route.params.id}/results`)

const percent = computed(() => {
  if (!data.value?.overall.total) return 0
  return Math.round((data.value.overall.correct / data.value.overall.total) * 100)
})

function sectionPercent(section: Section) {
  if (!section.scoreTotal) return 0
  return Math.round(((section.scoreCorrect ?? 0) / section.scoreTotal) * 100)
}
</script>

<template>
  <div
    v-if="data"
    class="max-w-2xl mx-auto space-y-8"
  >
    <div class="rounded-lg border border-default p-6 text-center">
      <p class="text-sm font-mono text-primary mb-2">
        {{ data.paperName }} complete
      </p>
      <p class="text-4xl font-bold tracking-tight font-mono">
        {{ data.overall.correct }} / {{ data.overall.total }}
      </p>
      <p class="text-muted mt-1">
        {{ percent }}% correct overall
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

    <div class="space-y-3">
      <h2 class="text-lg font-bold tracking-tight">
        By section
      </h2>
      <NuxtLink
        v-for="section in data.sections"
        :key="section.sessionId"
        :to="`/review/${section.sessionId}`"
        class="rounded-lg border border-default p-4 flex items-center justify-between hover:border-muted transition-colors"
      >
        <div>
          <p class="font-medium">
            Section {{ section.sectionIndex + 1 }}: {{ section.subjectName }}
          </p>
          <p class="text-sm text-muted">
            Tap to review answers
          </p>
        </div>
        <div class="text-right">
          <p class="font-mono font-semibold">
            {{ section.scoreCorrect }} / {{ section.scoreTotal }}
          </p>
          <p class="text-xs text-muted">
            {{ sectionPercent(section) }}%
          </p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
