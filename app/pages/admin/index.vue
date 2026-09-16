<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Subject { id: number }
interface Question { id: number }
interface Student { id: number }
interface SubjectPerformance {
  subjectId: number
  subjectName: string
  windows: Record<string, { percent: number | null, questions: number }>
}

const [{ data: subjects }, { data: questions }, { data: students }, { data: performance }] = await Promise.all([
  useFetch<Subject[]>('/api/admin/subjects'),
  useFetch<Question[]>('/api/admin/questions'),
  useFetch<Student[]>('/api/admin/students'),
  useFetch<SubjectPerformance[]>('/api/admin/stats/subject-performance')
])

const windowDays = [7, 14, 28] as const

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

    <div class="space-y-3">
      <h2 class="text-lg font-bold tracking-tight">
        Subject performance
      </h2>

      <p
        v-if="!performance?.length"
        class="text-sm text-muted"
      >
        No subjects yet.
      </p>

      <div
        v-else
        class="rounded-lg border border-default overflow-hidden"
      >
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-default bg-elevated">
              <th class="text-left font-medium px-4 py-2">
                Subject
              </th>
              <th
                v-for="days in windowDays"
                :key="days"
                class="text-right font-medium px-4 py-2"
              >
                Last {{ days }} days
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="subject in performance"
              :key="subject.subjectId"
              class="border-b border-default last:border-0"
            >
              <td class="px-4 py-3 font-medium">
                {{ subject.subjectName }}
              </td>
              <td
                v-for="days in windowDays"
                :key="days"
                class="px-4 py-3 text-right font-mono"
              >
                <template v-if="subject.windows[days]?.percent !== null">
                  {{ subject.windows[days]?.percent }}%
                  <span class="text-muted font-sans text-xs">
                    ({{ subject.windows[days]?.questions }})
                  </span>
                </template>
                <span
                  v-else
                  class="text-muted"
                >—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
