<script setup lang="ts">
definePageMeta({ layout: 'student' })

interface DiscussionSet {
  id: number
  title: string
  subjectName: string
  questionCount: number
  status: 'in_progress' | 'completed' | null
  attemptId: number | null
}

const { data: sets } = await useFetch<DiscussionSet[]>('/api/discussions')
const starting = ref<number | null>(null)
const errorMessage = ref('')

function statusLabel(status: DiscussionSet['status']) {
  if (status === 'completed') return 'Completed'
  if (status === 'in_progress') return 'In progress'
  return 'Not started'
}

function buttonLabel(status: DiscussionSet['status']) {
  if (status === 'completed') return 'Review'
  if (status === 'in_progress') return 'Continue'
  return 'Start'
}

async function openSet(set: DiscussionSet) {
  errorMessage.value = ''
  starting.value = set.id
  try {
    const { attemptId } = await $fetch<{ attemptId: number }>(`/api/discussions/${set.id}/start`, { method: 'POST' })
    await navigateTo(`/discussions/${attemptId}`)
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Could not open this activity')
  } finally {
    starting.value = null
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-8">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">
        Discussions
      </h1>
      <p class="text-muted mt-1">
        Answer in your own words — your answers are checked for understanding, with follow-up
        questions if something's missing, instead of a single right/wrong answer.
      </p>
    </div>

    <p
      v-if="!sets?.length"
      class="text-center py-16 text-muted"
    >
      No discussion activities available yet.
    </p>

    <div
      v-else
      class="space-y-3"
    >
      <div
        v-for="set in sets"
        :key="set.id"
        class="rounded-lg border border-default p-4 flex items-center justify-between gap-4"
      >
        <div class="min-w-0">
          <p class="font-semibold truncate">
            {{ set.title }}
          </p>
          <p class="text-xs font-mono text-muted mt-1">
            {{ set.subjectName }} · {{ set.questionCount }} question{{ set.questionCount === 1 ? '' : 's' }} · {{ statusLabel(set.status) }}
          </p>
        </div>
        <UButton
          :label="buttonLabel(set.status)"
          :loading="starting === set.id"
          class="shrink-0"
          @click="openSet(set)"
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
