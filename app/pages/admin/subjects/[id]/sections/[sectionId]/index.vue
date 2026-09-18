<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Section {
  id: number
  name: string
  description: string | null
}

interface Question {
  id: number
  imagePath: string
  hintText: string | null
  difficulty: number | null
  type: 'multiple_choice' | 'free_response'
  answerType: 'numeric' | 'text' | null
  answerNumericValue: number | null
  answerText: string | null
  options: { id: number, optionText: string, isCorrect: boolean }[]
}

const route = useRoute()
const subjectId = route.params.id as string
const sectionId = route.params.sectionId as string

const { data: sections, refresh: refreshSection } = await useFetch<Section[]>(`/api/admin/subjects/${subjectId}/sections`)
const section = computed(() => sections.value?.find(s => String(s.id) === sectionId) ?? null)
const { data: questions, refresh: refreshQuestions } = await useFetch<Question[]>('/api/admin/questions', {
  query: { sectionId }
})

const editModalOpen = ref(false)
const editName = ref('')
const editDescription = ref('')
const editError = ref('')
const savingEdit = ref(false)

watch(section, (s) => {
  if (s) {
    editName.value = s.name
    editDescription.value = s.description ?? ''
  }
}, { immediate: true })

async function saveSection() {
  if (!editName.value.trim()) {
    editError.value = 'Name is required'
    return
  }
  savingEdit.value = true
  editError.value = ''
  try {
    await $fetch(`/api/admin/subjects/${subjectId}/sections/${sectionId}`, {
      method: 'PATCH',
      body: { name: editName.value, description: editDescription.value || null }
    })
    editModalOpen.value = false
    await refreshSection()
  } catch (err) {
    editError.value = apiErrorMessage(err, 'Could not save section')
  } finally {
    savingEdit.value = false
  }
}

async function deleteQuestion(id: number) {
  await $fetch(`/api/admin/questions/${id}`, { method: 'DELETE' })
  await refreshQuestions()
}

function correctAnswer(question: Question) {
  if (question.type === 'free_response') {
    return question.answerType === 'numeric' ? String(question.answerNumericValue) : (question.answerText ?? '')
  }
  return question.options.find(o => o.isCorrect)?.optionText ?? ''
}
</script>

<template>
  <div
    v-if="section"
    class="max-w-3xl mx-auto space-y-8"
  >
    <div class="flex items-center gap-3">
      <UButton
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
        :to="`/admin/subjects/${subjectId}`"
      />
      <div class="min-w-0 flex-1">
        <h1 class="text-2xl font-bold tracking-tight">
          {{ section.name }}
        </h1>
        <p
          v-if="section.description"
          class="text-sm text-muted"
        >
          {{ section.description }}
        </p>
      </div>
      <UButton
        label="Edit section"
        variant="subtle"
        color="neutral"
        size="sm"
        @click="editModalOpen = true"
      />
    </div>

    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold tracking-tight">
          Questions
          <span class="text-muted font-normal text-sm">({{ questions?.length ?? 0 }})</span>
        </h2>
        <UButton
          label="Add question"
          icon="i-lucide-plus"
          :to="`/admin/subjects/${subjectId}/sections/${sectionId}/questions/new`"
        />
      </div>

      <p
        v-if="!questions?.length"
        class="text-center py-16 text-muted"
      >
        No questions yet.
      </p>

      <div
        v-else
        class="space-y-3"
      >
        <div
          v-for="(question, index) in questions"
          :key="question.id"
          class="rounded-lg border border-default p-3 flex items-center gap-4"
        >
          <span class="w-6 text-right text-sm font-mono text-muted shrink-0">{{ index + 1 }}</span>
          <NuxtLink
            :to="`/admin/subjects/${subjectId}/sections/${sectionId}/questions/${question.id}`"
            class="flex items-center gap-4 min-w-0 flex-1 hover:opacity-80 transition-opacity"
          >
            <img
              :src="`/uploads/${question.imagePath}`"
              alt="Question thumbnail"
              class="size-16 rounded-md object-contain bg-white border border-default shrink-0"
            >
            <div class="min-w-0">
              <p class="text-xs font-mono text-muted flex items-center gap-2">
                <span v-if="question.type === 'free_response'">Free response</span>
                <span v-else>Multiple choice</span>
                <span v-if="question.difficulty">· difficulty {{ question.difficulty }}</span>
              </p>
              <p class="text-sm truncate">
                Correct: <MathText :text="correctAnswer(question)" />
              </p>
              <p
                v-if="question.hintText"
                class="text-xs text-muted truncate"
              >
                Hint: <MathText :text="question.hintText" />
              </p>
            </div>
          </NuxtLink>
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            size="sm"
            class="shrink-0"
            @click="deleteQuestion(question.id)"
          />
        </div>
      </div>
    </div>

    <UModal
      v-model:open="editModalOpen"
      title="Edit section"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="Name">
            <UInput
              v-model="editName"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Description"
            hint="Optional"
          >
            <UTextarea
              v-model="editDescription"
              class="w-full"
              :rows="2"
            />
          </UFormField>
          <p
            v-if="editError"
            class="text-sm text-error"
          >
            {{ editError }}
          </p>
          <UButton
            label="Save"
            block
            :loading="savingEdit"
            @click="saveSection"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
