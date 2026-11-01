<script setup lang="ts">
interface SubjectTag { id: number, name: string, questionCount: number }

const props = defineProps<{ subjectId: string }>()

const { data: tags, refresh } = await useFetch<SubjectTag[]>(`/api/admin/subjects/${props.subjectId}/tags`)

const newTagName = ref('')
const adding = ref(false)
const errorMessage = ref('')
const importOpen = ref(false)

async function addTag() {
  const name = newTagName.value.trim()
  if (!name) return
  adding.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/admin/subjects/${props.subjectId}/tags`, { method: 'POST', body: { name } })
    newTagName.value = ''
    await refresh()
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Could not add tag')
  } finally {
    adding.value = false
  }
}

// Rename happens in a small modal so the chip list stays compact.
const renameTarget = ref<SubjectTag | null>(null)
const renameValue = ref('')
const renameError = ref('')
const renaming = ref(false)
const renameOpen = computed({
  get: () => renameTarget.value !== null,
  set: (open: boolean) => {
    if (!open) renameTarget.value = null
  }
})

function openRename(tag: SubjectTag) {
  renameTarget.value = tag
  renameValue.value = tag.name
  renameError.value = ''
}

async function submitRename() {
  if (!renameTarget.value || !renameValue.value.trim()) return
  renaming.value = true
  renameError.value = ''
  try {
    await $fetch(`/api/admin/subjects/${props.subjectId}/tags/${renameTarget.value.id}`, { method: 'PATCH', body: { name: renameValue.value } })
    renameTarget.value = null
    await refresh()
  } catch (err) {
    renameError.value = apiErrorMessage(err, 'Could not rename tag')
  } finally {
    renaming.value = false
  }
}

async function deleteTag(tag: SubjectTag) {
  const note = tag.questionCount ? ` It will be removed from ${tag.questionCount} question${tag.questionCount === 1 ? '' : 's'}.` : ''
  if (!confirm(`Delete tag "${tag.name}"?${note}`)) return
  errorMessage.value = ''
  try {
    await $fetch(`/api/admin/subjects/${props.subjectId}/tags/${tag.id}`, { method: 'DELETE' })
    await refresh()
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Could not delete tag')
  }
}
</script>

<template>
  <div class="rounded-lg border border-default p-4 space-y-4">
    <form
      class="flex gap-2"
      @submit.prevent="addTag"
    >
      <UInput
        v-model="newTagName"
        placeholder="New tag, e.g. Vectors"
        class="flex-1"
        :maxlength="50"
      />
      <UButton
        type="submit"
        label="Add"
        icon="i-lucide-plus"
        :loading="adding"
        :disabled="!newTagName.trim()"
      />
      <UButton
        label="Import CSV"
        icon="i-lucide-upload"
        variant="subtle"
        color="neutral"
        @click="importOpen = true"
      />
    </form>

    <p
      v-if="errorMessage"
      class="text-sm text-error"
    >
      {{ errorMessage }}
    </p>

    <p
      v-if="!tags?.length"
      class="text-sm text-muted"
    >
      No tags yet. Questions in this subject can only be tagged from this list.
    </p>
    <div
      v-else
      class="flex flex-wrap gap-2"
    >
      <div
        v-for="tag in tags"
        :key="tag.id"
        class="group flex items-center gap-1 rounded-full border border-default py-0.5 pl-3 pr-1 text-sm"
      >
        <span>{{ tag.name }}</span>
        <span
          class="font-mono text-xs text-muted"
          :title="`${tag.questionCount} question(s)`"
        >{{ tag.questionCount }}</span>
        <UButton
          icon="i-lucide-pencil"
          variant="ghost"
          color="neutral"
          size="xs"
          :aria-label="`Rename ${tag.name}`"
          @click="openRename(tag)"
        />
        <UButton
          icon="i-lucide-x"
          variant="ghost"
          color="error"
          size="xs"
          :aria-label="`Delete ${tag.name}`"
          @click="deleteTag(tag)"
        />
      </div>
    </div>

    <UModal
      v-model:open="renameOpen"
      title="Rename tag"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="submitRename"
        >
          <UInput
            v-model="renameValue"
            class="w-full"
            :maxlength="50"
            autofocus
          />
          <p
            v-if="renameError"
            class="text-sm text-error"
          >
            {{ renameError }}
          </p>
          <UButton
            type="submit"
            label="Save"
            block
            :loading="renaming"
            :disabled="!renameValue.trim()"
          />
        </form>
      </template>
    </UModal>

    <AdminTagImportModal
      v-model:open="importOpen"
      :subject-id="subjectId"
      @imported="refresh()"
    />
  </div>
</template>
