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

const editChapterModalOpen = ref(false)
const editChapterTargetId = ref<number | null>(null)
const editChapterTitle = ref('')
const editChapterHasNotes = ref(false)
const editChapterFile = ref<File | null>(null)
const editChapterRemoveNotes = ref(false)
const editChapterError = ref('')
const savingEditChapter = ref(false)

const bulkModalOpen = ref(false)
const hierarchyModalOpen = ref(false)

async function onBulkImported() {
  await refreshQuestions()
}

async function onHierarchyImported() {
  await Promise.all([refreshDocuments(), refreshSections()])
}

// Keyed the same way as the template's :key — group.chapterId, or 'none' for the unassigned group.
const expandedChapters = ref<Set<number | 'none'>>(new Set())

function toggleChapter(key: number | 'none') {
  const next = new Set(expandedChapters.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedChapters.value = next
}

function expandAllChapters() {
  expandedChapters.value = new Set(sectionGroups.value.map(g => g.chapterId ?? 'none'))
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

function openEditChapter(docId: number) {
  const chapter = chapters.value.find(c => c.id === docId)
  if (!chapter) return
  editChapterTargetId.value = docId
  editChapterTitle.value = chapter.title
  editChapterHasNotes.value = chapter.filePath !== null
  editChapterFile.value = null
  editChapterRemoveNotes.value = false
  editChapterError.value = ''
  editChapterModalOpen.value = true
}

function onEditChapterFileChange(e: Event) {
  editChapterFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
  editChapterRemoveNotes.value = false
}

function removeEditChapterNotes() {
  editChapterFile.value = null
  editChapterHasNotes.value = false
  editChapterRemoveNotes.value = true
}

async function saveEditChapter() {
  if (!editChapterTitle.value.trim()) {
    editChapterError.value = 'Title is required'
    return
  }
  savingEditChapter.value = true
  editChapterError.value = ''

  const formData = new FormData()
  formData.set('title', editChapterTitle.value.trim())
  if (editChapterFile.value) formData.set('file', editChapterFile.value)
  else if (editChapterRemoveNotes.value) formData.set('removeFile', 'true')

  try {
    await $fetch(`/api/admin/documents/${editChapterTargetId.value}`, { method: 'PATCH', body: formData })
    editChapterModalOpen.value = false
    await refreshDocuments()
  } catch (err) {
    editChapterError.value = apiErrorMessage(err, 'Could not save chapter')
  } finally {
    savingEditChapter.value = false
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
            label="Expand all"
            icon="i-lucide-unfold-vertical"
            variant="ghost"
            color="neutral"
            @click="expandAllChapters"
          />
          <UButton
            label="Import chapters/sections"
            icon="i-lucide-table"
            variant="subtle"
            color="neutral"
            @click="hierarchyModalOpen = true"
          />
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
          <div
            class="flex items-center justify-between gap-2 cursor-pointer"
            @click="toggleChapter(group.chapterId ?? 'none')"
          >
            <h3 class="text-sm font-semibold text-muted uppercase tracking-wide flex items-center gap-2 min-w-0">
              <UIcon
                :name="expandedChapters.has(group.chapterId ?? 'none') ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                class="size-4 shrink-0"
              />
              <span class="truncate">{{ group.chapterTitle }}</span>
              <span class="text-xs font-normal normal-case text-muted shrink-0">
                ({{ group.sections.length }})
              </span>
              <span
                v-if="group.chapterId && !group.hasNotes"
                class="text-xs font-normal normal-case text-warning shrink-0"
              >No notes yet</span>
            </h3>
            <div
              v-if="group.chapterId"
              class="flex items-center gap-1 shrink-0"
              @click.stop
            >
              <UButton
                icon="i-lucide-pencil"
                variant="ghost"
                color="neutral"
                size="xs"
                @click="openEditChapter(group.chapterId)"
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

          <template v-if="expandedChapters.has(group.chapterId ?? 'none')">
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
          </template>
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
      v-model:open="editChapterModalOpen"
      title="Edit chapter"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="Title">
            <UInput
              v-model="editChapterTitle"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Chapter notes"
            hint="Optional — a PDF or Word document; its text is sent as context to the LLM grader for discussion activities in this chapter's sections."
          >
            <div class="space-y-2">
              <p
                v-if="editChapterHasNotes"
                class="text-sm text-muted"
              >
                Notes already uploaded — choose a file to replace them.
              </p>
              <div class="flex items-center gap-3">
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  class="text-sm"
                  @change="onEditChapterFileChange"
                >
                <UButton
                  v-if="editChapterHasNotes"
                  label="Remove"
                  variant="ghost"
                  color="neutral"
                  size="sm"
                  @click="removeEditChapterNotes"
                />
              </div>
            </div>
          </UFormField>
          <p
            v-if="editChapterError"
            class="text-sm text-error"
          >
            {{ editChapterError }}
          </p>
          <UButton
            label="Save"
            block
            :loading="savingEditChapter"
            @click="saveEditChapter"
          />
        </div>
      </template>
    </UModal>

    <AdminBulkImportModal
      v-model:open="bulkModalOpen"
      :sections="sectionList ?? []"
      @imported="onBulkImported"
    />

    <AdminHierarchyImportModal
      v-model:open="hierarchyModalOpen"
      :subject-id="subjectId"
      @imported="onHierarchyImported"
    />
  </div>
</template>
