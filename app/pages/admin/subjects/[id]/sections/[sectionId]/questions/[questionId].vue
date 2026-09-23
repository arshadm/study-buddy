<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface ExistingQuestion {
  id: number
  subjectId: number
  sectionId: number | null
  imagePath: string
  workedSolutionImagePath: string | null
  hintText: string | null
  difficulty: number | null
  type: 'multiple_choice' | 'self_marked_image'
  optionFormat: 'text' | 'image'
  correctAnswerText: string | null
  options: { id: number, optionText: string | null, optionImagePath: string | null, isCorrect: boolean }[]
}

const route = useRoute()
const subjectId = route.params.id as string
const sectionId = route.params.sectionId as string
const { data: question } = await useFetch<ExistingQuestion>(`/api/admin/questions/${route.params.questionId}`)

async function onSaved() {
  await navigateTo(`/admin/subjects/${subjectId}/sections/${sectionId}`)
}

async function deleteQuestion() {
  await $fetch(`/api/admin/questions/${route.params.questionId}`, { method: 'DELETE' })
  await navigateTo(`/admin/subjects/${subjectId}/sections/${sectionId}`)
}
</script>

<template>
  <div
    v-if="question"
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
          Edit question
        </h1>
      </div>
      <UButton
        label="Delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="subtle"
        size="sm"
        @click="deleteQuestion"
      />
    </div>

    <AdminQuestionForm
      :question="question"
      @saved="onSaved"
    />
  </div>
</template>
