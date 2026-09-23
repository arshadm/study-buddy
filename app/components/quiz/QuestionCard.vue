<script setup lang="ts">
interface Option {
  id: number
  optionText: string | null
  optionImageUrl: string | null
  sortOrder: number
}

const props = defineProps<{
  type: 'multiple_choice' | 'self_marked_image'
  optionFormat: 'text' | 'image'
  imageUrl: string
  hintText: string | null
  options: Option[]
  selectedOptionId: number | null
  submittedAnswerImageUrl: string | null
  workedSolutionImageUrl: string | null
  selfMarkedCorrect: boolean | null
  hintUsed: boolean
  flagged: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  'answer': [payload: { selectedOptionId?: number, selfMarkCorrect?: boolean, hintUsed: boolean }]
  'toggle-flag': []
  'upload-answer-image': [file: File]
}>()

// Local copies seeded from props; the parent remounts this component (via :key)
// whenever the question changes, so this only ever initializes once per question.
const selectedOptionId = ref(props.selectedOptionId)
const hintRevealed = ref(props.hintUsed)

function letterForOptionId(id: number | null) {
  if (id === null) return ''
  const index = props.options.findIndex(o => o.id === id)
  return index >= 0 ? String.fromCharCode(97 + index) : ''
}

// Image options aren't clickable — the images may carry their own baked-in
// a/b/c/d labels, so the student answers by typing the letter instead.
const imageLetterInput = ref(letterForOptionId(props.selectedOptionId))

watch(imageLetterInput, (raw) => {
  const letter = raw.trim().toLowerCase()
  if (letter.length !== 1) return
  const index = letter.charCodeAt(0) - 97
  const option = props.options[index]
  if (!option) return
  selectedOptionId.value = option.id
  emit('answer', { selectedOptionId: option.id, hintUsed: hintRevealed.value })
})

function selectOption(optionId: number) {
  selectedOptionId.value = optionId
  emit('answer', { selectedOptionId: optionId, hintUsed: hintRevealed.value })
}

function markSelf(correct: boolean) {
  emit('answer', { selfMarkCorrect: correct, hintUsed: hintRevealed.value })
}

function onAnswerImageChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  emit('upload-answer-image', file)
}

function revealHint() {
  hintRevealed.value = true
  if (props.type === 'multiple_choice' && selectedOptionId.value !== null) {
    emit('answer', { selectedOptionId: selectedOptionId.value, hintUsed: true })
  } else if (props.type === 'self_marked_image' && props.selfMarkedCorrect !== null) {
    emit('answer', { selfMarkCorrect: props.selfMarkedCorrect, hintUsed: true })
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-lg border border-default overflow-hidden bg-elevated">
      <img
        :src="imageUrl"
        alt="Question"
        class="w-full h-auto max-h-[28rem] object-contain bg-white"
      >
    </div>

    <div
      v-if="type === 'multiple_choice' && optionFormat === 'image'"
      class="space-y-4"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <div
          v-for="(option, index) in options"
          :key="option.id"
          class="rounded-lg border border-default p-3 space-y-1"
        >
          <p class="text-xs font-mono text-muted uppercase">
            {{ String.fromCharCode(97 + index) }}
          </p>
          <img
            :src="option.optionImageUrl!"
            alt="Answer option"
            class="w-full h-28 object-contain bg-white rounded"
          >
        </div>
      </div>
      <UFormField
        label="Your answer"
        hint="Type the letter of the correct option"
      >
        <UInput
          v-model="imageLetterInput"
          placeholder="e.g. a"
          maxlength="1"
          class="w-24"
        />
      </UFormField>
    </div>

    <div
      v-else-if="type === 'multiple_choice'"
      class="grid gap-3 sm:grid-cols-2"
    >
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        class="text-left rounded-lg border p-4 transition-colors"
        :class="selectedOptionId === option.id
          ? 'border-primary bg-primary/5'
          : 'border-default hover:border-muted'"
        @click="selectOption(option.id)"
      >
        <MathText :text="option.optionText" />
      </button>
    </div>

    <div
      v-else
      class="space-y-4"
    >
      <div
        v-if="!submittedAnswerImageUrl"
        class="space-y-2"
      >
        <p class="text-sm text-muted">
          Upload a photo of your working
        </p>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="text-sm"
          @change="onAnswerImageChange"
        >
      </div>

      <template v-else>
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <p class="text-xs font-mono text-muted mb-1">
              Your answer
            </p>
            <img
              :src="submittedAnswerImageUrl"
              alt="Your submitted answer"
              class="w-full max-h-56 object-contain rounded-md bg-white border border-default"
            >
          </div>
          <div v-if="workedSolutionImageUrl">
            <p class="text-xs font-mono text-muted mb-1">
              Worked solution
            </p>
            <img
              :src="workedSolutionImageUrl"
              alt="Worked solution"
              class="w-full max-h-56 object-contain rounded-md bg-white border border-default"
            >
          </div>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            label="Got it right"
            icon="i-lucide-check"
            :variant="selfMarkedCorrect === true ? 'solid' : 'subtle'"
            :color="selfMarkedCorrect === true ? 'success' : 'neutral'"
            @click="markSelf(true)"
          />
          <UButton
            label="Got it wrong"
            icon="i-lucide-x"
            :variant="selfMarkedCorrect === false ? 'solid' : 'subtle'"
            :color="selfMarkedCorrect === false ? 'error' : 'neutral'"
            @click="markSelf(false)"
          />
        </div>

        <div>
          <p class="text-xs text-muted mb-1">
            Uploaded the wrong photo?
          </p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="text-sm"
            @change="onAnswerImageChange"
          >
        </div>
      </template>
    </div>

    <div class="flex items-center gap-4">
      <div
        v-if="hintText"
        class="text-sm"
      >
        <UButton
          v-if="!hintRevealed"
          label="Show hint"
          icon="i-lucide-lightbulb"
          variant="subtle"
          color="neutral"
          size="sm"
          @click="revealHint"
        />
        <p
          v-else
          class="rounded-md bg-elevated px-3 py-2 text-muted"
        >
          <MathText :text="hintText" />
        </p>
      </div>

      <UButton
        :label="flagged ? 'Flagged' : 'Flag for review'"
        icon="i-lucide-flag"
        :variant="flagged ? 'subtle' : 'ghost'"
        :color="flagged ? 'warning' : 'neutral'"
        size="sm"
        @click="emit('toggle-flag')"
      />
    </div>

    <p
      class="text-xs font-mono text-muted h-4"
      :class="{ 'opacity-0': !saving }"
    >
      Saving…
    </p>
  </div>
</template>
