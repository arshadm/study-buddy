<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

async function onSaved() {
  await navigateTo('/admin/questions')
}
</script>

<template>
  <div class="max-w-xl mx-auto space-y-6">
    <div class="flex items-center gap-3">
      <UButton
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
        to="/admin/questions"
      />
      <h1 class="text-2xl font-bold tracking-tight">
        New question
      </h1>
    </div>

    <AdminQuestionForm @saved="onSaved" />
  </div>
</template>
