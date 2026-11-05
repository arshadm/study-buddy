<script setup lang="ts">
// One level of the start page's category tree; recurses for sub-categories. One category is
// open at a time per level; which one comes from the page's shared (cookie-backed) open keys.
const props = defineProps<{
  nodes: SubjectTreeNode<StartSubject>[]
  // Nested levels use a lighter style so the hierarchy reads at a glance.
  nested?: boolean
}>()

const { choices } = inject(SUBJECT_CHOICES_KEY)!
const openKeys = inject(START_OPEN_CATEGORIES_KEY)!

const items = computed(() => props.nodes.map(n => ({ label: n.name, value: n.key, node: n })))
const openKey = computed<string | undefined>({
  get: () => props.nodes.find(n => openKeys.value.includes(n.key))?.key,
  // Replaces only this level's entry, so the open category in other levels is kept.
  set: (key) => {
    const here = new Set(props.nodes.map(n => n.key))
    openKeys.value = [...openKeys.value.filter(k => !here.has(k)), ...(key ? [key] : [])]
  }
})

function selectedCount(node: SubjectTreeNode<StartSubject>) {
  return node.subjectIds.filter(id => choices[id]).length
}
</script>

<template>
  <UAccordion
    v-model="openKey"
    :items="items"
    :class="nested ? '' : 'rounded-lg border border-default px-4'"
    :ui="nested
      ? { trigger: 'text-sm font-medium py-2.5', body: 'pb-3' }
      : { trigger: 'text-base font-semibold', body: 'pb-4' }"
  >
    <template #leading="{ open }">
      <UIcon
        :name="open ? 'i-lucide-folder-open' : 'i-lucide-folder'"
        class="shrink-0 text-muted size-5"
      />
    </template>

    <template #trailing="{ item }">
      <UBadge
        v-if="selectedCount(item.node)"
        :label="`${selectedCount(item.node)} selected`"
        variant="subtle"
        size="sm"
        class="ml-auto"
      />
      <UIcon
        name="i-lucide-chevron-down"
        class="shrink-0 size-5 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
        :class="selectedCount(item.node) ? 'ml-2' : 'ml-auto'"
      />
    </template>

    <template #body="{ item }">
      <div class="space-y-3">
        <div
          v-if="item.node.subjects.length"
          class="flex flex-col gap-3"
        >
          <StudentSubjectCard
            v-for="subject in item.node.subjects"
            :key="subject.id"
            :subject="subject"
          />
        </div>

        <div
          v-if="item.node.children.length"
          class="border-l border-default pl-3"
        >
          <CategoryAccordion
            :nodes="item.node.children"
            nested
          />
        </div>
      </div>
    </template>
  </UAccordion>
</template>
