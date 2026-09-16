<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Subject { id: number, name: string }
interface Question {
  id: number
  subjectId: number
  imagePath: string
  hintText: string | null
  options: { id: number, optionText: string, isCorrect: boolean }[]
}

const { data: subjects } = await useFetch<Subject[]>('/api/admin/subjects')
const subjectFilter = ref<number | undefined>(undefined)

const { data: questions, refresh } = await useFetch<Question[]>('/api/admin/questions', {
  query: computed(() => ({ subjectId: subjectFilter.value }))
})

watch(subjectFilter, () => refresh())

function subjectName(id: number) {
  return subjects.value?.find(s => s.id === id)?.name ?? ''
}

function correctAnswer(question: Question) {
  return question.options.find(o => o.isCorrect)?.optionText ?? ''
}
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold tracking-tight">
        Questions
      </h1>
      <UButton
        label="Add question"
        icon="i-lucide-plus"
        to="/admin/questions/new"
      />
    </div>

    <USelectMenu
      v-model="subjectFilter"
      :items="[{ label: 'All subjects', value: undefined }, ...(subjects || []).map(s => ({ label: s.name, value: s.id }))]"
      value-key="value"
      placeholder="All subjects"
      class="w-48"
    />

    <div
      v-if="!questions?.length"
      class="text-center py-16 text-muted"
    >
      No questions yet.
    </div>

    <div
      v-else
      class="space-y-3"
    >
      <NuxtLink
        v-for="question in questions"
        :key="question.id"
        :to="`/admin/questions/${question.id}`"
        class="rounded-lg border border-default p-3 flex items-center gap-4 hover:border-muted transition-colors"
      >
        <img
          :src="`/uploads/${question.imagePath}`"
          alt="Question thumbnail"
          class="size-16 rounded-md object-contain bg-white border border-default shrink-0"
        >
        <div class="min-w-0">
          <p class="text-xs font-mono text-muted">
            {{ subjectName(question.subjectId) }}
          </p>
          <p class="text-sm truncate">
            Correct: {{ correctAnswer(question) }}
          </p>
          <p
            v-if="question.hintText"
            class="text-xs text-muted truncate"
          >
            Hint: {{ question.hintText }}
          </p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
