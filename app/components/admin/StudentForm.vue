<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const emit = defineEmits<{ saved: [] }>()

interface Subject { id: number, name: string, isActive: boolean }
const { data: subjects } = await useFetch<Subject[]>('/api/admin/subjects')
const subjectItems = computed(() => (subjects.value ?? []).map(s => ({
  subjectId: s.id,
  label: s.name,
  description: s.isActive ? undefined : 'Inactive'
})))
const subjectIds = ref<number[]>([])

const schema = z.object({
  username: z.string().min(3, 'At least 3 characters').max(50).regex(/^[a-zA-Z0-9_.-]+$/, 'Letters, numbers, dots, dashes, underscores only'),
  password: z.string().min(8, 'At least 8 characters'),
  displayName: z.string().min(1, 'Required').max(100)
})

type Schema = z.output<typeof schema>

const state = reactive({ username: '', password: '', displayName: '' })
const saving = ref(false)
const errorMessage = ref('')

async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/admin/students', { method: 'POST', body: { ...event.data, subjectIds: subjectIds.value } })
    emit('saved')
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Could not create student')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UForm
    :schema="schema"
    :state="state"
    class="space-y-4"
    @submit="onSubmit"
  >
    <UFormField
      label="Display name"
      name="displayName"
    >
      <UInput
        v-model="state.displayName"
        class="w-full"
      />
    </UFormField>

    <UFormField
      label="Username"
      name="username"
    >
      <UInput
        v-model="state.username"
        class="w-full"
        autocomplete="off"
      />
    </UFormField>

    <UFormField
      label="Password"
      name="password"
    >
      <UInput
        v-model="state.password"
        type="password"
        class="w-full"
        autocomplete="new-password"
      />
    </UFormField>

    <UFormField
      label="Subjects"
      description="The student will only see these subjects."
    >
      <p
        v-if="!subjectItems.length"
        class="text-sm text-muted"
      >
        No subjects yet.
      </p>
      <UCheckboxGroup
        v-else
        v-model="subjectIds"
        :items="subjectItems"
        value-key="subjectId"
      />
    </UFormField>

    <p
      v-if="errorMessage"
      class="text-sm text-error"
    >
      {{ errorMessage }}
    </p>

    <UButton
      type="submit"
      label="Create student"
      block
      :loading="saving"
    />
  </UForm>
</template>
