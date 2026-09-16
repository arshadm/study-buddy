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
        @click="modalOpen = true"
      />
    </div>

    <div class="space-y-3">
      <div
        v-for="subject in subjects"
        :key="subject.id"
        class="rounded-lg border border-default p-4 flex items-center justify-between gap-4"
        :class="{ 'opacity-50': !subject.isActive }"
      >
        <NuxtLink
          :to="`/admin/subjects/${subject.id}`"
          class="min-w-0"
        >
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
        </NuxtLink>
        <div class="flex items-center gap-2 shrink-0">
          <UButton
            label="Manage questions"
            :to="`/admin/subjects/${subject.id}`"
            variant="subtle"
            color="neutral"
            size="sm"
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
      title="Add subject"
    >
      <template #body>
        <AdminSubjectForm @saved="onSaved" />
      </template>
    </UModal>
  </div>
</template>
