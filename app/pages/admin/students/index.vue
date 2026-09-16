<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Student {
  id: number
  username: string
  displayName: string
  isActive: boolean
  createdAt: number
}

const { data: students, refresh } = await useFetch<Student[]>('/api/admin/students')
const modalOpen = ref(false)

async function onSaved() {
  modalOpen.value = false
  await refresh()
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold tracking-tight">
        Students
      </h1>
      <UButton
        label="Add student"
        icon="i-lucide-plus"
        @click="modalOpen = true"
      />
    </div>

    <div class="space-y-3">
      <NuxtLink
        v-for="student in students"
        :key="student.id"
        :to="`/admin/students/${student.id}`"
        class="rounded-lg border border-default p-4 flex items-center justify-between gap-4 hover:border-muted transition-colors"
        :class="{ 'opacity-50': !student.isActive }"
      >
        <div>
          <p class="font-medium">
            {{ student.displayName }}
            <span
              v-if="!student.isActive"
              class="text-xs text-muted font-mono"
            >(inactive)</span>
          </p>
          <p class="text-sm text-muted font-mono">
            @{{ student.username }}
          </p>
        </div>
        <UIcon
          name="i-lucide-chevron-right"
          class="text-muted"
        />
      </NuxtLink>
    </div>

    <UModal
      v-model:open="modalOpen"
      title="Add student"
    >
      <template #body>
        <AdminStudentForm @saved="onSaved" />
      </template>
    </UModal>
  </div>
</template>
