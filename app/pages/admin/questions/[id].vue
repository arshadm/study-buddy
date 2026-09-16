<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface ExistingQuestion {
  id: number
  subjectId: number
  imagePath: string
  workedSolutionImagePath: string | null
  hintText: string | null
  difficulty: number | null
  type: 'multiple_choice' | 'free_response'
  answerType: 'numeric' | 'text' | null
  answerNumericValue: number | null
  answerTolerancePercent: number | null
  answerText: string | null
  answerUnitHint: string | null
  options: { id: number, optionText: string, isCorrect: boolean }[]
}

const route = useRoute()
const { data: question } = await useFetch<ExistingQuestion>(`/api/admin/questions/${route.params.id}`)

async function onSaved() {
  await navigateTo('/admin/questions')
}

async function deleteQuestion() {
  await $fetch(`/api/admin/questions/${route.params.id}`, { method: 'DELETE' })
  await navigateTo('/admin/questions')
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
          to="/admin/questions"
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
