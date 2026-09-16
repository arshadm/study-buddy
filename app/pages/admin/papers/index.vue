<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Paper {
  id: number
  name: string
  description: string | null
  isActive: boolean
  sections: { id: number, subjectName: string, questionCount: number, timeLimitSeconds: number }[]
}

const { data: papers, refresh } = await useFetch<Paper[]>('/api/admin/papers')

const modalOpen = ref(false)
const name = ref('')
const description = ref('')
const saving = ref(false)
const errorMessage = ref('')

async function createPaper() {
  if (!name.value.trim()) {
    errorMessage.value = 'Name is required'
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    const paper = await $fetch<Paper>('/api/admin/papers', { method: 'POST', body: { name: name.value, description: description.value || undefined } })
    modalOpen.value = false
    name.value = ''
    description.value = ''
    await navigateTo(`/admin/papers/${paper.id}`)
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Could not create paper')
  } finally {
    saving.value = false
  }
}

async function toggleActive(paper: Paper) {
  await $fetch(`/api/admin/papers/${paper.id}`, { method: 'PATCH', body: { isActive: !paper.isActive } })
  await refresh()
}

function totalMinutes(paper: Paper) {
  return Math.round(paper.sections.reduce((sum, s) => sum + s.timeLimitSeconds, 0) / 60)
}
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold tracking-tight">
        Mock papers
      </h1>
      <UButton
        label="Add paper"
        icon="i-lucide-plus"
        @click="modalOpen = true"
      />
    </div>

    <div
      v-if="!papers?.length"
      class="text-center py-16 text-muted"
    >
      No papers yet.
    </div>

    <div
      v-else
      class="space-y-3"
    >
      <div
        v-for="paper in papers"
        :key="paper.id"
        class="rounded-lg border border-default p-4 flex items-center justify-between gap-4"
        :class="{ 'opacity-50': !paper.isActive }"
      >
        <NuxtLink
          :to="`/admin/papers/${paper.id}`"
          class="min-w-0"
        >
          <p class="font-medium">
            {{ paper.name }}
            <span
              v-if="!paper.isActive"
              class="text-xs text-muted font-mono"
            >(inactive)</span>
          </p>
          <p class="text-sm text-muted">
            {{ paper.sections.length }} section{{ paper.sections.length === 1 ? '' : 's' }}
            <span v-if="paper.sections.length"> · {{ paper.sections.map(s => s.subjectName).join(' → ') }} · {{ totalMinutes(paper) }} min total</span>
          </p>
        </NuxtLink>
        <UButton
          :label="paper.isActive ? 'Deactivate' : 'Activate'"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="toggleActive(paper)"
        />
      </div>
    </div>

    <UModal
      v-model:open="modalOpen"
      title="Add paper"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="Name">
            <UInput
              v-model="name"
              class="w-full"
              placeholder="e.g. ESAT Full Mock A"
            />
          </UFormField>
          <UFormField
            label="Description"
            hint="Optional"
          >
            <UTextarea
              v-model="description"
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
            label="Create paper"
            block
            :loading="saving"
            @click="createPaper"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
