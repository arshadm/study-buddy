<script setup lang="ts">
export interface OptionDraft {
  text: string
  isCorrect: boolean
}

const options = defineModel<OptionDraft[]>({ required: true })

function addOption() {
  options.value = [...options.value, { text: '', isCorrect: false }]
}

function removeOption(index: number) {
  options.value = options.value.filter((_, i) => i !== index)
}

function markCorrect(index: number) {
  options.value = options.value.map((opt, i) => ({ ...opt, isCorrect: i === index }))
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="(option, index) in options"
      :key="index"
      class="space-y-1"
    >
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="shrink-0 size-5 rounded-full border flex items-center justify-center"
          :class="option.isCorrect ? 'border-success bg-success/10' : 'border-default'"
          :aria-label="option.isCorrect ? 'Correct answer' : 'Mark as correct answer'"
          @click="markCorrect(index)"
        >
          <UIcon
            v-if="option.isCorrect"
            name="i-lucide-check"
            class="size-3 text-success"
          />
        </button>
        <UInput
          v-model="option.text"
          placeholder="Option text — wrap LaTeX in $...$"
          class="w-full"
        />
        <UButton
          icon="i-lucide-x"
          variant="ghost"
          color="neutral"
          size="sm"
          :disabled="options.length <= 2"
          @click="removeOption(index)"
        />
      </div>
      <p
        v-if="option.text.includes('$')"
        class="pl-7 text-sm text-muted"
      >
        <MathText :text="option.text" />
      </p>
    </div>

    <UButton
      label="Add option"
      icon="i-lucide-plus"
      variant="subtle"
      color="neutral"
      size="sm"
      @click="addOption"
    />
  </div>
</template>
