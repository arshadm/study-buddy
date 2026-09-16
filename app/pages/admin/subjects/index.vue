<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Subject {
  id: number
  name: string
  description: string | null
  defaultQuestionCount: number
  defaultTimeLimitSeconds: number
  isActive: boolean
}

const { data: subjects, refresh } = await useFetch<Subject[]>('/api/admin/subjects')

const modalOpen = ref(false)
const editing = ref<Subject | null>(null)

function openCreate() {
  editing.value = null
  modalOpen.value = true
}

function openEdit(subject: Subject) {
  editing.value = subject
  modalOpen.value = true
}

async function onSaved() {
  modalOpen.value = false
  await refresh()
}

async function toggleActive(subject: Subject) {
  await $fetch(`/api/admin/subjects/${subject.id}`, {
    method: 'PATCH',
    body: { isActive: !subject.isActive }
  })
  await refresh()
}
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold tracking-tight">
        Subjects
      </h1>
      <UButton
        label="Add subject"
        icon="i-lucide-plus"
        @click="openCreate"
      />
    </div>

    <div class="space-y-3">
      <div
        v-for="subject in subjects"
        :key="subject.id"
        class="rounded-lg border border-default p-4 flex items-center justify-between gap-4"
        :class="{ 'opacity-50': !subject.isActive }"
      >
        <div>
          <p class="font-medium">
            {{ subject.name }}
            <span
              v-if="!subject.isActive"
              class="text-xs text-muted font-mono"
            >(inactive)</span>
          </p>
          <p class="text-sm text-muted">
            {{ subject.defaultQuestionCount }} questions · {{ Math.round(subject.defaultTimeLimitSeconds / 60) }} min
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            label="Edit"
            variant="subtle"
            color="neutral"
            size="sm"
            @click="openEdit(subject)"
          />
          <UButton
            :label="subject.isActive ? 'Deactivate' : 'Activate'"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="toggleActive(subject)"
          />
        </div>
      </div>
    </div>

    <UModal
      v-model:open="modalOpen"
      :title="editing ? 'Edit subject' : 'Add subject'"
    >
      <template #body>
        <AdminSubjectForm
          :subject="editing"
          @saved="onSaved"
        />
      </template>
    </UModal>
  </div>
</template>
