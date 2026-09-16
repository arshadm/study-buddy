<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'default' })

const schema = z.object({
  username: z.string().min(1, 'Required'),
  password: z.string().min(1, 'Required')
})

type Schema = z.output<typeof schema>

const state = reactive({ username: '', password: '' })
const errorMessage = ref('')
const loading = ref(false)
const { fetch: refreshSession } = useUserSession()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  errorMessage.value = ''
  loading.value = true
  try {
    const { role } = await $fetch('/api/auth/login', {
      method: 'POST',
      body: event.data
    })
    await refreshSession()
    await navigateTo(role === 'admin' ? '/admin' : '/start')
  } catch {
    errorMessage.value = 'Invalid username or password'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard class="w-full max-w-sm">
    <template #header>
      <h1 class="text-xl font-bold tracking-tight">
        Study Buddy
      </h1>
      <p class="text-sm text-muted mt-1">
        Sign in to continue
      </p>
    </template>

    <UForm
      :schema="schema"
      :state="state"
      class="space-y-4"
      @submit="onSubmit"
    >
      <UFormField
        label="Username"
        name="username"
      >
        <UInput
          v-model="state.username"
          autofocus
          class="w-full"
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
        label="Sign in"
        block
        :loading="loading"
      />
    </UForm>
  </UCard>
</template>
