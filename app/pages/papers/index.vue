<script setup lang="ts">
definePageMeta({ layout: 'student' })

interface Paper {
  id: number
  name: string
  description: string | null
  sections: { id: number, subjectName: string, questionCount: number, timeLimitSeconds: number }[]
}

const { data: papers } = await useFetch<Paper[]>('/api/papers')
const starting = ref<number | null>(null)
const errorMessage = ref('')

function totalMinutes(paper: Paper) {
  return Math.round(paper.sections.reduce((sum, s) => sum + s.timeLimitSeconds, 0) / 60)
}

function totalQuestions(paper: Paper) {
  return paper.sections.reduce((sum, s) => sum + s.questionCount, 0)
}

async function startPaper(paper: Paper) {
  errorMessage.value = ''
  starting.value = paper.id
  try {
    const { sessionId } = await $fetch('/api/paper-attempts', { method: 'POST', body: { paperId: paper.id } })
    await navigateTo(`/session/${sessionId}`)
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Could not start paper')
  } finally {
    starting.value = null
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-8">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">
        Mock papers
      </h1>
      <p class="text-muted mt-1">
        Each section has its own timer, run back-to-back — once you move on you can't go back to
        the previous section, just like the real exam.
      </p>
    </div>

    <p
      v-if="!papers?.length"
      class="text-center py-16 text-muted"
    >
      No papers available yet.
    </p>

    <div
      v-else
      class="space-y-4"
    >
      <div
        v-for="paper in papers"
        :key="paper.id"
        class="rounded-lg border border-default p-4 space-y-3"
      >
        <div>
          <p class="font-semibold">
            {{ paper.name }}
          </p>
          <p
            v-if="paper.description"
            class="text-sm text-muted"
          >
            {{ paper.description }}
          </p>
          <p class="text-xs font-mono text-muted mt-2">
            {{ paper.sections.map(s => s.subjectName).join(' → ') }} · {{ totalQuestions(paper) }} questions · {{ totalMinutes(paper) }} min total
          </p>
        </div>
        <UButton
          label="Start paper"
          :loading="starting === paper.id"
          @click="startPaper(paper)"
        />
      </div>
    </div>

    <p
      v-if="errorMessage"
      class="text-sm text-error"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>
