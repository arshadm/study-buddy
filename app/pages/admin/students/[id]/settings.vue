<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Student {
  id: number
  username: string
  displayName: string
  isActive: boolean
}

const route = useRoute()
const id = route.params.id as string

const { data: student, refresh } = await useFetch<Student>(`/api/admin/students/${id}`)

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
</script>

<template>
  <div
    v-if="student"
    class="space-y-8"
  >
    <div class="space-y-1">
      <NuxtLink
        :to="`/admin/students/${id}`"
        class="inline-flex items-center gap-1 text-sm text-muted hover:text-default"
      >
        <UIcon name="i-lucide-arrow-left" />
        {{ student.displayName }}
      </NuxtLink>
      <h1 class="text-2xl font-bold tracking-tight">
        Settings
      </h1>
      <p class="text-sm text-muted font-mono">
        @{{ student.username }}
      </p>
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
  </div>
</template>
