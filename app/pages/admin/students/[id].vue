<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Student {
  id: number
  username: string
  displayName: string
  isActive: boolean
}

interface HistoryItem {
  id: number
  scoreCorrect: number | null
  scoreTotal: number | null
  startedAt: number
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

const route = useRoute()
const id = route.params.id as string

const { data: student, refresh } = await useFetch<Student>(`/api/admin/students/${id}`)
const { data: history } = await useFetch<HistoryItem[]>(`/api/admin/students/${id}/history`)
const { data: slowQuestions } = await useFetch<SlowQuestion[]>(`/api/admin/students/${id}/slow-questions`)

function timeLabel(ms: number) {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

const displayName = ref('')
const newPassword = ref('')
const saving = ref(false)
const message = ref('')

watch(student, (s) => {
  if (s) displayName.value = s.displayName
}, { immediate: true })

async function saveDetails() {
  saving.value = true
  message.value = ''
  try {
    await $fetch(`/api/admin/students/${id}`, { method: 'PATCH', body: { displayName: displayName.value } })
    message.value = 'Saved'
    await refresh()
  } finally {
    saving.value = false
  }
}

async function resetPassword() {
  if (!newPassword.value) return
  saving.value = true
  message.value = ''
  try {
    await $fetch(`/api/admin/students/${id}`, { method: 'PATCH', body: { password: newPassword.value } })
    newPassword.value = ''
    message.value = 'Password updated'
  } finally {
    saving.value = false
  }
}

async function toggleActive() {
  if (!student.value) return
  await $fetch(`/api/admin/students/${id}`, { method: 'PATCH', body: { isActive: !student.value.isActive } })
  await refresh()
}

function dateLabel(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div
    v-if="student"
    class="max-w-2xl mx-auto space-y-8"
  >
    <div>
      <p class="text-sm text-muted font-mono">
        @{{ student.username }}
      </p>
      <h1 class="text-2xl font-bold tracking-tight">
        {{ student.displayName }}
      </h1>
    </div>

    <div class="rounded-lg border border-default p-4 space-y-4">
      <UFormField label="Display name">
        <div class="flex gap-2">
          <UInput
            v-model="displayName"
            class="w-full"
          />
          <UButton
            label="Save"
            :loading="saving"
            @click="saveDetails"
          />
        </div>
      </UFormField>

      <UFormField label="Reset password">
        <div class="flex gap-2">
          <UInput
            v-model="newPassword"
            type="password"
            placeholder="New password"
            class="w-full"
          />
          <UButton
            label="Set"
            :disabled="!newPassword"
            :loading="saving"
            @click="resetPassword"
          />
        </div>
      </UFormField>

      <p
        v-if="message"
        class="text-sm text-success"
      >
        {{ message }}
      </p>

      <UButton
        :label="student.isActive ? 'Deactivate account' : 'Activate account'"
        variant="subtle"
        color="neutral"
        size="sm"
        @click="toggleActive"
      />
    </div>

    <div class="space-y-3">
      <h2 class="text-lg font-bold tracking-tight">
        History
      </h2>
      <p
        v-if="!history?.length"
        class="text-muted text-sm"
      >
        No completed sessions yet.
      </p>
      <div
        v-for="item in history"
        :key="item.id"
        class="rounded-lg border border-default p-4 flex items-center justify-between"
      >
        <div>
          <p class="font-medium">
            {{ item.subjects.map(s => s.subjectName).join(', ') }}
          </p>
          <p class="text-sm text-muted">
            {{ dateLabel(item.startedAt) }}
          </p>
        </div>
        <p class="font-mono font-semibold">
          {{ item.scoreCorrect }} / {{ item.scoreTotal }}
        </p>
      </div>
    </div>

    <div
      v-if="slowQuestions?.length"
      class="space-y-3"
    >
      <h2 class="text-lg font-bold tracking-tight">
        Where time is going
      </h2>
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
