<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Section { id: number, name: string }

const route = useRoute()
const subjectId = route.params.id as string
const sectionId = route.params.sectionId as string

const { data: sections } = await useFetch<Section[]>(`/api/admin/subjects/${subjectId}/sections`)
const section = computed(() => sections.value?.find(s => String(s.id) === sectionId) ?? null)

async function onSaved() {
  await navigateTo(`/admin/subjects/${subjectId}/sections/${sectionId}`)
}
</script>

<template>
  <div class="max-w-xl mx-auto space-y-6">
    <div class="flex items-center gap-3">
      <UButton
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
        :to="`/admin/subjects/${subjectId}/sections/${sectionId}`"
      />
      <h1 class="text-2xl font-bold tracking-tight">
        New question
      </h1>
    </div>

    <AdminQuestionForm
      v-if="section"
      :fixed-section-id="section.id"
      :fixed-section-name="section.name"
      @saved="onSaved"
    />
  </div>
</template>
