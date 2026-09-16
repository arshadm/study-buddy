<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Subject { id: number }
interface Question { id: number }
interface Student { id: number }

const [{ data: subjects }, { data: questions }, { data: students }] = await Promise.all([
  useFetch<Subject[]>('/api/admin/subjects'),
  useFetch<Question[]>('/api/admin/questions'),
  useFetch<Student[]>('/api/admin/students')
])

const cards = computed(() => [
  { label: 'Subjects', count: subjects.value?.length ?? 0, to: '/admin/subjects', icon: 'i-lucide-book-open' },
  { label: 'Questions', count: questions.value?.length ?? 0, to: '/admin/questions', icon: 'i-lucide-help-circle' },
  { label: 'Students', count: students.value?.length ?? 0, to: '/admin/students', icon: 'i-lucide-users' }
])
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-8">
    <h1 class="text-2xl font-bold tracking-tight">
      Admin
    </h1>

    <div class="grid gap-4 sm:grid-cols-3">
      <NuxtLink
        v-for="card in cards"
        :key="card.label"
        :to="card.to"
        class="rounded-lg border border-default p-5 hover:border-muted transition-colors"
      >
        <UIcon
          :name="card.icon"
          class="size-5 text-primary"
        />
        <p class="text-2xl font-bold font-mono mt-3">
          {{ card.count }}
        </p>
        <p class="text-sm text-muted">
          {{ card.label }}
        </p>
      </NuxtLink>
    </div>
  </div>
</template>
