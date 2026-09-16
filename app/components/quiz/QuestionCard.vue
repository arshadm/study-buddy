<script setup lang="ts">
interface Option {
  id: number
  optionText: string
  sortOrder: number
}

const props = defineProps<{
  imageUrl: string
  hintText: string | null
  options: Option[]
  submitting: boolean
}>()

const emit = defineEmits<{
  submit: [optionId: number, hintUsed: boolean]
}>()

const selectedOptionId = ref<number | null>(null)
const hintRevealed = ref(false)

watch(() => props.imageUrl, () => {
  selectedOptionId.value = null
  hintRevealed.value = false
})

function submit() {
  if (selectedOptionId.value === null) return
  emit('submit', selectedOptionId.value, hintRevealed.value)
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

    <div class="grid gap-3 sm:grid-cols-2">
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        class="text-left rounded-lg border p-4 transition-colors"
        :class="selectedOptionId === option.id
          ? 'border-primary bg-primary/5'
          : 'border-default hover:border-muted'"
        @click="selectedOptionId = option.id"
      >
        {{ option.optionText }}
      </button>
    </div>

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
        @click="hintRevealed = true"
      />
      <p
        v-else
        class="rounded-md bg-elevated px-3 py-2 text-muted"
      >
        {{ hintText }}
      </p>
    </div>

    <UButton
      label="Submit answer"
      size="lg"
      block
      :disabled="selectedOptionId === null"
      :loading="submitting"
      @click="submit"
    />
  </div>
</template>
