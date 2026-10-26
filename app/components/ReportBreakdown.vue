<script setup lang="ts">
interface ChapterReportRow {
  sectionId: number | null
  sectionName: string
  attempted: boolean
  accuracyPercent: number | null
  totalAnswered: number
}
interface SubjectReportRow {
  subjectId: number
  subjectName: string
  attempted: boolean
  accuracyPercent: number | null
  totalAnswered: number
  chapters: ChapterReportRow[]
}

const props = withDefaults(defineProps<{
  report: SubjectReportRow[] | null | undefined
  title: string
  emptyMessage?: string
  notAttemptedHeading?: string
}>(), {
  emptyMessage: 'No subjects with questions yet.',
  notAttemptedHeading: 'Not attempted yet'
})

const attemptedSubjects = computed(() => props.report?.filter(s => s.attempted) ?? [])
const notAttemptedSubjects = computed(() => props.report?.filter(s => !s.attempted) ?? [])

// 'error' below 60%, 'success' at 80%+, 'warning' in between — same rough shape as the
// self-mark score coloring on the review page. Returns the full literal class name (not built
// via string interpolation) so Tailwind's static scan picks it up for the production build.
function accuracyColorClass(percent: number): string {
  if (percent >= 80) return 'text-success'
  if (percent >= 60) return 'text-warning'
  return 'text-error'
}
</script>

<template>
  <div class="space-y-3">
    <h2 class="text-lg font-bold tracking-tight">
      {{ title }}
    </h2>
    <p
      v-if="!report?.length"
      class="text-muted text-sm"
    >
      {{ emptyMessage }}
    </p>
    <template v-else>
      <div
        v-for="subject in attemptedSubjects"
        :key="subject.subjectId"
        class="rounded-lg border border-default overflow-hidden"
      >
        <div class="px-4 py-3 bg-elevated flex items-center justify-between">
          <span class="font-medium">{{ subject.subjectName }}</span>
          <span
            class="font-mono font-semibold"
            :class="accuracyColorClass(subject.accuracyPercent!)"
          >
            {{ subject.accuracyPercent }}%
            <span class="text-muted font-sans text-xs">({{ subject.totalAnswered }})</span>
          </span>
        </div>
        <div class="divide-y divide-default">
          <div
            v-for="chapter in subject.chapters"
            :key="chapter.sectionId ?? 'uncategorized'"
            class="px-4 py-2 flex items-center justify-between text-sm"
          >
            <span class="text-muted">{{ chapter.sectionName }}</span>
            <span
              v-if="chapter.attempted"
              class="font-mono"
              :class="accuracyColorClass(chapter.accuracyPercent!)"
            >
              {{ chapter.accuracyPercent }}%
              <span class="text-muted font-sans text-xs">({{ chapter.totalAnswered }})</span>
            </span>
            <span
              v-else
              class="text-muted text-xs"
            >Not attempted</span>
          </div>
        </div>
      </div>

      <div
        v-if="notAttemptedSubjects.length"
        class="rounded-lg border border-dashed border-default p-4"
      >
        <p class="text-sm font-medium text-muted mb-1">
          {{ notAttemptedHeading }}
        </p>
        <p class="text-sm">
          {{ notAttemptedSubjects.map(s => s.subjectName).join(', ') }}
        </p>
      </div>
    </template>
  </div>
</template>
