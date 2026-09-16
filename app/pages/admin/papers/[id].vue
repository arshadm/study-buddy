<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Subject { id: number, name: string }
interface Section {
  id: number
  subjectId: number
  subjectName: string
  questionCount: number
  timeLimitSeconds: number
  sortOrder: number
}
interface Paper {
  id: number
  name: string
  description: string | null
  isActive: boolean
  sections: Section[]
}

const route = useRoute()
const paperId = route.params.id as string

const { data: paper, refresh } = await useFetch<Paper>(`/api/admin/papers/${paperId}`)
const { data: subjects } = await useFetch<Subject[]>('/api/admin/subjects')

const newSubjectId = ref<number | undefined>(undefined)
const newQuestionCount = ref(10)
const newTimeLimitMinutes = ref(15)
const addingError = ref('')
const adding = ref(false)

async function addSection() {
  if (!newSubjectId.value) {
    addingError.value = 'Select a subject'
    return
  }
  adding.value = true
  addingError.value = ''
  try {
    await $fetch(`/api/admin/papers/${paperId}/sections`, {
      method: 'POST',
      body: {
        subjectId: newSubjectId.value,
        questionCount: newQuestionCount.value,
        timeLimitSeconds: Math.round(newTimeLimitMinutes.value * 60)
      }
    })
    newSubjectId.value = undefined
    newQuestionCount.value = 10
    newTimeLimitMinutes.value = 15
    await refresh()
  } catch (err) {
    addingError.value = apiErrorMessage(err, 'Could not add section')
  } finally {
    adding.value = false
  }
}

async function removeSection(sectionId: number) {
  await $fetch(`/api/admin/papers/${paperId}/sections/${sectionId}`, { method: 'DELETE' })
  await refresh()
}

async function moveSection(sectionId: number, direction: 'up' | 'down') {
  await $fetch(`/api/admin/papers/${paperId}/sections/${sectionId}/move`, { method: 'POST', body: { direction } })
  await refresh()
}
</script>

<template>
  <div
    v-if="paper"
    class="max-w-2xl mx-auto space-y-8"
  >
    <div class="flex items-center gap-3">
      <UButton
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
        to="/admin/papers"
      />
      <h1 class="text-2xl font-bold tracking-tight">
        {{ paper.name }}
      </h1>
    </div>

    <div class="space-y-3">
      <h2 class="text-lg font-bold tracking-tight">
        Sections (in order)
      </h2>
      <p
        v-if="!paper.sections.length"
        class="text-sm text-muted"
      >
        No sections yet — add one below.
      </p>
      <div
        v-for="(section, index) in paper.sections"
        :key="section.id"
        class="rounded-lg border border-default p-4 flex items-center justify-between gap-4"
      >
        <div>
          <p class="font-medium">
            {{ index + 1 }}. {{ section.subjectName }}
          </p>
          <p class="text-sm text-muted">
            {{ section.questionCount }} questions · {{ Math.round(section.timeLimitSeconds / 60) }} min
          </p>
        </div>
        <div class="flex items-center gap-1">
          <UButton
            icon="i-lucide-arrow-up"
            variant="ghost"
            color="neutral"
            size="sm"
            :disabled="index === 0"
            @click="moveSection(section.id, 'up')"
          />
          <UButton
            icon="i-lucide-arrow-down"
            variant="ghost"
            color="neutral"
            size="sm"
            :disabled="index === paper.sections.length - 1"
            @click="moveSection(section.id, 'down')"
          />
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            size="sm"
            @click="removeSection(section.id)"
          />
        </div>
      </div>
    </div>

    <div class="rounded-lg border border-default p-4 space-y-4">
      <h3 class="font-medium">
        Add a section
      </h3>
      <div class="grid grid-cols-3 gap-3">
        <USelectMenu
          v-model="newSubjectId"
          :items="(subjects || []).map(s => ({ label: s.name, value: s.id }))"
          value-key="value"
          placeholder="Subject"
          class="col-span-3 sm:col-span-1"
        />
        <UInputNumber
          v-model="newQuestionCount"
          :min="1"
          :max="200"
          placeholder="Questions"
        />
        <UInputNumber
          v-model="newTimeLimitMinutes"
          :min="1"
          placeholder="Minutes"
        />
      </div>
      <p
        v-if="addingError"
        class="text-sm text-error"
      >
        {{ addingError }}
      </p>
      <UButton
        label="Add section"
        icon="i-lucide-plus"
        :loading="adding"
        @click="addSection"
      />
    </div>
  </div>
</template>
