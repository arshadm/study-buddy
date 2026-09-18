<script setup lang="ts">
interface Point { x: number, percent: number }
interface Series { studentId: number, studentName: string, points: Point[] }

const props = defineProps<{
  title: string
  series: Series[]
}>()

const COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6']

const width = 640
const height = 220
const padding = { top: 16, right: 16, bottom: 28, left: 34 }
const innerWidth = width - padding.left - padding.right
const innerHeight = height - padding.top - padding.bottom

const allPoints = computed(() => props.series.flatMap(s => s.points))

const xDomain = computed<[number, number]>(() => {
  const xs = allPoints.value.map(p => p.x)
  if (xs.length === 0) return [0, 1]
  const min = Math.min(...xs)
  const max = Math.max(...xs)
  return min === max ? [min - 86400000, max + 86400000] : [min, max]
})

function scaleX(x: number) {
  const [min, max] = xDomain.value
  return padding.left + ((x - min) / (max - min)) * innerWidth
}

function scaleY(percent: number) {
  return padding.top + (1 - percent / 100) * innerHeight
}

const gridLines = [0, 25, 50, 75, 100]

const linesWithColor = computed(() =>
  props.series.map((s, i) => ({
    ...s,
    color: COLORS[i % COLORS.length],
    path: s.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(p.x).toFixed(1)} ${scaleY(p.percent).toFixed(1)}`).join(' ')
  }))
)

function dateLabel(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const hasData = computed(() => allPoints.value.length > 0)
</script>

<template>
  <div class="rounded-lg border border-default p-4 space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="font-medium">
        {{ title }}
      </h3>
      <div
        v-if="series.length > 1"
        class="flex flex-wrap gap-3"
      >
        <span
          v-for="line in linesWithColor"
          :key="line.studentId"
          class="flex items-center gap-1.5 text-xs text-muted"
        >
          <span
            class="size-2 rounded-full shrink-0"
            :style="{ backgroundColor: line.color }"
          />
          {{ line.studentName }}
        </span>
      </div>
    </div>

    <p
      v-if="!hasData"
      class="text-sm text-muted py-8 text-center"
    >
      No attempts yet.
    </p>

    <svg
      v-else
      :viewBox="`0 0 ${width} ${height}`"
      class="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      <g
        v-for="gy in gridLines"
        :key="gy"
      >
        <line
          :x1="padding.left"
          :x2="width - padding.right"
          :y1="scaleY(gy)"
          :y2="scaleY(gy)"
          class="text-default"
          stroke="currentColor"
          stroke-width="1"
        />
        <text
          :x="padding.left - 8"
          :y="scaleY(gy) + 3"
          text-anchor="end"
          class="text-muted font-mono"
          fill="currentColor"
          font-size="9"
        >{{ gy }}%</text>
      </g>

      <text
        :x="padding.left"
        :y="height - 8"
        text-anchor="start"
        class="text-muted font-mono"
        fill="currentColor"
        font-size="9"
      >{{ dateLabel(xDomain[0]) }}</text>
      <text
        :x="width - padding.right"
        :y="height - 8"
        text-anchor="end"
        class="text-muted font-mono"
        fill="currentColor"
        font-size="9"
      >{{ dateLabel(xDomain[1]) }}</text>

      <g
        v-for="line in linesWithColor"
        :key="line.studentId"
      >
        <path
          :d="line.path"
          fill="none"
          :stroke="line.color"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        <circle
          v-for="(p, idx) in line.points"
          :key="idx"
          :cx="scaleX(p.x)"
          :cy="scaleY(p.percent)"
          r="3.5"
          :fill="line.color"
        >
          <title>{{ line.studentName }}: {{ p.percent }}% on {{ dateLabel(p.x) }}</title>
        </circle>
      </g>
    </svg>
  </div>
</template>
