<script setup lang="ts">
const props = defineProps<{
  subjectId: string
}>()
const emit = defineEmits<{ imported: [] }>()

const open = defineModel<boolean>('open', { default: false })

const file = ref<File | null>(null)
const errorMessage = ref('')
const errors = ref<string[]>([])
const successMessage = ref('')
const saving = ref(false)

watch(open, (isOpen) => {
  if (isOpen) return
  file.value = null
  errorMessage.value = ''
  errors.value = []
  successMessage.value = ''
})

function onFileChange(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function submitImport() {
  if (!file.value) {
    errorMessage.value = 'Choose a CSV file'
    return
  }

  saving.value = true
  errorMessage.value = ''
  errors.value = []
  successMessage.value = ''

  const formData = new FormData()
  formData.set('file', file.value)

  try {
    const result = await $fetch<{ chaptersCreated: number, sectionsCreated: number }>(`/api/admin/subjects/${props.subjectId}/hierarchy-import`, {
      method: 'POST',
      body: formData
    })
    successMessage.value = `Created ${result.chaptersCreated} chapter${result.chaptersCreated === 1 ? '' : 's'} and ${result.sectionsCreated} section${result.sectionsCreated === 1 ? '' : 's'}.`
    file.value = null
    emit('imported')
  } catch (err) {
    const errs = (err as { data?: { data?: { errors?: string[] } } })?.data?.data?.errors
    if (errs?.length) {
      errors.value = errs
    } else {
      errorMessage.value = apiErrorMessage(err, 'Could not import hierarchy')
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Import chapters/sections"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Upload a CSV with <code>chapter_title</code> and <code>section_name</code> columns —
          one row per section. Rows sharing the same chapter_title are grouped under one
          chapter; a chapter_title matching an existing chapter in this subject reuses it
          instead of creating a duplicate. Section names must be unique within the subject.
        </p>

        <input
          type="file"
          accept=".csv,text/csv"
          class="text-sm"
          @change="onFileChange"
        >
        <p
          v-if="errorMessage"
          class="text-sm text-error"
        >
          {{ errorMessage }}
        </p>
        <ul
          v-if="errors.length"
          class="text-sm text-error list-disc pl-5 space-y-0.5"
        >
          <li
            v-for="(error, index) in errors"
            :key="index"
          >
            {{ error }}
          </li>
        </ul>
        <p
          v-if="successMessage"
          class="text-sm text-success"
        >
          {{ successMessage }}
        </p>
        <UButton
          label="Import"
          block
          :loading="saving"
          @click="submitImport"
        />
      </div>
    </template>
  </UModal>
</template>
