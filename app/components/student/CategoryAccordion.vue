<script setup lang="ts">
// One level of the start page's category tree; recurses for sub-categories. Only the first
// entry along the first branch starts open (openFirst is passed down to the first child only),
// so the student lands with the first category's subjects already visible.
const props = defineProps<{
  nodes: SubjectTreeNode<StartSubject>[]
  openFirst?: boolean
  // Nested levels use a lighter style so the hierarchy reads at a glance.
  nested?: boolean
}>()

const { choices } = inject(SUBJECT_CHOICES_KEY)!

const items = computed(() => props.nodes.map(n => ({ label: n.name, value: n.key, node: n })))
const openKeys = ref<string[]>(props.openFirst && props.nodes[0] ? [props.nodes[0].key] : [])

function selectedCount(node: SubjectTreeNode<StartSubject>) {
  return node.subjectIds.filter(id => choices[id]).length
}
</script>

<template>
  <UAccordion
    v-model="openKeys"
    type="multiple"
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

    <template #body="{ item, index }">
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
            :open-first="openFirst && index === 0"
            nested
          />
        </div>
      </div>
    </template>
  </UAccordion>
</template>
