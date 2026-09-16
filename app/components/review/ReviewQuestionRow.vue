<script setup lang="ts">
interface Option {
  id: number
  optionText: string
  isCorrect: boolean
}

const props = defineProps<{
  index: number
  item: {
    subjectName?: string
    imageUrl: string
    workedSolutionImageUrl: string | null
    hintUsed: boolean
    flagged: boolean
    timeSpentMs: number | null
    isCorrect: boolean | null
    type: 'multiple_choice' | 'free_response'
    selectedOptionId: number | null
    submittedAnswerText: string | null
    correctAnswerText: string | null
    answerUnitHint: string | null
    options: Option[]
  }
}>()

const solutionRevealed = ref(false)

const timeSpentLabel = computed(() => {
  if (!props.item.timeSpentMs) return null
  const seconds = Math.round(props.item.timeSpentMs / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
})
</script>

<template>
  <div
    class="rounded-lg border p-4 space-y-3"
    :class="item.isCorrect ? 'border-success/40' : 'border-error/40'"
  >
    <div class="flex items-center justify-between text-sm">
      <span class="font-mono text-muted">
        Q{{ index + 1 }}<span v-if="item.subjectName"> · {{ item.subjectName }}</span>
        <span v-if="item.flagged"> · <UIcon
          name="i-lucide-flag"
          class="size-3 text-warning inline align-text-top"
        /></span>
      </span>
      <div class="flex items-center gap-3">
        <span
          v-if="timeSpentLabel"
          class="text-muted font-mono text-xs"
        >{{ timeSpentLabel }}</span>
        <span
          v-if="item.hintUsed"
          class="text-muted flex items-center gap-1"
        >
          <UIcon
            name="i-lucide-lightbulb"
            class="size-4"
          /> hint used
        </span>
        <span
          class="flex items-center gap-1 font-medium"
          :class="item.isCorrect ? 'text-success' : 'text-error'"
        >
          <UIcon
            :name="item.isCorrect ? 'i-lucide-check-circle-2' : 'i-lucide-x-circle'"
            class="size-4"
          />
          {{ item.isCorrect ? 'Correct' : 'Incorrect' }}
        </span>
      </div>
    </div>

    <img
      :src="item.imageUrl"
      alt="Question"
      class="w-full max-h-64 object-contain rounded-md bg-white border border-default"
    >

    <div
      v-if="item.type === 'multiple_choice'"
      class="grid gap-2 sm:grid-cols-2"
    >
      <div
        v-for="option in item.options"
        :key="option.id"
        class="rounded-md border px-3 py-2 text-sm flex items-center justify-between"
        :class="[
          option.isCorrect ? 'border-success/50 bg-success/5' : '',
          option.id === item.selectedOptionId && !option.isCorrect ? 'border-error/50 bg-error/5' : '',
          !option.isCorrect && option.id !== item.selectedOptionId ? 'border-default' : ''
        ]"
      >
        <span>{{ option.optionText }}</span>
        <span
          v-if="option.id === item.selectedOptionId"
          class="text-xs text-muted font-mono"
        >your answer</span>
      </div>
    </div>

    <div
      v-else
      class="grid gap-2 sm:grid-cols-2 text-sm"
    >
      <div
        class="rounded-md border px-3 py-2"
        :class="item.isCorrect ? 'border-success/50 bg-success/5' : 'border-error/50 bg-error/5'"
      >
        <span class="text-xs text-muted font-mono block">Your answer</span>
        {{ item.submittedAnswerText ?? '—' }} <span
          v-if="item.answerUnitHint"
          class="text-muted"
        >{{ item.answerUnitHint }}</span>
      </div>
      <div class="rounded-md border border-success/50 bg-success/5 px-3 py-2">
        <span class="text-xs text-muted font-mono block">Correct answer</span>
        {{ item.correctAnswerText }} <span
          v-if="item.answerUnitHint"
          class="text-muted"
        >{{ item.answerUnitHint }}</span>
      </div>
    </div>

    <div v-if="item.workedSolutionImageUrl">
      <UButton
        v-if="!solutionRevealed"
        label="Show worked solution"
        icon="i-lucide-notebook-pen"
        variant="subtle"
        color="neutral"
        size="sm"
        @click="solutionRevealed = true"
      />
      <img
        v-else
        :src="item.workedSolutionImageUrl"
        alt="Worked solution"
        class="w-full max-h-64 object-contain rounded-md bg-white border border-default mt-2"
      >
    </div>
  </div>
</template>
