<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const links = [
  { label: 'Categories', icon: 'i-lucide-folder-tree', to: '/admin/settings/categories' }
]
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold tracking-tight">
      Settings
    </h1>

    <div class="flex flex-col gap-6 sm:flex-row">
      <nav class="flex shrink-0 gap-1 sm:w-44 sm:flex-col">
        <UButton
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :label="link.label"
          :icon="link.icon"
          variant="ghost"
          color="neutral"
          active-variant="soft"
          class="justify-start"
        />
      </nav>

      <div class="min-w-0 flex-1">
        <NuxtPage />
      </div>
    </div>
  </div>
</template>
