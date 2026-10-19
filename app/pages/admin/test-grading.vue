<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Subject { id: number, name: string }
interface OpenQuestionSet {
  id: number
  title: string
  questions: { id: number, promptText: string }[]
}
interface GradingResult {
  verdict: 'acceptable' | 'needs_more_info'
  feedback: string
  followUpQuestion: string | null
}

const { data: subjects } = await useFetch<Subject[]>('/api/admin/subjects')

const subjectId = ref<number | undefined>()
const sets = ref<OpenQuestionSet[]>([])
const setId = ref<number | undefined>()
const openQuestionId = ref<number | undefined>()
const answerText = ref('')

const grading = ref(false)
const errorMessage = ref('')
const result = ref<GradingResult | null>(null)

const selectedSet = computed(() => sets.value.find(s => s.id === setId.value) ?? null)

watch(subjectId, async (id) => {
  setId.value = undefined
  openQuestionId.value = undefined
  sets.value = id ? await $fetch<OpenQuestionSet[]>('/api/admin/open-question-sets', { query: { subjectId: id } }) : []
})

watch(setId, () => {
  openQuestionId.value = undefined
})

async function submitTestGrade() {
  if (!openQuestionId.value || !answerText.value.trim()) {
    errorMessage.value = 'Pick a question and type a sample answer'
    return
  }

  grading.value = true
  errorMessage.value = ''
  result.value = null

  try {
    result.value = await $fetch<GradingResult>('/api/admin/test-grade', {
      method: 'POST',
      body: { openQuestionId: openQuestionId.value, answerText: answerText.value.trim() }
    })
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Could not grade this answer')
  } finally {
    grading.value = false
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold tracking-tight">
      Test grading
    </h1>
    <p class="text-sm text-muted">
      Sanity-check how Claude grades a sample answer to an existing discussion-activity question,
      without running the full student flow.
    </p>

    <UFormField label="Subject">
      <USelectMenu
        v-model="subjectId"
        :items="(subjects || []).map(s => ({ label: s.name, value: s.id }))"
        value-key="value"
        placeholder="Choose a subject"
        class="w-full"
      />
    </UFormField>

    <UFormField label="Discussion activity">
      <USelectMenu
        v-model="setId"
        :items="sets.map(s => ({ label: s.title, value: s.id }))"
        value-key="value"
        :placeholder="subjectId ? 'Choose an activity' : 'Choose a subject first'"
        :disabled="!subjectId"
        class="w-full"
      />
    </UFormField>

    <UFormField label="Question">
      <USelectMenu
        v-model="openQuestionId"
        :items="(selectedSet?.questions || []).map(q => ({ label: q.promptText, value: q.id }))"
        value-key="value"
        :placeholder="setId ? 'Choose a question' : 'Choose an activity first'"
        :disabled="!setId"
        class="w-full"
      />
    </UFormField>

    <UFormField label="Sample answer">
      <UTextarea
        v-model="answerText"
        class="w-full"
        :rows="4"
        placeholder="Type an answer as if you were the student"
      />
    </UFormField>

    <p
      v-if="errorMessage"
      class="text-sm text-error"
    >
      {{ errorMessage }}
    </p>

    <UButton
      label="Test grade"
      block
      :loading="grading"
      @click="submitTestGrade"
    />

    <div
      v-if="result"
      class="rounded-lg border p-4 space-y-2"
      :class="result.verdict === 'acceptable' ? 'border-success/40' : 'border-warning/40'"
    >
      <p
        class="text-sm font-medium"
        :class="result.verdict === 'acceptable' ? 'text-success' : 'text-warning'"
      >
        {{ result.verdict === 'acceptable' ? 'Acceptable' : 'Needs more info' }}
      </p>
      <p class="text-sm">
        {{ result.feedback }}
      </p>
      <p
        v-if="result.followUpQuestion"
        class="text-sm text-muted"
      >
        Follow-up: {{ result.followUpQuestion }}
      </p>
    </div>
  </div>
</template>
