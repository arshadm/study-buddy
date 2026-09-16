<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Subject { id: number, name: string }

const route = useRoute()
const subjectId = route.params.id as string

const { data: subject } = await useFetch<Subject>(`/api/admin/subjects/${subjectId}`)

async function onSaved() {
  await navigateTo(`/admin/subjects/${subjectId}`)
}
</script>

<template>
  <div class="max-w-xl mx-auto space-y-6">
    <div class="flex items-center gap-3">
      <UButton
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
        :to="`/admin/subjects/${subjectId}`"
      />
      <h1 class="text-2xl font-bold tracking-tight">
        New question
      </h1>
    </div>

    <AdminQuestionForm
      v-if="subject"
      :fixed-subject-id="subject.id"
      :fixed-subject-name="subject.name"
      @saved="onSaved"
    />
  </div>
</template>
