<script setup lang="ts">
const props = defineProps<{
  node: CategoryNode
  isFirst: boolean
  isLast: boolean
}>()

const onAction = inject(CATEGORY_ACTION_KEY)!
const expanded = ref(true)
const act = (action: CategoryAction) => onAction(action, props.node)
</script>

<template>
  <li>
    <div class="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-elevated">
      <UButton
        v-if="node.children.length"
        :icon="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        variant="ghost"
        color="neutral"
        size="xs"
        :aria-label="expanded ? 'Collapse' : 'Expand'"
        @click="expanded = !expanded"
      />
      <span
        v-else
        class="inline-block w-6"
      />

      <UIcon
        :name="node.children.length ? 'i-lucide-folder' : 'i-lucide-tag'"
        class="shrink-0 text-muted"
      />
      <span class="min-w-0 truncate font-medium">{{ node.name }}</span>
      <UBadge
        v-if="node.subjectCount"
        :label="`${node.subjectCount} subject${node.subjectCount === 1 ? '' : 's'}`"
        variant="subtle"
        color="neutral"
        size="sm"
      />

      <div class="ml-auto flex shrink-0 items-center gap-0.5 opacity-60 group-hover:opacity-100">
        <UTooltip text="Add sub-category">
          <UButton
            icon="i-lucide-folder-plus"
            variant="ghost"
            color="neutral"
            size="xs"
            aria-label="Add sub-category"
            @click="act('add-child')"
          />
        </UTooltip>
        <UTooltip text="Rename">
          <UButton
            icon="i-lucide-pencil"
            variant="ghost"
            color="neutral"
            size="xs"
            aria-label="Rename"
            @click="act('rename')"
          />
        </UTooltip>
        <UTooltip text="Move to another parent">
          <UButton
            icon="i-lucide-folder-input"
            variant="ghost"
            color="neutral"
            size="xs"
            aria-label="Move"
            @click="act('move')"
          />
        </UTooltip>
        <UButton
          icon="i-lucide-arrow-up"
          variant="ghost"
          color="neutral"
          size="xs"
          aria-label="Move up"
          :disabled="isFirst"
          @click="act('up')"
        />
        <UButton
          icon="i-lucide-arrow-down"
          variant="ghost"
          color="neutral"
          size="xs"
          aria-label="Move down"
          :disabled="isLast"
          @click="act('down')"
        />
        <UTooltip :text="node.children.length ? 'Remove its sub-categories first' : 'Delete'">
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            size="xs"
            aria-label="Delete"
            :disabled="node.children.length > 0"
            @click="act('delete')"
          />
        </UTooltip>
      </div>
    </div>

    <ul
      v-if="node.children.length && expanded"
      class="ml-5 border-l border-default pl-2"
    >
      <CategoryNode
        v-for="(child, i) in node.children"
        :key="child.id"
        :node="child"
        :is-first="i === 0"
        :is-last="i === node.children.length - 1"
      />
    </ul>
  </li>
</template>
