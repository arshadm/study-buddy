<script setup lang="ts">
interface Document {
  id: number
  subjectId: number
  role: 'syllabus' | 'mark_scheme' | 'chapter'
  title: string
  filePath: string
  extractionError: string | null
  createdAt: number
  updatedAt: number
}

interface Subject { id: number, gradingInstructions: string | null }

const props = defineProps<{ subjectId: string }>()

const { data: documents, refresh } = await useFetch<Document[]>(`/api/admin/subjects/${props.subjectId}/documents`)
const { data: subject } = await useFetch<Subject>(`/api/admin/subjects/${props.subjectId}`)

const gradingInstructions = ref('')
watch(subject, (s) => {
  if (s) gradingInstructions.value = s.gradingInstructions ?? ''
}, { immediate: true })

const savingInstructions = ref(false)
const instructionsSaved = ref(false)
watch(gradingInstructions, () => {
  instructionsSaved.value = false
})

async function saveGradingInstructions() {
  savingInstructions.value = true
  instructionsSaved.value = false
  try {
    await $fetch(`/api/admin/subjects/${props.subjectId}`, {
      method: 'PATCH',
      body: { gradingInstructions: gradingInstructions.value.trim() || null }
    })
    instructionsSaved.value = true
  } finally {
    savingInstructions.value = false
  }
}

const syllabus = computed(() => documents.value?.find(d => d.role === 'syllabus') ?? null)
const markScheme = computed(() => documents.value?.find(d => d.role === 'mark_scheme') ?? null)
const chapters = computed(() => documents.value?.filter(d => d.role === 'chapter') ?? [])

const ROLE_LABELS = { syllabus: 'Syllabus', mark_scheme: 'Mark scheme', chapter: 'Chapter' } as const

const uploadModalOpen = ref(false)
const uploadRole = ref<'syllabus' | 'mark_scheme' | 'chapter'>('chapter')
const uploadTitle = ref('')
const uploadFile = ref<File | null>(null)
const uploadError = ref('')
const uploading = ref(false)

function openUpload(role: 'syllabus' | 'mark_scheme' | 'chapter') {
  uploadRole.value = role
  uploadTitle.value = role === 'chapter' ? '' : ROLE_LABELS[role]
  uploadFile.value = null
  uploadError.value = ''
  uploadModalOpen.value = true
}

function onFileChange(e: Event) {
  uploadFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function submitUpload() {
  if (!uploadTitle.value.trim()) {
    uploadError.value = 'Title is required'
    return
  }
  if (!uploadFile.value) {
    uploadError.value = 'Choose a PDF or Word document'
    return
  }

  uploading.value = true
  uploadError.value = ''

  const formData = new FormData()
  formData.set('role', uploadRole.value)
  formData.set('title', uploadTitle.value.trim())
  formData.set('file', uploadFile.value)

  try {
    await $fetch(`/api/admin/subjects/${props.subjectId}/documents`, { method: 'POST', body: formData })
    uploadModalOpen.value = false
    await refresh()
  } catch (err) {
    uploadError.value = apiErrorMessage(err, 'Could not upload document')
  } finally {
    uploading.value = false
  }
}

async function deleteDocument(id: number) {
  await $fetch(`/api/admin/documents/${id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div class="space-y-4">
    <UFormField
      label="Grading instructions"
      hint="Optional — tells the grader its role and how strict to be, e.g. 'the student is aiming for an A — mark strictly against the mark scheme'"
    >
      <UTextarea
        v-model="gradingInstructions"
        class="w-full"
        :rows="3"
        placeholder="e.g. You are a strict AQA Psychology examiner. The student is aiming for a grade A, so only mark an answer acceptable if it meets A-grade standard against the mark scheme."
      />
      <div class="flex items-center gap-2 mt-2">
        <UButton
          label="Save"
          size="xs"
          variant="subtle"
          color="neutral"
          :loading="savingInstructions"
          @click="saveGradingInstructions"
        />
        <span
          v-if="instructionsSaved"
          class="text-xs text-success"
        >Saved</span>
      </div>
    </UFormField>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="rounded-lg border border-default p-3 space-y-1">
        <p class="text-xs font-mono text-muted">
          Syllabus
        </p>
        <p
          v-if="syllabus"
          class="text-sm truncate"
        >
          {{ syllabus.title }}
        </p>
        <p
          v-else
          class="text-sm text-muted"
        >
          Not uploaded
        </p>
        <p
          v-if="syllabus?.extractionError"
          class="text-xs text-error"
        >
          {{ syllabus.extractionError }}
        </p>
        <UButton
          :label="syllabus ? 'Replace' : 'Upload'"
          size="xs"
          variant="subtle"
          color="neutral"
          @click="openUpload('syllabus')"
        />
      </div>

      <div class="rounded-lg border border-default p-3 space-y-1">
        <p class="text-xs font-mono text-muted">
          Mark scheme
        </p>
        <p
          v-if="markScheme"
          class="text-sm truncate"
        >
          {{ markScheme.title }}
        </p>
        <p
          v-else
          class="text-sm text-muted"
        >
          Not uploaded
        </p>
        <p
          v-if="markScheme?.extractionError"
          class="text-xs text-error"
        >
          {{ markScheme.extractionError }}
        </p>
        <UButton
          :label="markScheme ? 'Replace' : 'Upload'"
          size="xs"
          variant="subtle"
          color="neutral"
          @click="openUpload('mark_scheme')"
        />
      </div>
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <p class="text-xs font-mono text-muted">
          Chapters ({{ chapters.length }})
        </p>
        <UButton
          label="Add chapter"
          icon="i-lucide-plus"
          size="xs"
          variant="subtle"
          color="neutral"
          @click="openUpload('chapter')"
        />
      </div>

      <p
        v-if="!chapters.length"
        class="text-sm text-muted"
      >
        No chapters yet.
      </p>

      <div
        v-for="chapter in chapters"
        :key="chapter.id"
        class="rounded-lg border border-default p-3 flex items-center justify-between gap-3"
      >
        <div class="min-w-0">
          <p class="text-sm truncate">
            {{ chapter.title }}
          </p>
          <p
            v-if="chapter.extractionError"
            class="text-xs text-error"
          >
            {{ chapter.extractionError }}
          </p>
        </div>
        <UButton
          icon="i-lucide-trash-2"
          variant="ghost"
          color="error"
          size="sm"
          class="shrink-0"
          @click="deleteDocument(chapter.id)"
        />
      </div>
    </div>

    <UModal
      v-model:open="uploadModalOpen"
      :title="`${uploadRole === 'chapter' ? 'Add' : 'Replace'} ${ROLE_LABELS[uploadRole].toLowerCase()}`"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField
            v-if="uploadRole === 'chapter'"
            label="Title"
          >
            <UInput
              v-model="uploadTitle"
              class="w-full"
              placeholder="e.g. Chapter 4: Memory"
            />
          </UFormField>
          <UFormField label="Document">
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              class="text-sm"
              @change="onFileChange"
            >
          </UFormField>
          <p
            v-if="uploadError"
            class="text-sm text-error"
          >
            {{ uploadError }}
          </p>
          <UButton
            label="Upload"
            block
            :loading="uploading"
            @click="submitUpload"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
