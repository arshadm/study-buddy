<script setup lang="ts">
interface Option {
  id: number
  optionText: string
  isCorrect: boolean
}

defineProps<{
  index: number
  item: {
    subjectName?: string
    imageUrl: string
    hintUsed: boolean
    timeSpentMs: number | null
    isCorrect: boolean | null
    selectedOptionId: number | null
    options: Option[]
  }
}>()
</script>

<template>
  <div
    class="rounded-lg border p-4 space-y-3"
    :class="item.isCorrect ? 'border-success/40' : 'border-error/40'"
  >
    <div class="flex items-center justify-between text-sm">
      <span class="font-mono text-muted">Q{{ index + 1 }}<span v-if="item.subjectName"> · {{ item.subjectName }}</span></span>
      <div class="flex items-center gap-3">
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

    <div class="grid gap-2 sm:grid-cols-2">
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
  </div>
</template>
