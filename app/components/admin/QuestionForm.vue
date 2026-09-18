<script setup lang="ts">
import type { OptionDraft } from './QuestionOptionEditor.vue'

interface Subject { id: number, name: string }
interface Section { id: number, name: string }
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
  options: { id: number, optionText: string | null, optionImagePath: string | null, isCorrect: boolean }[]
}

const props = defineProps<{
  question?: ExistingQuestion | null
  fixedSectionId?: number
  fixedSectionName?: string
}>()
const emit = defineEmits<{ saved: [] }>()

const { data: subjects } = await useFetch<Subject[]>('/api/admin/subjects', { immediate: !props.fixedSectionId })

const subjectId = ref<number | undefined>(props.fixedSectionId ? undefined : props.question?.subjectId)
const sectionId = ref<number | undefined>(props.fixedSectionId ?? props.question?.sectionId ?? undefined)
const sectionsForSubject = ref<Section[]>([])

// Plain $fetch doesn't forward the incoming request's cookies during SSR;
// useRequestFetch does, which this needs since it can run at setup time.
const requestFetch = useRequestFetch()

async function loadSections(id: number | undefined) {
  sectionsForSubject.value = id ? await requestFetch<Section[]>(`/api/admin/subjects/${id}/sections`) : []
}

if (!props.fixedSectionId) {
  await loadSections(subjectId.value)
}

watch(subjectId, async (newId, oldId) => {
  if (props.fixedSectionId || newId === oldId) return
  await loadSections(newId)
  sectionId.value = undefined
})

const hintText = ref(props.question?.hintText ?? '')
const difficulty = ref<number | undefined>(props.question?.difficulty ?? undefined)
const type = ref<'multiple_choice' | 'self_marked_image'>(props.question?.type ?? 'multiple_choice')
const optionFormat = ref<'text' | 'image'>(props.question?.optionFormat ?? 'text')

const options = ref<OptionDraft[]>(
  props.question?.options.map(o => ({
    text: o.optionText ?? '',
    isCorrect: o.isCorrect,
    imageFile: null,
    imagePreviewUrl: o.optionImagePath ? `/uploads/${o.optionImagePath}` : null
  }))
  ?? [{ text: '', isCorrect: true, imageFile: null, imagePreviewUrl: null }, { text: '', isCorrect: false, imageFile: null, imagePreviewUrl: null }]
)

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
  if (!sectionId.value) return 'Select a section'
  if (!props.question && !imageFile.value) return 'A question image is required'

  if (type.value === 'multiple_choice') {
    if (optionFormat.value === 'text') {
      const filled = options.value.filter(o => o.text.trim())
      if (filled.length < 2) return 'Add at least two options'
    } else if (options.value.some(o => !o.imageFile && !o.imagePreviewUrl)) {
      return 'Every option needs an image'
    }
    if (!options.value.some(o => o.isCorrect)) return 'Mark one option as correct'
  } else {
    const hasWorkedSolution = Boolean(workedSolutionFile.value) || (Boolean(workedSolutionPreview.value) && !removeWorkedSolution.value)
    if (!hasWorkedSolution) return 'A worked solution image is required for self-marked questions'
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
  formData.set('sectionId', String(sectionId.value))
  formData.set('hintText', hintText.value)
  formData.set('type', type.value)
  if (difficulty.value) formData.set('difficulty', String(difficulty.value))
  else formData.set('difficulty', '')

  if (type.value === 'multiple_choice') {
    formData.set('optionFormat', optionFormat.value)

    if (optionFormat.value === 'text') {
      const filled = options.value.filter(o => o.text.trim())
      formData.set('options', JSON.stringify(filled.map(o => ({ text: o.text, isCorrect: o.isCorrect }))))
    } else {
      formData.set('options', JSON.stringify(options.value.map(o => ({
        isCorrect: o.isCorrect,
        existingImagePath: o.imageFile ? undefined : o.imagePreviewUrl?.replace(/^\/uploads\//, '')
      }))))
      options.value.forEach((opt, index) => {
        if (opt.imageFile) formData.set(`optionImage_${index}`, opt.imageFile)
      })
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
    <template v-if="!fixedSectionId">
      <UFormField label="Subject">
        <USelectMenu
          v-model="subjectId"
          :items="(subjects || []).map(s => ({ label: s.name, value: s.id }))"
          value-key="value"
          placeholder="Choose a subject"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Section">
        <USelectMenu
          v-model="sectionId"
          :items="sectionsForSubject.map(s => ({ label: s.name, value: s.id }))"
          value-key="value"
          :placeholder="subjectId ? 'Choose a section' : 'Choose a subject first'"
          :disabled="!subjectId"
          class="w-full"
        />
      </UFormField>
    </template>
    <UFormField
      v-else
      label="Section"
    >
      <p class="text-sm">
        {{ fixedSectionName }}
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
          label="Self-marked (image answer)"
          :variant="type === 'self_marked_image' ? 'solid' : 'subtle'"
          :color="type === 'self_marked_image' ? 'primary' : 'neutral'"
          @click="type = 'self_marked_image'"
        />
      </div>
    </UFormField>

    <template v-if="type === 'multiple_choice'">
      <UFormField label="Option format">
        <div class="flex gap-2">
          <UButton
            label="Text"
            :variant="optionFormat === 'text' ? 'solid' : 'subtle'"
            :color="optionFormat === 'text' ? 'primary' : 'neutral'"
            @click="optionFormat = 'text'"
          />
          <UButton
            label="Image"
            :variant="optionFormat === 'image' ? 'solid' : 'subtle'"
            :color="optionFormat === 'image' ? 'primary' : 'neutral'"
            @click="optionFormat = 'image'"
          />
        </div>
      </UFormField>

      <UFormField label="Answer options">
        <AdminQuestionOptionEditor
          v-model="options"
          :option-format="optionFormat"
        />
      </UFormField>
    </template>

    <p
      v-else
      class="text-sm text-muted"
    >
      The student uploads a photo of their own working, then marks themselves right or wrong
      against the worked solution below — so a worked solution image is required for this type.
    </p>

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
      :hint="type === 'self_marked_image' ? 'Required — this is what the student checks their answer against' : 'Optional, shown to the student on the review page'"
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
