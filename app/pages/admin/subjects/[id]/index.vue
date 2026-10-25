<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Subject {
  id: number
  name: string
  description: string | null
  isActive: boolean
}

interface Section {
  id: number
  name: string
  description: string | null
  chapterDocumentId: number | null
}

interface Question {
  id: number
  sectionId: number | null
}

interface DocumentRow { id: number, role: 'syllabus' | 'mark_scheme' | 'chapter', title: string, filePath: string | null, extractionError: string | null }

const route = useRoute()
const subjectId = route.params.id as string

const { data: subject, refresh: refreshSubject } = await useFetch<Subject>(`/api/admin/subjects/${subjectId}`)
const { data: sectionList, refresh: refreshSections } = await useFetch<Section[]>(`/api/admin/subjects/${subjectId}/sections`)
const { data: questions, refresh: refreshQuestions } = await useFetch<Question[]>('/api/admin/questions', { query: { subjectId } })
const { data: documents, refresh: refreshDocuments } = await useFetch<DocumentRow[]>(`/api/admin/subjects/${subjectId}/documents`)

const chapters = computed(() => documents.value?.filter(d => d.role === 'chapter') ?? [])

interface SectionGroup { chapterId: number | null, chapterTitle: string | null, hasNotes: boolean, sections: Section[] }

const sectionGroups = computed<SectionGroup[]>(() => {
  const all = sectionList.value ?? []
  const groups: SectionGroup[] = chapters.value.map(c => ({
    chapterId: c.id,
    chapterTitle: c.title,
    hasNotes: c.filePath !== null,
    sections: all.filter(s => s.chapterDocumentId === c.id)
  }))
  const chapterIds = new Set(chapters.value.map(c => c.id))
  const unassigned = all.filter(s => s.chapterDocumentId === null || !chapterIds.has(s.chapterDocumentId))
  if (unassigned.length > 0) {
    groups.push({ chapterId: null, chapterTitle: 'No chapter', hasNotes: true, sections: unassigned })
  }
  return groups
})

const editModalOpen = ref(false)
const sectionModalOpen = ref(false)
const newSectionName = ref('')
const newSectionDescription = ref('')
const newSectionChapterDocumentId = ref<number | undefined>(undefined)
const sectionError = ref('')
const savingSection = ref(false)

const chapterModalOpen = ref(false)
const newChapterTitle = ref('')
const newChapterFile = ref<File | null>(null)
const chapterError = ref('')
const savingChapter = ref(false)

const chapterNotesModalOpen = ref(false)
const chapterNotesTargetId = ref<number | null>(null)
const chapterNotesFile = ref<File | null>(null)
const chapterNotesError = ref('')
const savingChapterNotes = ref(false)

const bulkModalOpen = ref(false)

async function onBulkImported() {
  await refreshQuestions()
}

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

function openAddSection(chapterId?: number) {
  newSectionName.value = ''
  newSectionDescription.value = ''
  newSectionChapterDocumentId.value = chapterId
  sectionError.value = ''
  sectionModalOpen.value = true
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
      body: {
        name: newSectionName.value,
        description: newSectionDescription.value || undefined,
        chapterDocumentId: newSectionChapterDocumentId.value ?? null
      }
    })
    newSectionName.value = ''
    newSectionDescription.value = ''
    newSectionChapterDocumentId.value = undefined
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

function openAddChapter() {
  newChapterTitle.value = ''
  newChapterFile.value = null
  chapterError.value = ''
  chapterModalOpen.value = true
}

function onChapterFileChange(e: Event) {
  newChapterFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function addChapter() {
  if (!newChapterTitle.value.trim()) {
    chapterError.value = 'Title is required'
    return
  }
  savingChapter.value = true
  chapterError.value = ''

  const formData = new FormData()
  formData.set('role', 'chapter')
  formData.set('title', newChapterTitle.value.trim())
  if (newChapterFile.value) formData.set('file', newChapterFile.value)

  try {
    await $fetch(`/api/admin/subjects/${subjectId}/documents`, { method: 'POST', body: formData })
    chapterModalOpen.value = false
    await refreshDocuments()
  } catch (err) {
    chapterError.value = apiErrorMessage(err, 'Could not upload chapter')
  } finally {
    savingChapter.value = false
  }
}

async function deleteChapter(docId: number) {
  await $fetch(`/api/admin/documents/${docId}`, { method: 'DELETE' })
  await Promise.all([refreshDocuments(), refreshSections()])
}

function openChapterNotes(docId: number) {
  chapterNotesTargetId.value = docId
  chapterNotesFile.value = null
  chapterNotesError.value = ''
  chapterNotesModalOpen.value = true
}

function onChapterNotesFileChange(e: Event) {
  chapterNotesFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function submitChapterNotes() {
  if (!chapterNotesFile.value) {
    chapterNotesError.value = 'Choose a PDF or Word document'
    return
  }
  savingChapterNotes.value = true
  chapterNotesError.value = ''

  const formData = new FormData()
  formData.set('file', chapterNotesFile.value)

  try {
    await $fetch(`/api/admin/documents/${chapterNotesTargetId.value}`, { method: 'PATCH', body: formData })
    chapterNotesModalOpen.value = false
    await refreshDocuments()
  } catch (err) {
    chapterNotesError.value = apiErrorMessage(err, 'Could not upload notes')
  } finally {
    savingChapterNotes.value = false
  }
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
          >(draft)</span>
        </h1>
        <p
          v-if="subject.description"
          class="text-sm text-muted"
        >
          {{ subject.description }}
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
        :label="subject.isActive ? 'Unpublish' : 'Publish'"
        variant="ghost"
        color="neutral"
        size="sm"
        @click="toggleActive"
      />
    </div>

    <div class="space-y-3">
      <h2 class="text-lg font-bold tracking-tight">
        Resources
      </h2>
      <p class="text-sm text-muted">
        Syllabus and mark scheme used as context for LLM-graded discussion activities in this
        subject.
      </p>
      <AdminSubjectDocuments :subject-id="subjectId" />
    </div>

    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold tracking-tight">
          Chapters
          <span class="text-muted font-normal text-sm">({{ chapters.length }})</span>
        </h2>
        <div class="flex gap-2">
          <UButton
            label="Bulk import"
            icon="i-lucide-upload"
            variant="subtle"
            color="neutral"
            @click="bulkModalOpen = true"
          />
          <UButton
            label="Add chapter"
            icon="i-lucide-plus"
            @click="openAddChapter"
          />
        </div>
      </div>

      <p class="text-sm text-muted">
        A chapter's text is sent as context to the LLM grader for discussion activities in its
        sections. Sections organize questions for editing — students are still tested across the
        whole subject, drawing from every section combined.
      </p>

      <p
        v-if="!sectionGroups.length"
        class="text-center py-16 text-muted"
      >
        No chapters yet — add one, then add sections within it.
      </p>

      <div
        v-else
        class="space-y-6"
      >
        <div
          v-for="group in sectionGroups"
          :key="group.chapterId ?? 'none'"
          class="space-y-2"
        >
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-muted uppercase tracking-wide flex items-center gap-2">
              {{ group.chapterTitle }}
              <span
                v-if="group.chapterId && !group.hasNotes"
                class="text-xs font-normal normal-case text-warning"
              >No notes yet</span>
            </h3>
            <div
              v-if="group.chapterId"
              class="flex items-center gap-1"
            >
              <UButton
                icon="i-lucide-upload"
                variant="ghost"
                color="neutral"
                size="xs"
                @click="openChapterNotes(group.chapterId)"
              />
              <UButton
                icon="i-lucide-plus"
                variant="ghost"
                color="neutral"
                size="xs"
                @click="openAddSection(group.chapterId)"
              />
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                size="xs"
                @click="deleteChapter(group.chapterId)"
              />
            </div>
          </div>

          <p
            v-if="!group.sections.length"
            class="text-sm text-muted pl-3"
          >
            No sections in this chapter yet.
          </p>

          <div
            v-else
            class="space-y-3 pl-3 border-l-2 border-default"
          >
            <div
              v-for="section in group.sections"
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
          <UFormField
            label="Chapter"
            hint="Optional — its text is sent as context to the LLM grader for any discussion activities in this section"
          >
            <USelectMenu
              v-model="newSectionChapterDocumentId"
              :items="chapters.map(c => ({ label: c.title, value: c.id }))"
              value-key="value"
              placeholder="No chapter"
              class="w-full"
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

    <UModal
      v-model:open="chapterModalOpen"
      title="Add chapter"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="Title">
            <UInput
              v-model="newChapterTitle"
              class="w-full"
              placeholder="e.g. Chapter 4: Memory"
            />
          </UFormField>
          <UFormField
            label="Chapter notes"
            hint="Optional — a PDF or Word document; its text is sent as context to the LLM grader for discussion activities in this chapter's sections. You can add it later if you don't have it yet."
          >
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              class="text-sm"
              @change="onChapterFileChange"
            >
          </UFormField>
          <p
            v-if="chapterError"
            class="text-sm text-error"
          >
            {{ chapterError }}
          </p>
          <UButton
            label="Upload"
            block
            :loading="savingChapter"
            @click="addChapter"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="chapterNotesModalOpen"
      title="Add / replace chapter notes"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField
            label="Chapter notes"
            hint="A PDF or Word document — its text is sent as context to the LLM grader for discussion activities in this chapter's sections."
          >
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              class="text-sm"
              @change="onChapterNotesFileChange"
            >
          </UFormField>
          <p
            v-if="chapterNotesError"
            class="text-sm text-error"
          >
            {{ chapterNotesError }}
          </p>
          <UButton
            label="Upload"
            block
            :loading="savingChapterNotes"
            @click="submitChapterNotes"
          />
        </div>
      </template>
    </UModal>

    <AdminBulkImportModal
      v-model:open="bulkModalOpen"
      :sections="sectionList ?? []"
      @imported="onBulkImported"
    />
  </div>
</template>
