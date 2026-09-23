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
  type: 'multiple_choice' | 'self_marked_image'
  optionFormat: 'text' | 'image'
  correctAnswerText: string | null
  options: { id: number, optionText: string | null, optionImagePath: string | null, isCorrect: boolean }[]
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

const bulkModalOpen = ref(false)
const bulkFile = ref<File | null>(null)
const bulkErrorMessage = ref('')
const bulkErrors = ref<string[]>([])
const bulkSuccessMessage = ref('')
const bulkSaving = ref(false)

watch(bulkModalOpen, (open) => {
  if (open) return
  bulkFile.value = null
  bulkErrorMessage.value = ''
  bulkErrors.value = []
  bulkSuccessMessage.value = ''
})

function onBulkFileChange(e: Event) {
  bulkFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function submitBulkImport() {
  if (!bulkFile.value) {
    bulkErrorMessage.value = 'Choose a zip file'
    return
  }

  bulkSaving.value = true
  bulkErrorMessage.value = ''
  bulkErrors.value = []
  bulkSuccessMessage.value = ''

  const formData = new FormData()
  formData.set('sectionId', sectionId)
  formData.set('zip', bulkFile.value)

  try {
    const result = await $fetch<{ imported: number, questionIds: number[] }>('/api/admin/questions/bulk-import', {
      method: 'POST',
      body: formData
    })
    bulkSuccessMessage.value = `Imported ${result.imported} question${result.imported === 1 ? '' : 's'}.`
    bulkFile.value = null
    await refreshQuestions()
  } catch (err) {
    const errors = (err as { data?: { data?: { errors?: string[] } } })?.data?.data?.errors
    if (errors?.length) {
      bulkErrors.value = errors
    } else {
      bulkErrorMessage.value = apiErrorMessage(err, 'Could not import questions')
    }
  } finally {
    bulkSaving.value = false
  }
}

function correctOption(question: Question) {
  return question.options.find(o => o.isCorrect) ?? null
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
        <div class="flex gap-2">
          <UButton
            label="Bulk import"
            icon="i-lucide-upload"
            variant="subtle"
            color="neutral"
            @click="bulkModalOpen = true"
          />
          <UButton
            label="Add question"
            icon="i-lucide-plus"
            :to="`/admin/subjects/${subjectId}/sections/${sectionId}/questions/new`"
          />
        </div>
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
                <span v-if="question.type === 'self_marked_image'">Self-marked</span>
                <span v-else-if="question.optionFormat === 'image'">Multiple choice (image options)</span>
                <span v-else>Multiple choice</span>
                <span v-if="question.difficulty">· difficulty {{ question.difficulty }}</span>
              </p>
              <p
                v-if="question.type === 'multiple_choice'"
                class="text-sm truncate flex items-center gap-2"
              >
                <template v-if="question.optionFormat === 'image'">
                  Correct: <span class="font-mono">{{ question.correctAnswerText }}</span>
                </template>
                <template v-else>
                  Correct: <MathText :text="correctOption(question)?.optionText ?? ''" />
                </template>
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

    <UModal
      v-model:open="bulkModalOpen"
      title="Bulk import questions"
    >
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-muted">
            Upload a .zip containing your question images plus a <code>questions.csv</code> with
            <code>image_filename</code> and <code>correct_answer</code> columns. Each row creates an
            image-answer multiple choice question in this section.
          </p>
          <input
            type="file"
            accept=".zip,application/zip"
            class="text-sm"
            @change="onBulkFileChange"
          >
          <p
            v-if="bulkErrorMessage"
            class="text-sm text-error"
          >
            {{ bulkErrorMessage }}
          </p>
          <ul
            v-if="bulkErrors.length"
            class="text-sm text-error list-disc pl-5 space-y-0.5"
          >
            <li
              v-for="(error, index) in bulkErrors"
              :key="index"
            >
              {{ error }}
            </li>
          </ul>
          <p
            v-if="bulkSuccessMessage"
            class="text-sm text-success"
          >
            {{ bulkSuccessMessage }}
          </p>
          <UButton
            label="Import"
            block
            :loading="bulkSaving"
            @click="submitBulkImport"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
