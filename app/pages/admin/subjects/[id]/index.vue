<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Subject {
  id: number
  name: string
  description: string | null
  defaultQuestionCount: number
  defaultTimeLimitSeconds: number
  isActive: boolean
}

interface Section {
  id: number
  name: string
  description: string | null
}

interface Question {
  id: number
  sectionId: number | null
}

const route = useRoute()
const subjectId = route.params.id as string

const { data: subject, refresh: refreshSubject } = await useFetch<Subject>(`/api/admin/subjects/${subjectId}`)
const { data: sectionList, refresh: refreshSections } = await useFetch<Section[]>(`/api/admin/subjects/${subjectId}/sections`)
const { data: questions } = await useFetch<Question[]>('/api/admin/questions', { query: { subjectId } })

const editModalOpen = ref(false)
const sectionModalOpen = ref(false)
const newSectionName = ref('')
const newSectionDescription = ref('')
const sectionError = ref('')
const savingSection = ref(false)

const questionCountBySection = computed(() => {
  const counts = new Map<number, number>()
  for (const q of questions.value ?? []) {
    if (q.sectionId === null) continue
    counts.set(q.sectionId, (counts.get(q.sectionId) ?? 0) + 1)
  }
  return counts
})

async function onSubjectSaved() {
  editModalOpen.value = false
  await refreshSubject()
}

async function toggleActive() {
  if (!subject.value) return
  await $fetch(`/api/admin/subjects/${subjectId}`, { method: 'PATCH', body: { isActive: !subject.value.isActive } })
  await refreshSubject()
}

async function addSection() {
  if (!newSectionName.value.trim()) {
    sectionError.value = 'Name is required'
    return
  }
  savingSection.value = true
  sectionError.value = ''
  try {
    await $fetch(`/api/admin/subjects/${subjectId}/sections`, {
      method: 'POST',
      body: { name: newSectionName.value, description: newSectionDescription.value || undefined }
    })
    newSectionName.value = ''
    newSectionDescription.value = ''
    sectionModalOpen.value = false
    await refreshSections()
  } catch (err) {
    sectionError.value = apiErrorMessage(err, 'Could not add section')
  } finally {
    savingSection.value = false
  }
}

async function deleteSection(sectionId: number) {
  await $fetch(`/api/admin/subjects/${subjectId}/sections/${sectionId}`, { method: 'DELETE' })
  await refreshSections()
}
</script>

<template>
  <div
    v-if="subject"
    class="max-w-3xl mx-auto space-y-8"
  >
    <div class="flex items-center gap-3">
      <UButton
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
        to="/admin/subjects"
      />
      <div class="min-w-0 flex-1">
        <h1 class="text-2xl font-bold tracking-tight">
          {{ subject.name }}
          <span
            v-if="!subject.isActive"
            class="text-sm text-muted font-mono"
          >(inactive)</span>
        </h1>
        <p class="text-sm text-muted">
          {{ subject.defaultQuestionCount }} questions per session · {{ Math.round(subject.defaultTimeLimitSeconds / 60) }} min budget
        </p>
      </div>
      <UButton
        label="Edit settings"
        variant="subtle"
        color="neutral"
        size="sm"
        @click="editModalOpen = true"
      />
      <UButton
        :label="subject.isActive ? 'Deactivate' : 'Activate'"
        variant="ghost"
        color="neutral"
        size="sm"
        @click="toggleActive"
      />
    </div>

    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold tracking-tight">
          Sections
          <span class="text-muted font-normal text-sm">({{ sectionList?.length ?? 0 }})</span>
        </h2>
        <UButton
          label="Add section"
          icon="i-lucide-plus"
          @click="sectionModalOpen = true"
        />
      </div>

      <p class="text-sm text-muted">
        Sections just organize questions for editing — students are still tested across the whole
        subject, drawing from every section combined.
      </p>

      <p
        v-if="!sectionList?.length"
        class="text-center py-16 text-muted"
      >
        No sections yet — add one to start adding questions.
      </p>

      <div
        v-else
        class="space-y-3"
      >
        <div
          v-for="section in sectionList"
          :key="section.id"
          class="rounded-lg border border-default p-4 flex items-center justify-between gap-4"
        >
          <NuxtLink
            :to="`/admin/subjects/${subjectId}/sections/${section.id}`"
            class="min-w-0 flex-1 hover:opacity-80 transition-opacity"
          >
            <p class="font-medium">
              {{ section.name }}
            </p>
            <p
              v-if="section.description"
              class="text-sm text-muted truncate"
            >
              {{ section.description }}
            </p>
            <p class="text-xs font-mono text-muted mt-1">
              {{ questionCountBySection.get(section.id) ?? 0 }} question{{ questionCountBySection.get(section.id) === 1 ? '' : 's' }}
            </p>
          </NuxtLink>
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            size="sm"
            class="shrink-0"
            @click="deleteSection(section.id)"
          />
        </div>
      </div>
    </div>

    <UModal
      v-model:open="editModalOpen"
      title="Edit subject"
    >
      <template #body>
        <AdminSubjectForm
          :subject="subject"
          @saved="onSubjectSaved"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="sectionModalOpen"
      title="Add section"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="Name">
            <UInput
              v-model="newSectionName"
              class="w-full"
              placeholder="e.g. Mechanics"
            />
          </UFormField>
          <UFormField
            label="Description"
            hint="Optional"
          >
            <UTextarea
              v-model="newSectionDescription"
              class="w-full"
              :rows="2"
            />
          </UFormField>
          <p
            v-if="sectionError"
            class="text-sm text-error"
          >
            {{ sectionError }}
          </p>
          <UButton
            label="Add section"
            block
            :loading="savingSection"
            @click="addSection"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
