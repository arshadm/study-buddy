<script setup lang="ts">
import type { OptionDraft } from './QuestionOptionEditor.vue'

interface Subject { id: number, name: string }
interface ExistingQuestion {
  id: number
  subjectId: number
  imagePath: string
  hintText: string | null
  options: { id: number, optionText: string, isCorrect: boolean }[]
}

const props = defineProps<{ question?: ExistingQuestion | null }>()
const emit = defineEmits<{ saved: [] }>()

const { data: subjects } = await useFetch<Subject[]>('/api/admin/subjects')

const subjectId = ref<number | undefined>(props.question?.subjectId)
const hintText = ref(props.question?.hintText ?? '')
const options = ref<OptionDraft[]>(
  props.question?.options.map(o => ({ text: o.optionText, isCorrect: o.isCorrect }))
  ?? [{ text: '', isCorrect: true }, { text: '', isCorrect: false }]
)

const imageFile = ref<File | null>(null)
const imagePreview = ref<string | null>(props.question ? `/uploads/${props.question.imagePath}` : null)
const fileInput = ref<HTMLInputElement>()

const saving = ref(false)
const errorMessage = ref('')

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
}

function validate(): string | null {
  if (!subjectId.value) return 'Select a subject'
  if (!props.question && !imageFile.value) return 'A question image is required'
  const filled = options.value.filter(o => o.text.trim())
  if (filled.length < 2) return 'Add at least two options'
  if (!options.value.some(o => o.isCorrect)) return 'Mark one option as correct'
  return null
}

async function onSubmit() {
  const validationError = validate()
  if (validationError) {
    errorMessage.value = validationError
    return
  }

  errorMessage.value = ''
  saving.value = true

  const formData = new FormData()
  formData.set('subjectId', String(subjectId.value))
  formData.set('hintText', hintText.value)
  formData.set('options', JSON.stringify(options.value.filter(o => o.text.trim())))
  if (imageFile.value) formData.set('image', imageFile.value)

  try {
    if (props.question) {
      await $fetch(`/api/admin/questions/${props.question.id}`, { method: 'PATCH', body: formData })
    } else {
      await $fetch('/api/admin/questions', { method: 'POST', body: formData })
    }
    emit('saved')
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Could not save question')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <UFormField label="Subject">
      <USelectMenu
        v-model="subjectId"
        :items="(subjects || []).map(s => ({ label: s.name, value: s.id }))"
        value-key="value"
        placeholder="Choose a subject"
        class="w-full"
      />
    </UFormField>

    <UFormField label="Question image">
      <div class="space-y-3">
        <img
          v-if="imagePreview"
          :src="imagePreview"
          alt="Preview"
          class="max-h-64 rounded-md border border-default bg-white object-contain"
        >
        <input
          ref="fileInput"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="text-sm"
          @change="onFileChange"
        >
      </div>
    </UFormField>

    <UFormField label="Answer options">
      <AdminQuestionOptionEditor v-model="options" />
    </UFormField>

    <UFormField
      label="Hint"
      hint="Optional"
    >
      <UTextarea
        v-model="hintText"
        class="w-full"
        :rows="2"
        placeholder="Shown to the student if they ask for a hint"
      />
    </UFormField>

    <p
      v-if="errorMessage"
      class="text-sm text-error"
    >
      {{ errorMessage }}
    </p>

    <UButton
      label="Save question"
      block
      :loading="saving"
      @click="onSubmit"
    />
  </div>
</template>
