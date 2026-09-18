<script setup lang="ts">
export interface OptionDraft {
  text: string
  isCorrect: boolean
  imageFile?: File | null
  imagePreviewUrl?: string | null
}

defineProps<{ optionFormat: 'text' | 'image' }>()
const options = defineModel<OptionDraft[]>({ required: true })

function addOption() {
  options.value = [...options.value, { text: '', isCorrect: false, imageFile: null, imagePreviewUrl: null }]
}

function removeOption(index: number) {
  options.value = options.value.filter((_, i) => i !== index)
}

function markCorrect(index: number) {
  options.value = options.value.map((opt, i) => ({ ...opt, isCorrect: i === index }))
}

function onImageChange(index: number, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  options.value = options.value.map((opt, i) => i === index
    ? { ...opt, imageFile: file, imagePreviewUrl: URL.createObjectURL(file) }
    : opt)
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
          v-if="optionFormat === 'text'"
          v-model="option.text"
          placeholder="Option text — wrap LaTeX in $...$"
          class="w-full"
        />
        <div
          v-else
          class="flex items-center gap-2 w-full"
        >
          <img
            v-if="option.imagePreviewUrl"
            :src="option.imagePreviewUrl"
            alt="Option preview"
            class="size-12 rounded-md border border-default object-contain bg-white shrink-0"
          >
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="text-sm"
            @change="onImageChange(index, $event)"
          >
        </div>

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
        v-if="optionFormat === 'text' && option.text.includes('$')"
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
