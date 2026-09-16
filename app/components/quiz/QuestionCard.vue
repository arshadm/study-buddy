<script setup lang="ts">
interface Option {
  id: number
  optionText: string
  sortOrder: number
}

const props = defineProps<{
  type: 'multiple_choice' | 'free_response'
  imageUrl: string
  hintText: string | null
  answerUnitHint: string | null
  options: Option[]
  selectedOptionId: number | null
  submittedAnswerText: string | null
  hintUsed: boolean
  flagged: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  'answer': [payload: { selectedOptionId?: number, answerText?: string, hintUsed: boolean }]
  'toggle-flag': []
}>()

// Local copies seeded from props; the parent remounts this component (via :key)
// whenever the question changes, so this only ever initializes once per question.
const selectedOptionId = ref(props.selectedOptionId)
const answerText = ref(props.submittedAnswerText ?? '')
const hintRevealed = ref(props.hintUsed)

function selectOption(optionId: number) {
  selectedOptionId.value = optionId
  emit('answer', { selectedOptionId: optionId, hintUsed: hintRevealed.value })
}

function saveAnswerText() {
  if (!answerText.value.trim()) return
  emit('answer', { answerText: answerText.value, hintUsed: hintRevealed.value })
}

function revealHint() {
  hintRevealed.value = true
  if (props.type === 'multiple_choice' && selectedOptionId.value !== null) {
    emit('answer', { selectedOptionId: selectedOptionId.value, hintUsed: true })
  } else if (props.type === 'free_response' && answerText.value.trim()) {
    emit('answer', { answerText: answerText.value, hintUsed: true })
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
      v-if="type === 'multiple_choice'"
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
      class="flex items-center gap-2 max-w-xs"
    >
      <UInput
        v-model="answerText"
        placeholder="Your answer"
        size="lg"
        class="w-full"
        @blur="saveAnswerText"
        @keyup.enter="saveAnswerText"
      />
      <span
        v-if="answerUnitHint"
        class="text-muted font-mono text-sm shrink-0"
      >
        <MathText :text="answerUnitHint" />
      </span>
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
