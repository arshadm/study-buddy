<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Subject {
  id: number
  name: string
  description: string | null
  isActive: boolean
  categoryId: number | null
}

const { data: subjects, refresh } = await useFetch<Subject[]>('/api/admin/subjects')
const { data: categoryRows } = await useFetch<CategoryRow[]>('/api/admin/categories')
const groups = computed(() => groupSubjectsByCategory(categoryRows.value ?? [], subjects.value ?? []))
const accordionItems = computed(() => groups.value.map(g => ({ value: g.key, label: g.name, group: g })))

// One category open at a time; the open one is remembered in a cookie so returning to the page
// (e.g. after managing a subject's questions) lands on the same category. '' = all collapsed.
// No cookie yet, or it names a category that no longer has subjects → open the first one.
const openCookie = useCookie<string | null>('admin-subjects-open-category', {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  default: () => null
})
const openCategory = computed<string | undefined>({
  get: () => {
    const saved = openCookie.value
    if (saved === '') return undefined
    if (saved && groups.value.some(g => g.key === saved)) return saved
    return groups.value[0]?.key
  },
  set: (value) => {
    openCookie.value = value ?? ''
  }
})

const modalOpen = ref(false)

async function onSaved() {
  modalOpen.value = false
  await refresh()
}

async function toggleActive(subject: Subject) {
  await $fetch(`/api/admin/subjects/${subject.id}`, {
    method: 'PATCH',
    body: { isActive: !subject.isActive }
  })
  await refresh()
}

async function deleteSubject(subject: Subject) {
  if (!confirm(`Delete "${subject.name}" and all its questions? This cannot be undone.`)) return
  try {
    await $fetch(`/api/admin/subjects/${subject.id}`, { method: 'DELETE' })
    await refresh()
  } catch (err) {
    alert(apiErrorMessage(err, 'Could not delete this subject'))
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold tracking-tight">
        Subjects
      </h1>
      <UButton
        label="Add subject"
        icon="i-lucide-plus"
        @click="modalOpen = true"
      />
    </div>

    <p
      v-if="!groups.length"
      class="text-sm text-muted"
    >
      No subjects yet.
    </p>
    <UAccordion
      v-else
      v-model="openCategory"
      :items="accordionItems"
      :ui="{ trigger: 'py-4', body: 'pb-4' }"
    >
      <template #leading="{ open }">
        <UIcon
          :name="open ? 'i-lucide-folder-open' : 'i-lucide-folder'"
          class="size-5 text-muted shrink-0"
        />
      </template>
      <template #default="{ item }">
        <span class="text-base font-semibold">{{ item.label }}</span>
        <span class="ml-2 text-xs text-muted font-mono">{{ item.group.subjects.length }}</span>
      </template>
      <template #body="{ item }">
        <div class="space-y-3">
          <div
            v-for="subject in item.group.subjects"
            :key="subject.id"
            class="rounded-lg border border-default p-4 flex items-center justify-between gap-4"
            :class="{ 'opacity-50': !subject.isActive }"
          >
            <NuxtLink
              :to="`/admin/subjects/${subject.id}`"
              class="min-w-0"
            >
              <p class="font-medium">
                {{ subject.name }}
                <span
                  v-if="!subject.isActive"
                  class="text-xs text-muted font-mono"
                >(draft)</span>
              </p>
              <p
                v-if="subject.description"
                class="text-sm text-muted truncate"
              >
                {{ subject.description }}
              </p>
            </NuxtLink>
            <div class="flex items-center gap-2 shrink-0">
              <UButton
                label="Manage questions"
                :to="`/admin/subjects/${subject.id}`"
                variant="subtle"
                color="neutral"
                size="sm"
              />
              <UButton
                :label="subject.isActive ? 'Unpublish' : 'Publish'"
                variant="ghost"
                color="neutral"
                size="sm"
                @click="toggleActive(subject)"
              />
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                size="sm"
                @click="deleteSubject(subject)"
              />
            </div>
          </div>
        </div>
      </template>
    </UAccordion>

    <UModal
      v-model:open="modalOpen"
      title="Add subject"
    >
      <template #body>
        <AdminSubjectForm @saved="onSaved" />
      </template>
    </UModal>
  </div>
</template>
