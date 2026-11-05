<script setup lang="ts">
const props = defineProps<{ subject: StartSubject }>()

const { choices, toggle } = inject(SUBJECT_CHOICES_KEY)!
const choice = computed(() => choices[props.subject.id])

// Tag filter options load the first time the subject is selected (most students only open a
// few subjects, and Core Pure alone carries 30+ tags).
const tagFilter = ref<SubjectTagFilter | null>(null)
const tagsLoading = ref(false)
watch(() => Boolean(choice.value), async (selected) => {
  if (!selected || tagFilter.value || tagsLoading.value) return
  tagsLoading.value = true
  try {
    tagFilter.value = await $fetch<SubjectTagFilter>(`/api/subjects/${props.subject.id}/tags`)
  } catch {
    // The filter is optional — without it the card behaves as before (all questions).
  } finally {
    tagsLoading.value = false
  }
}, { immediate: true })

const matching = computed(() => tagFilter.value && choice.value
  ? matchingQuestionCount(tagFilter.value, choice.value.tagIds)
  : null)
const maxQuestions = computed(() => Math.max(1, Math.min(200, matching.value ?? 200)))

// Keep "Questions" within what the current tag selection can supply. The number the student
// typed is remembered while capped, so widening the selection again restores it (up to the new cap).
const wantedCount = ref<number | null>(null)
watch(matching, (cap) => {
  const c = choice.value
  if (!c || cap === null || cap <= 0) return
  const wanted = wantedCount.value ?? c.questionCount
  c.questionCount = Math.min(wanted, cap)
  wantedCount.value = wanted > cap ? wanted : null
})

function onQuestionCountInput(value: number | null) {
  // A manual edit replaces whatever was remembered from before a cap.
  wantedCount.value = null
  if (choice.value && value !== null) choice.value.questionCount = value
}

// A selected subject with tags lays its settings and tag pills side by side, so the pills flow
// across the full-width card instead of stacking under the settings.
const wide = computed(() => Boolean(choice.value && tagFilter.value?.tags.length))

function tagTitle(tag: SubjectTagOption) {
  return tag.score === null
    ? `${tag.name}: not tried yet`
    : `${tag.name}: ${tag.score}% correct over ${Math.round(tag.attempts)} attempt${Math.round(tag.attempts) === 1 ? '' : 's'}`
}

// Legend shows only the bands present on this card.
const bandsShown = computed(() => {
  const present = new Set((tagFilter.value?.tags ?? []).map(t => tagBand(t.score)))
  return (['weak', 'fair', 'strong', 'untried'] as const).filter(b => present.has(b))
})

function toggleTag(tagId: number) {
  const c = choice.value
  if (!c) return
  c.tagIds = c.tagIds.includes(tagId) ? c.tagIds.filter(id => id !== tagId) : [...c.tagIds, tagId]
}
</script>

<template>
  <div
    class="rounded-lg border p-4 transition-colors"
    :class="choice ? 'border-primary bg-primary/5' : 'border-default hover:border-muted'"
  >
    <button
      type="button"
      class="w-full text-left"
      @click="toggle(subject.id)"
    >
      <div class="flex items-start justify-between gap-2">
        <span class="font-semibold">{{ subject.name }}</span>
        <UIcon
          v-if="choice"
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
      v-if="choice"
      class="mt-3 pt-3 border-t border-default"
      :class="wide ? 'flex flex-col gap-4 md:flex-row md:items-start' : ''"
      @click.stop
    >
      <div
        class="grid grid-cols-2 items-end gap-3"
        :class="wide ? 'md:w-72 md:shrink-0' : ''"
      >
        <UFormField
          label="Questions"
          size="xs"
        >
          <UInputNumber
            :model-value="choice.questionCount"
            class="w-full"
            :min="1"
            :max="maxQuestions"
            @update:model-value="onQuestionCountInput"
          />
        </UFormField>
        <UFormField
          label="Time limit (min)"
          size="xs"
        >
          <UInputNumber
            v-model="choice.timeLimitMinutes"
            class="w-full"
            :min="1"
            placeholder="Untimed"
          />
        </UFormField>
      </div>

      <p
        v-if="tagFilter && tagFilter.totalQuestions === 0"
        class="text-sm text-warning flex items-center gap-1.5"
      >
        <UIcon name="i-lucide-triangle-alert" />
        No questions available in this subject yet
      </p>

      <div
        v-if="tagFilter?.tags.length"
        class="min-w-0 flex-1 space-y-2"
      >
        <div class="flex items-baseline justify-between gap-2">
          <p class="text-xs font-medium">
            Tags
            <span class="text-muted font-normal">· none selected = all questions</span>
          </p>
          <button
            v-if="choice.tagIds.length"
            type="button"
            class="text-xs text-primary hover:underline shrink-0"
            @click="choice.tagIds = []"
          >
            Clear
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="tag in tagFilter.tags"
            :key="tag.id"
            type="button"
            class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition-colors"
            :class="choice.tagIds.includes(tag.id)
              ? TAG_BAND_CLASSES[tagBand(tag.score)].selected
              : [TAG_BAND_CLASSES[tagBand(tag.score)].idle, 'text-default']"
            :title="tagTitle(tag)"
            :aria-pressed="choice.tagIds.includes(tag.id)"
            @click="toggleTag(tag.id)"
          >
            <UIcon
              v-if="choice.tagIds.includes(tag.id)"
              name="i-lucide-check"
              class="size-3.5 -ml-0.5"
            />
            {{ tag.name }} ({{ tag.questionIds.length }})
          </button>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
          <p>
            <span class="font-mono text-default">{{ matching }}</span>
            matching question{{ matching === 1 ? '' : 's' }}
          </p>
          <div class="flex flex-wrap gap-x-3 gap-y-1">
            <span
              v-for="band in bandsShown"
              :key="band"
              class="inline-flex items-center gap-1"
            >
              <span
                class="size-2 rounded-full"
                :class="TAG_BAND_CLASSES[band].dot"
              />
              {{ TAG_BAND_CLASSES[band].label }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
