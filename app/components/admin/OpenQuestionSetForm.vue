<script setup lang="ts">
interface ExistingSet {
  id: number
  subjectId: number
  sectionId: number | null
  chapterDocumentId: number | null
  title: string
  passageText: string | null
  questions: { id: number, promptText: string }[]
}
interface DocumentRow { id: number, role: 'syllabus' | 'mark_scheme' | 'chapter', title: string }
interface QuestionDraft { id?: number, promptText: string }

const props = defineProps<{
  set?: ExistingSet | null
  subjectId: number
  sectionId: number
  sectionName: string
}>()
const emit = defineEmits<{ saved: [] }>()

const { data: documents } = await useFetch<DocumentRow[]>(`/api/admin/subjects/${props.subjectId}/documents`)
const chapters = computed(() => documents.value?.filter(d => d.role === 'chapter') ?? [])

const title = ref(props.set?.title ?? '')
const chapterDocumentId = ref<number | undefined>(props.set?.chapterDocumentId ?? undefined)
const passageText = ref(props.set?.passageText ?? '')
const questions = ref<QuestionDraft[]>(
  props.set?.questions.map(q => ({ id: q.id, promptText: q.promptText })) ?? [{ promptText: '' }]
)

const saving = ref(false)
const errorMessage = ref('')

function addQuestion() {
  questions.value = [...questions.value, { promptText: '' }]
}

function removeQuestion(index: number) {
  questions.value = questions.value.filter((_, i) => i !== index)
}

function moveQuestion(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= questions.value.length) return
  const next = [...questions.value]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  questions.value = next
}

function validate(): string | null {
  if (!title.value.trim()) return 'Title is required'
  const filled = questions.value.filter(q => q.promptText.trim())
  if (filled.length === 0) return 'Add at least one question'
  return null
}

async function onSubmit() {
  const validationError = validate()
  if (validationError) {
    errorMessage.value = validationError
    return
  }

  errorMessage.value = ''
  saving.value = true

  const body = {
    sectionId: props.sectionId,
    chapterDocumentId: chapterDocumentId.value ?? null,
    title: title.value.trim(),
    passageText: passageText.value.trim() || null,
    questions: questions.value
      .filter(q => q.promptText.trim())
      .map(q => ({ id: q.id, promptText: q.promptText.trim() }))
  }

  try {
    if (props.set) {
      await $fetch(`/api/admin/open-question-sets/${props.set.id}`, { method: 'PATCH', body })
    } else {
      await $fetch('/api/admin/open-question-sets', { method: 'POST', body })
    }
    emit('saved')
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Could not save question set')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <UFormField label="Section">
      <p class="text-sm">
        {{ sectionName }}
      </p>
    </UFormField>

    <UFormField label="Title">
      <UInput
        v-model="title"
        class="w-full"
        placeholder="e.g. Chapter 4 comprehension check"
      />
    </UFormField>

    <UFormField
      label="Based on chapter"
      hint="Optional — sent to the grader as context"
    >
      <USelectMenu
        v-model="chapterDocumentId"
        :items="chapters.map(c => ({ label: c.title, value: c.id }))"
        value-key="value"
        placeholder="No chapter"
        class="w-full"
      />
    </UFormField>

    <UFormField
      label="Passage"
      hint="Optional — shown to the student before the first question"
    >
      <UTextarea
        v-model="passageText"
        class="w-full"
        :rows="4"
      />
    </UFormField>

    <UFormField label="Questions">
      <div class="space-y-2">
        <div
          v-for="(question, index) in questions"
          :key="index"
          class="flex items-start gap-2"
        >
          <span class="w-6 text-right text-sm font-mono text-muted shrink-0 pt-2">{{ index + 1 }}</span>
          <UTextarea
            v-model="question.promptText"
            class="w-full"
            :rows="2"
            placeholder="Question prompt — wrap LaTeX in $...$"
          />
          <div class="flex flex-col gap-1 shrink-0">
            <UButton
              icon="i-lucide-chevron-up"
              variant="ghost"
              color="neutral"
              size="sm"
              :disabled="index === 0"
              @click="moveQuestion(index, -1)"
            />
            <UButton
              icon="i-lucide-chevron-down"
              variant="ghost"
              color="neutral"
              size="sm"
              :disabled="index === questions.length - 1"
              @click="moveQuestion(index, 1)"
            />
          </div>
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            color="neutral"
            size="sm"
            class="shrink-0"
            :disabled="questions.length <= 1"
            @click="removeQuestion(index)"
          />
        </div>

        <UButton
          label="Add question"
          icon="i-lucide-plus"
          variant="subtle"
          color="neutral"
          size="sm"
          @click="addQuestion"
        />
      </div>
    </UFormField>

    <p
      v-if="errorMessage"
      class="text-sm text-error"
    >
      {{ errorMessage }}
    </p>

    <UButton
      label="Save question set"
      block
      :loading="saving"
      @click="onSubmit"
    />
  </div>
</template>
