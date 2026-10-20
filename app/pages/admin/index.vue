<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Subject { id: number }
interface Question { id: number }
interface Student { id: number }
interface Paper { id: number }
interface SubjectPerformance {
  subjectId: number
  subjectName: string
  windows: Record<string, { percent: number | null, questions: number }>
}
interface CategoryPerformance {
  sectionId: number
  sectionName: string
  subjectId: number
  windows: Record<string, { percent: number | null, questions: number }>
}
interface ProgressPoint { x: number, percent: number }
interface StudentSeries { studentId: number, studentName: string, points: ProgressPoint[] }
interface SubjectProgress { subjectId: number, subjectName: string, students: StudentSeries[] }
interface Progress { papers: StudentSeries[], subjects: SubjectProgress[] }

const [{ data: subjects }, { data: questions }, { data: students }, { data: papers }, { data: performance }, { data: categoryPerformance }, { data: progress }] = await Promise.all([
  useFetch<Subject[]>('/api/admin/subjects'),
  useFetch<Question[]>('/api/admin/questions'),
  useFetch<Student[]>('/api/admin/students'),
  useFetch<Paper[]>('/api/admin/papers'),
  useFetch<SubjectPerformance[]>('/api/admin/stats/subject-performance'),
  useFetch<CategoryPerformance[]>('/api/admin/stats/category-performance'),
  useFetch<Progress>('/api/admin/stats/progress')
])

const windowDays = [7, 14, 28] as const

const expandedSubjects = ref<Set<number>>(new Set())
function toggleSubject(subjectId: number) {
  const next = new Set(expandedSubjects.value)
  if (next.has(subjectId)) next.delete(subjectId)
  else next.add(subjectId)
  expandedSubjects.value = next
}

function categoriesFor(subjectId: number) {
  return (categoryPerformance.value ?? []).filter(c => c.subjectId === subjectId)
}

const cards = computed(() => [
  { label: 'Subjects', count: subjects.value?.length ?? 0, to: '/admin/subjects', icon: 'i-lucide-book-open' },
  { label: 'Questions', count: questions.value?.length ?? 0, to: '/admin/subjects', icon: 'i-lucide-help-circle' },
  { label: 'Students', count: students.value?.length ?? 0, to: '/admin/students', icon: 'i-lucide-users' },
  { label: 'Papers', count: papers.value?.length ?? 0, to: '/admin/papers', icon: 'i-lucide-file-stack' }
])
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-8">
    <h1 class="text-2xl font-bold tracking-tight">
      Admin
    </h1>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <template
              v-for="subject in performance"
              :key="subject.subjectId"
            >
              <tr
                class="border-b border-default last:border-0 cursor-pointer hover:bg-elevated"
                @click="toggleSubject(subject.subjectId)"
              >
                <td class="px-4 py-3 font-medium flex items-center gap-1">
                  <UIcon
                    :name="expandedSubjects.has(subject.subjectId) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                    class="size-4 text-muted shrink-0"
                  />
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
              <tr
                v-if="expandedSubjects.has(subject.subjectId)"
                class="border-b border-default last:border-0 bg-elevated/50"
              >
                <td
                  :colspan="windowDays.length + 1"
                  class="px-4 py-3"
                >
                  <p
                    v-if="!categoriesFor(subject.subjectId).length"
                    class="text-xs text-muted"
                  >
                    No sections with answered questions yet.
                  </p>
                  <table
                    v-else
                    class="w-full text-sm"
                  >
                    <tbody>
                      <tr
                        v-for="category in categoriesFor(subject.subjectId)"
                        :key="category.sectionId"
                      >
                        <td class="py-1 pl-5 text-muted">
                          {{ category.sectionName }}
                        </td>
                        <td
                          v-for="days in windowDays"
                          :key="days"
                          class="py-1 text-right font-mono w-32"
                        >
                          <template v-if="category.windows[days]?.percent !== null">
                            {{ category.windows[days]?.percent }}%
                            <span class="text-muted font-sans text-xs">
                              ({{ category.windows[days]?.questions }})
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
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <div class="space-y-3">
      <h2 class="text-lg font-bold tracking-tight">
        Progress
      </h2>

      <p
        v-if="!progress?.papers.length && !progress?.subjects.length"
        class="text-sm text-muted"
      >
        No completed sessions yet.
      </p>

      <template v-else>
        <AdminProgressChart
          v-if="progress?.papers.length"
          title="Mock papers"
          :series="progress.papers"
        />
        <AdminProgressChart
          v-for="subject in progress?.subjects"
          :key="subject.subjectId"
          :title="subject.subjectName"
          :series="subject.students"
        />
      </template>
    </div>
  </div>
</template>
