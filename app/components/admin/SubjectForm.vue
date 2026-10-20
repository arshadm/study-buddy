<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

interface Subject {
  id: number
  name: string
  description: string | null
}

const props = defineProps<{ subject?: Subject | null }>()
const emit = defineEmits<{ saved: [] }>()

const schema = z.object({
  name: z.string().min(1, 'Required').max(100),
  description: z.string().max(500).optional()
})

type Schema = z.output<typeof schema>

const state = reactive({
  name: props.subject?.name ?? '',
  description: props.subject?.description ?? ''
})

const saving = ref(false)
const errorMessage = ref('')

async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true
  errorMessage.value = ''
  const body = {
    name: event.data.name,
    description: event.data.description || undefined
  }
  try {
    if (props.subject) {
      await $fetch(`/api/admin/subjects/${props.subject.id}`, { method: 'PATCH', body })
    } else {
      await $fetch('/api/admin/subjects', { method: 'POST', body })
    }
    emit('saved')
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Could not save subject')
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
      label="Name"
      name="name"
    >
      <UInput
        v-model="state.name"
        class="w-full"
      />
    </UFormField>

    <UFormField
      label="Description"
      name="description"
    >
      <UTextarea
        v-model="state.description"
        class="w-full"
        :rows="2"
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
      label="Save"
      block
      :loading="saving"
    />
  </UForm>
</template>
