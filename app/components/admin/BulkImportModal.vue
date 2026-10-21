<script setup lang="ts">
interface SectionOption { id: number, name: string }

const props = defineProps<{
  sections: SectionOption[]
  fixedSectionId?: number
}>()
const emit = defineEmits<{ imported: [] }>()

const open = defineModel<boolean>('open', { default: false })

const bulkType = ref<'multiple_choice' | 'self_marked_image'>('multiple_choice')
const bulkSectionId = ref<number | undefined>(props.fixedSectionId)
const bulkFile = ref<File | null>(null)
const bulkErrorMessage = ref('')
const bulkErrors = ref<string[]>([])
const bulkSuccessMessage = ref('')
const bulkSaving = ref(false)

watch(open, (isOpen) => {
  if (isOpen) return
  bulkType.value = 'multiple_choice'
  bulkSectionId.value = props.fixedSectionId
  bulkFile.value = null
  bulkErrorMessage.value = ''
  bulkErrors.value = []
  bulkSuccessMessage.value = ''
})

function onBulkFileChange(e: Event) {
  bulkFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function submitBulkImport() {
  if (!bulkSectionId.value) {
    bulkErrorMessage.value = 'Choose a section'
    return
  }
  if (!bulkFile.value) {
    bulkErrorMessage.value = 'Choose a zip file'
    return
  }

  bulkSaving.value = true
  bulkErrorMessage.value = ''
  bulkErrors.value = []
  bulkSuccessMessage.value = ''

  const formData = new FormData()
  formData.set('sectionId', String(bulkSectionId.value))
  formData.set('type', bulkType.value)
  formData.set('zip', bulkFile.value)

  try {
    const result = await $fetch<{ imported: number, questionIds: number[] }>('/api/admin/questions/bulk-import', {
      method: 'POST',
      body: formData
    })
    bulkSuccessMessage.value = `Imported ${result.imported} question${result.imported === 1 ? '' : 's'}.`
    bulkFile.value = null
    emit('imported')
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
</script>

<template>
  <UModal
    v-model:open="open"
    title="Bulk import questions"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField
          v-if="!fixedSectionId"
          label="Section"
        >
          <USelectMenu
            v-model="bulkSectionId"
            :items="sections.map(s => ({ label: s.name, value: s.id }))"
            value-key="value"
            placeholder="Choose a section"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Question type">
          <div class="flex gap-2">
            <UButton
              label="Multiple choice"
              :variant="bulkType === 'multiple_choice' ? 'solid' : 'subtle'"
              :color="bulkType === 'multiple_choice' ? 'primary' : 'neutral'"
              @click="bulkType = 'multiple_choice'"
            />
            <UButton
              label="Self-marked (image answer)"
              :variant="bulkType === 'self_marked_image' ? 'solid' : 'subtle'"
              :color="bulkType === 'self_marked_image' ? 'primary' : 'neutral'"
              @click="bulkType = 'self_marked_image'"
            />
          </div>
        </UFormField>

        <p
          v-if="bulkType === 'multiple_choice'"
          class="text-sm text-muted"
        >
          Upload a .zip containing your question images plus a <code>questions.csv</code> with
          <code>image_filename</code> and <code>correct_answer</code> columns, plus an optional
          <code>explanation_image_filename</code> column (leave blank when there's no worked solution).
          Each row creates an image-answer multiple choice question in this section.
        </p>
        <p
          v-else
          class="text-sm text-muted"
        >
          Upload a .zip containing your question and answer images plus a
          <code>questions.csv</code> with <code>question_image_filename</code> and
          <code>answer_image_filename</code> columns. Each row creates a self-marked question —
          the answer image is what the student checks their own answer against.
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
</template>
