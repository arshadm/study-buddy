<script setup lang="ts">
definePageMeta({ layout: 'student' })

interface Subject {
  id: number
  name: string
  description: string | null
}

interface SubjectChoice {
  questionCount: number
  timeLimitMinutes: number | null
}

interface CurrentSession {
  sessionId: number
  isPaper: boolean
  subjectNames: string[]
  answeredCount: number
  totalCount: number
}

const { data: subjects } = await useFetch<Subject[]>('/api/subjects')
const { data: currentSession, refresh: refreshCurrentSession } = await useFetch<CurrentSession | null>('/api/sessions/current')
const abandoning = ref(false)
const choices = reactive<Record<number, SubjectChoice | undefined>>({})
const starting = ref(false)
const errorMessage = ref('')

async function startNewInstead() {
  if (!currentSession.value) return
  abandoning.value = true
  try {
    await $fetch(`/api/sessions/${currentSession.value.sessionId}/abandon`, { method: 'POST' })
    await refreshCurrentSession()
  } finally {
    abandoning.value = false
  }
}

const selectedIds = computed(() => Object.keys(choices).map(Number).filter(id => choices[id]))
const chosen = computed(() => (subjects.value || []).filter(s => selectedIds.value.includes(s.id)))

const totalQuestions = computed(() => selectedIds.value.reduce((sum, id) => sum + (choices[id]?.questionCount ?? 0), 0))
const allTimed = computed(() => selectedIds.value.length > 0 && selectedIds.value.every(id => choices[id]?.timeLimitMinutes))
const totalMinutes = computed(() => selectedIds.value.reduce((sum, id) => sum + (choices[id]?.timeLimitMinutes ?? 0), 0))

function toggle(id: number) {
  choices[id] = choices[id] ? undefined : { questionCount: 10, timeLimitMinutes: null }
}

async function startSession() {
  errorMessage.value = ''
  starting.value = true
  try {
    const { sessionId } = await $fetch('/api/sessions', {
      method: 'POST',
      body: {
        allocations: selectedIds.value.map(id => ({
          subjectId: id,
          questionCount: choices[id]!.questionCount,
          timeLimitSeconds: choices[id]!.timeLimitMinutes ? Math.round(choices[id]!.timeLimitMinutes! * 60) : null
        }))
      }
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
        Pick one or more subjects, then say how many questions you want from each — and
        optionally a time limit. Questions you've struggled with before come up more often.
      </p>
    </div>

    <div
      v-if="currentSession"
      class="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-3"
    >
      <div>
        <p class="font-medium">
          You have a session in progress
        </p>
        <p class="text-sm text-muted">
          <template v-if="currentSession.subjectNames.length">
            {{ currentSession.subjectNames.join(', ') }} ·
          </template>
          {{ currentSession.answeredCount }} / {{ currentSession.totalCount }} answered
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          label="Resume"
          :to="`/session/${currentSession.sessionId}`"
        />
        <UButton
          v-if="!currentSession.isPaper"
          label="Start a new session instead"
          variant="subtle"
          color="neutral"
          :loading="abandoning"
          @click="startNewInstead"
        />
      </div>
    </div>

    <div
      v-if="!currentSession"
      class="grid gap-3 sm:grid-cols-2"
    >
      <div
        v-for="subject in subjects"
        :key="subject.id"
        class="rounded-lg border p-4 transition-colors"
        :class="choices[subject.id]
          ? 'border-primary bg-primary/5'
          : 'border-default hover:border-muted'"
      >
        <button
          type="button"
          class="w-full text-left"
          @click="toggle(subject.id)"
        >
          <div class="flex items-start justify-between gap-2">
            <span class="font-semibold">{{ subject.name }}</span>
            <UIcon
              v-if="choices[subject.id]"
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
        </button>

        <div
          v-if="choices[subject.id]"
          class="mt-3 pt-3 border-t border-default grid grid-cols-2 gap-3"
          @click.stop
        >
          <UFormField
            label="Questions"
            size="xs"
          >
            <UInputNumber
              v-model="choices[subject.id]!.questionCount"
              class="w-full"
              :min="1"
              :max="200"
            />
          </UFormField>
          <UFormField
            label="Time limit (min)"
            hint="Optional"
            size="xs"
          >
            <UInputNumber
              v-model="choices[subject.id]!.timeLimitMinutes"
              class="w-full"
              :min="1"
              placeholder="Untimed"
            />
          </UFormField>
        </div>
      </div>
    </div>

    <div
      v-if="chosen.length"
      class="rounded-lg border border-default p-4 flex items-center justify-between"
    >
      <div>
        <p class="text-sm font-mono text-primary mb-1">
          02 — Session summary
        </p>
        <p class="text-sm text-muted">
          <span class="font-mono text-default">{{ totalQuestions }}</span> questions ·
          <span
            v-if="allTimed"
            class="font-mono text-default"
          >{{ totalMinutes }} minutes</span>
          <span v-else>no time limit</span>
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
