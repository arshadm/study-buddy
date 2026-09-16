<script setup lang="ts">
definePageMeta({ layout: 'student' })

interface Subject {
  id: number
  name: string
  description: string | null
  defaultQuestionCount: number
  defaultTimeLimitSeconds: number
}

const { data: subjects } = await useFetch<Subject[]>('/api/subjects')
const selected = ref<number[]>([])
const starting = ref(false)
const errorMessage = ref('')

const chosen = computed(() => (subjects.value || []).filter(s => selected.value.includes(s.id)))
const totalQuestions = computed(() => chosen.value.reduce((sum, s) => sum + s.defaultQuestionCount, 0))
const totalSeconds = computed(() => chosen.value.reduce((sum, s) => sum + s.defaultTimeLimitSeconds, 0))
const totalMinutes = computed(() => Math.round(totalSeconds.value / 60))

function toggle(id: number) {
  const idx = selected.value.indexOf(id)
  if (idx === -1) selected.value.push(id)
  else selected.value.splice(idx, 1)
}

async function startSession() {
  errorMessage.value = ''
  starting.value = true
  try {
    const { sessionId } = await $fetch('/api/sessions', {
      method: 'POST',
      body: { subjectIds: selected.value }
    })
    await navigateTo(`/session/${sessionId}`)
  } catch (err) {
    const conflictSessionId = (err as { data?: { sessionId?: number } })?.data?.sessionId
    if (conflictSessionId) {
      await navigateTo(`/session/${conflictSessionId}`)
      return
    }
    errorMessage.value = apiErrorMessage(err, 'Could not start session')
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-8">
    <div>
      <p class="text-sm font-mono text-primary mb-1">
        01 — Choose subjects
      </p>
      <h1 class="text-2xl font-bold tracking-tight">
        Start a practice session
      </h1>
      <p class="text-muted mt-1">
        Pick one or more subjects. Questions you've struggled with before come up more often.
      </p>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <button
        v-for="subject in subjects"
        :key="subject.id"
        type="button"
        class="text-left rounded-lg border p-4 transition-colors"
        :class="selected.includes(subject.id)
          ? 'border-primary bg-primary/5'
          : 'border-default hover:border-muted'"
        @click="toggle(subject.id)"
      >
        <div class="flex items-start justify-between gap-2">
          <span class="font-semibold">{{ subject.name }}</span>
          <UIcon
            v-if="selected.includes(subject.id)"
            name="i-lucide-check-circle-2"
            class="text-primary shrink-0 size-5"
          />
        </div>
        <p
          v-if="subject.description"
          class="text-sm text-muted mt-1"
        >
          {{ subject.description }}
        </p>
        <p class="text-xs font-mono text-muted mt-3">
          {{ subject.defaultQuestionCount }} questions · {{ Math.round(subject.defaultTimeLimitSeconds / 60) }} min
        </p>
      </button>
    </div>

    <div
      v-if="selected.length"
      class="rounded-lg border border-default p-4 flex items-center justify-between"
    >
      <div>
        <p class="text-sm font-mono text-primary mb-1">
          02 — Session summary
        </p>
        <p class="text-sm text-muted">
          <span class="font-mono text-default">{{ totalQuestions }}</span> questions ·
          <span class="font-mono text-default">{{ totalMinutes }}</span> minutes
        </p>
      </div>
      <UButton
        label="Begin session"
        size="lg"
        :loading="starting"
        @click="startSession"
      />
    </div>

    <p
      v-if="errorMessage"
      class="text-sm text-error"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>
