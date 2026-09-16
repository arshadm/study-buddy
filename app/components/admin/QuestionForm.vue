<script setup lang="ts">
import type { OptionDraft } from './QuestionOptionEditor.vue'

interface Subject { id: number, name: string }
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

const props = defineProps<{
  question?: ExistingQuestion | null
  fixedSubjectId?: number
  fixedSubjectName?: string
}>()
const emit = defineEmits<{ saved: [] }>()

const { data: subjects } = await useFetch<Subject[]>('/api/admin/subjects', { immediate: !props.fixedSubjectId })

const subjectId = ref<number | undefined>(props.fixedSubjectId ?? props.question?.subjectId)
const hintText = ref(props.question?.hintText ?? '')
const difficulty = ref<number | undefined>(props.question?.difficulty ?? undefined)
const type = ref<'multiple_choice' | 'free_response'>(props.question?.type ?? 'multiple_choice')

const options = ref<OptionDraft[]>(
  props.question?.options.map(o => ({ text: o.optionText, isCorrect: o.isCorrect }))
  ?? [{ text: '', isCorrect: true }, { text: '', isCorrect: false }]
)

const answerType = ref<'numeric' | 'text'>(props.question?.answerType ?? 'numeric')
const answerNumericValue = ref<number | undefined>(props.question?.answerNumericValue ?? undefined)
const answerTolerancePercent = ref<number | undefined>(props.question?.answerTolerancePercent ?? 2)
const answerText = ref(props.question?.answerText ?? '')
const answerUnitHint = ref(props.question?.answerUnitHint ?? '')

const imageFile = ref<File | null>(null)
const imagePreview = ref<string | null>(props.question ? `/uploads/${props.question.imagePath}` : null)

const workedSolutionFile = ref<File | null>(null)
const workedSolutionPreview = ref<string | null>(props.question?.workedSolutionImagePath ? `/uploads/${props.question.workedSolutionImagePath}` : null)
const removeWorkedSolution = ref(false)

const saving = ref(false)
const errorMessage = ref('')

const difficultyItems = [
  { label: 'Not set', value: undefined },
  { label: '1 — Easiest', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5 — Hardest', value: 5 }
]

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
}

function onWorkedSolutionChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  workedSolutionFile.value = file
  workedSolutionPreview.value = URL.createObjectURL(file)
  removeWorkedSolution.value = false
}

function clearWorkedSolution() {
  workedSolutionFile.value = null
  workedSolutionPreview.value = null
  removeWorkedSolution.value = true
}

function validate(): string | null {
  if (!subjectId.value) return 'Select a subject'
  if (!props.question && !imageFile.value) return 'A question image is required'

  if (type.value === 'multiple_choice') {
    const filled = options.value.filter(o => o.text.trim())
    if (filled.length < 2) return 'Add at least two options'
    if (!options.value.some(o => o.isCorrect)) return 'Mark one option as correct'
  } else if (answerType.value === 'numeric') {
    if (answerNumericValue.value === undefined || Number.isNaN(answerNumericValue.value)) return 'Enter the correct numeric answer'
    if (answerTolerancePercent.value === undefined || answerTolerancePercent.value < 0) return 'Enter a tolerance percentage'
  } else if (!answerText.value.trim()) {
    return 'Enter the correct answer text'
  }

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
  formData.set('type', type.value)
  if (difficulty.value) formData.set('difficulty', String(difficulty.value))
  else formData.set('difficulty', '')

  if (type.value === 'multiple_choice') {
    formData.set('options', JSON.stringify(options.value.filter(o => o.text.trim())))
  } else {
    formData.set('answerType', answerType.value)
    formData.set('answerUnitHint', answerUnitHint.value)
    if (answerType.value === 'numeric') {
      formData.set('answerNumericValue', String(answerNumericValue.value))
      formData.set('answerTolerancePercent', String(answerTolerancePercent.value))
    } else {
      formData.set('answerText', answerText.value)
    }
  }

  if (imageFile.value) formData.set('image', imageFile.value)
  if (workedSolutionFile.value) formData.set('workedSolutionImage', workedSolutionFile.value)
  else if (removeWorkedSolution.value) formData.set('removeWorkedSolutionImage', 'true')

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
    <UFormField
      v-if="!fixedSubjectId"
      label="Subject"
    >
      <USelectMenu
        v-model="subjectId"
        :items="(subjects || []).map(s => ({ label: s.name, value: s.id }))"
        value-key="value"
        placeholder="Choose a subject"
        class="w-full"
      />
    </UFormField>
    <UFormField
      v-else
      label="Subject"
    >
      <p class="text-sm">
        {{ fixedSubjectName }}
      </p>
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
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="text-sm"
          @change="onFileChange"
        >
      </div>
    </UFormField>

    <UFormField label="Difficulty">
      <USelectMenu
        v-model="difficulty"
        :items="difficultyItems"
        value-key="value"
        class="w-full sm:w-64"
      />
    </UFormField>

    <UFormField label="Question type">
      <div class="flex gap-2">
        <UButton
          label="Multiple choice"
          :variant="type === 'multiple_choice' ? 'solid' : 'subtle'"
          :color="type === 'multiple_choice' ? 'primary' : 'neutral'"
          @click="type = 'multiple_choice'"
        />
        <UButton
          label="Free response"
          :variant="type === 'free_response' ? 'solid' : 'subtle'"
          :color="type === 'free_response' ? 'primary' : 'neutral'"
          @click="type = 'free_response'"
        />
      </div>
    </UFormField>

    <UFormField
      v-if="type === 'multiple_choice'"
      label="Answer options"
    >
      <AdminQuestionOptionEditor v-model="options" />
    </UFormField>

    <template v-else>
      <UFormField label="Answer type">
        <div class="flex gap-2">
          <UButton
            label="Numeric (with tolerance)"
            :variant="answerType === 'numeric' ? 'solid' : 'subtle'"
            :color="answerType === 'numeric' ? 'primary' : 'neutral'"
            @click="answerType = 'numeric'"
          />
          <UButton
            label="Exact text"
            :variant="answerType === 'text' ? 'solid' : 'subtle'"
            :color="answerType === 'text' ? 'primary' : 'neutral'"
            @click="answerType = 'text'"
          />
        </div>
      </UFormField>

      <div
        v-if="answerType === 'numeric'"
        class="grid grid-cols-2 gap-4"
      >
        <UFormField label="Correct value">
          <UInputNumber
            v-model="answerNumericValue"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Tolerance (%)"
          hint="e.g. 2 allows ±2%"
        >
          <UInputNumber
            v-model="answerTolerancePercent"
            class="w-full"
            :min="0"
            :max="100"
          />
        </UFormField>
      </div>

      <UFormField
        v-else
        label="Correct answer"
      >
        <UInput
          v-model="answerText"
          class="w-full"
        />
        <p
          v-if="answerText.includes('$')"
          class="mt-1 text-sm text-muted"
        >
          <MathText :text="answerText" />
        </p>
      </UFormField>

      <UFormField
        label="Unit"
        hint="Optional, shown next to the input (e.g. m/s), not validated"
      >
        <UInput
          v-model="answerUnitHint"
          class="w-full sm:w-48"
        />
      </UFormField>
    </template>

    <UFormField
      label="Hint"
      hint="Optional — wrap LaTeX in $...$ or $$...$$"
    >
      <UTextarea
        v-model="hintText"
        class="w-full"
        :rows="2"
        placeholder="Shown to the student if they ask for a hint"
      />
      <p
        v-if="hintText.includes('$')"
        class="mt-1 text-sm text-muted"
      >
        <MathText :text="hintText" />
      </p>
    </UFormField>

    <UFormField
      label="Worked solution image"
      hint="Optional, shown to the student on the review page"
    >
      <div class="space-y-3">
        <img
          v-if="workedSolutionPreview"
          :src="workedSolutionPreview"
          alt="Worked solution preview"
          class="max-h-64 rounded-md border border-default bg-white object-contain"
        >
        <div class="flex items-center gap-3">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="text-sm"
            @change="onWorkedSolutionChange"
          >
          <UButton
            v-if="workedSolutionPreview"
            label="Remove"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="clearWorkedSolution"
          />
        </div>
      </div>
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
