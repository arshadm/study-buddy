<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Section { id: number, name: string }
interface ExistingSet {
  id: number
  subjectId: number
  sectionId: number | null
  chapterDocumentId: number | null
  title: string
  passageText: string | null
  questions: { id: number, promptText: string }[]
}

const route = useRoute()
const subjectId = route.params.id as string
const sectionId = route.params.sectionId as string

const { data: sections } = await useFetch<Section[]>(`/api/admin/subjects/${subjectId}/sections`)
const section = computed(() => sections.value?.find(s => String(s.id) === sectionId) ?? null)
const { data: set } = await useFetch<ExistingSet>(`/api/admin/open-question-sets/${route.params.setId}`)

async function onSaved() {
  await navigateTo(`/admin/subjects/${subjectId}/sections/${sectionId}`)
}

async function deleteSet() {
  await $fetch(`/api/admin/open-question-sets/${route.params.setId}`, { method: 'DELETE' })
  await navigateTo(`/admin/subjects/${subjectId}/sections/${sectionId}`)
}
</script>

<template>
  <div
    v-if="set && section"
    class="max-w-xl mx-auto space-y-6"
  >
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          :to="`/admin/subjects/${subjectId}/sections/${sectionId}`"
        />
        <h1 class="text-2xl font-bold tracking-tight">
          Edit discussion activity
        </h1>
      </div>
      <div class="flex gap-2">
        <UButton
          label="Review answers"
          icon="i-lucide-message-square-text"
          variant="subtle"
          color="neutral"
          size="sm"
          :to="`/admin/subjects/${subjectId}/sections/${sectionId}/open-question-sets/${route.params.setId}/review`"
        />
        <UButton
          label="Delete"
          icon="i-lucide-trash-2"
          color="error"
          variant="subtle"
          size="sm"
          @click="deleteSet"
        />
      </div>
    </div>

    <AdminOpenQuestionSetForm
      :set="set"
      :subject-id="Number(subjectId)"
      :section-id="section.id"
      :section-name="section.name"
      @saved="onSaved"
    />
  </div>
</template>
