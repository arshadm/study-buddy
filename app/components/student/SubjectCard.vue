<script setup lang="ts">
defineProps<{ subject: StartSubject }>()

const { choices, toggle } = inject(SUBJECT_CHOICES_KEY)!
</script>

<template>
  <div
    class="rounded-lg border p-4 transition-colors"
    :class="choices[subject.id]
      ? 'border-primary bg-primary/5'
      : 'border-default hover:border-muted'"
  >
    <button
      type="button"
      class="w-full text-left"
      @click="toggle(subject.id)"
    >
      <div class="flex items-start justify-between gap-2">
        <span class="font-semibold">{{ subject.name }}</span>
        <UIcon
          v-if="choices[subject.id]"
          name="i-lucide-check-circle-2"
          class="text-primary shrink-0 size-5"
        />
      </div>
      <p
        v-if="subject.description"
        class="text-sm text-muted mt-1"
      >
        {{ subject.description }}
      </p>
    </button>

    <div
      v-if="choices[subject.id]"
      class="mt-3 pt-3 border-t border-default grid grid-cols-2 items-end gap-3"
      @click.stop
    >
      <UFormField
        label="Questions"
        size="xs"
      >
        <UInputNumber
          v-model="choices[subject.id]!.questionCount"
          class="w-full"
          :min="1"
          :max="200"
        />
      </UFormField>
      <UFormField
        label="Time limit (min)"
        size="xs"
      >
        <UInputNumber
          v-model="choices[subject.id]!.timeLimitMinutes"
          class="w-full"
          :min="1"
          placeholder="Untimed"
        />
      </UFormField>
    </div>
  </div>
</template>
