<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const { data: rows, refresh } = await useFetch<CategoryRow[]>('/api/admin/categories')

const tree = computed(() => buildCategoryTree(rows.value ?? []))
const pathLabels = computed(() => categoryPathLabels(rows.value ?? []))

const errorMessage = ref('')

// One modal, three modes: create (top-level or under a parent), rename, move.
type ModalMode = 'create' | 'rename' | 'move'
const modalOpen = ref(false)
const modalMode = ref<ModalMode>('create')
const modalNode = ref<CategoryNode | null>(null)
const nameInput = ref('')
// null = top level. Used as the parent for 'create' and the destination for 'move'.
const parentInput = ref<number | null>(null)
const saving = ref(false)
const modalError = ref('')

const modalTitle = computed(() => {
  if (modalMode.value === 'rename') return 'Rename category'
  if (modalMode.value === 'move') return `Move "${modalNode.value?.name}"`
  return parentInput.value === null ? 'Add category' : 'Add sub-category'
})

// A category can't move inside itself or its own descendants.
const parentOptions = computed(() => {
  const excluded = modalMode.value === 'move' && modalNode.value ? descendantIds(modalNode.value) : new Set<number>()
  return [
    { label: '— Top level —', value: null as number | null },
    ...flattenCategoryTree(tree.value)
      .filter(n => !excluded.has(n.id))
      .map(n => ({ label: pathLabels.value.get(n.id) ?? n.name, value: n.id as number | null }))
  ]
})

function openCreate(parentId: number | null) {
  modalMode.value = 'create'
  modalNode.value = null
  nameInput.value = ''
  parentInput.value = parentId
  modalError.value = ''
  modalOpen.value = true
}

async function run(fn: () => Promise<unknown>) {
  errorMessage.value = ''
  try {
    await fn()
    await refresh()
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Something went wrong')
  }
}

function onAction(action: CategoryAction, node: CategoryNode) {
  if (action === 'add-child') return openCreate(node.id)

  if (action === 'rename' || action === 'move') {
    modalMode.value = action
    modalNode.value = node
    nameInput.value = node.name
    parentInput.value = node.parentId
    modalError.value = ''
    modalOpen.value = true
    return
  }

  if (action === 'up' || action === 'down') {
    return run(() => $fetch(`/api/admin/categories/${node.id}/move`, { method: 'POST', body: { direction: action } }))
  }

  if (action === 'delete') {
    const note = node.subjectCount
      ? `\n\n${node.subjectCount} subject(s) filed here will be left without a category (they won't be deleted).`
      : ''
    if (!confirm(`Delete category "${node.name}"?${note}`)) return
    return run(() => $fetch(`/api/admin/categories/${node.id}`, { method: 'DELETE' }))
  }
}
provide(CATEGORY_ACTION_KEY, onAction)

async function submitModal() {
  saving.value = true
  modalError.value = ''
  try {
    if (modalMode.value === 'create') {
      await $fetch('/api/admin/categories', { method: 'POST', body: { name: nameInput.value, parentId: parentInput.value } })
    } else if (modalMode.value === 'rename') {
      await $fetch(`/api/admin/categories/${modalNode.value!.id}`, { method: 'PATCH', body: { name: nameInput.value } })
    } else {
      await $fetch(`/api/admin/categories/${modalNode.value!.id}`, { method: 'PATCH', body: { parentId: parentInput.value } })
    }
    modalOpen.value = false
    await refresh()
  } catch (err) {
    modalError.value = apiErrorMessage(err, 'Could not save category')
  } finally {
    saving.value = false
  }
}

const canSubmit = computed(() => modalMode.value === 'move' || nameInput.value.trim().length > 0)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-lg font-bold tracking-tight">
          Categories
        </h2>
        <p class="text-sm text-muted">
          A tree of categories and sub-categories for organizing subjects. Assign a subject to any
          category from its edit form.
        </p>
      </div>
      <UButton
        label="Add category"
        icon="i-lucide-plus"
        class="shrink-0"
        @click="openCreate(null)"
      />
    </div>

    <p
      v-if="errorMessage"
      class="text-sm text-error"
    >
      {{ errorMessage }}
    </p>

    <div class="rounded-lg border border-default p-2">
      <p
        v-if="!tree.length"
        class="p-4 text-center text-sm text-muted"
      >
        No categories yet. Add a top-level category to get started.
      </p>
      <ul v-else>
        <AdminCategoryNode
          v-for="(node, i) in tree"
          :key="node.id"
          :node="node"
          :is-first="i === 0"
          :is-last="i === tree.length - 1"
        />
      </ul>
    </div>

    <UModal
      v-model:open="modalOpen"
      :title="modalTitle"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="canSubmit && submitModal()"
        >
          <UFormField
            v-if="modalMode !== 'move'"
            label="Name"
          >
            <UInput
              v-model="nameInput"
              class="w-full"
              autofocus
            />
          </UFormField>

          <UFormField
            v-if="modalMode !== 'rename'"
            :label="modalMode === 'move' ? 'New parent' : 'Parent'"
          >
            <USelectMenu
              v-model="parentInput"
              :items="parentOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <p
            v-if="modalError"
            class="text-sm text-error"
          >
            {{ modalError }}
          </p>

          <UButton
            type="submit"
            :label="modalMode === 'create' ? 'Add' : 'Save'"
            block
            :loading="saving"
            :disabled="!canSubmit"
          />
        </form>
      </template>
    </UModal>
  </div>
</template>
