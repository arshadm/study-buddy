<script setup lang="ts">
// An <img> that opens a full-screen viewer on click: zoom with the buttons, the mouse wheel,
// pinch or double-click/tap; pan by dragging (or scrolling when zoomed). Scale 1 = "fit": the
// whole image fills the screen, which already enlarges a small scan well past its inline size.
const props = defineProps<{
  src: string
  alt: string
  imgClass?: string
}>()

const open = ref(false)
const viewport = ref<HTMLDivElement | null>(null)
const natural = reactive({ w: 0, h: 0 })
const fitWidth = ref(0)
const scale = ref(1)

const MIN_SCALE = 1
const MAX_SCALE = 6

const displayWidth = computed(() => fitWidth.value * scale.value)
// Percentage of the image's real pixel size, so "100%" means actual pixels.
const percent = computed(() => natural.w ? Math.round((displayWidth.value / natural.w) * 100) : 100)

function computeFit() {
  const el = viewport.value
  if (!el || !natural.w) return
  const pad = 32
  fitWidth.value = natural.w * Math.min((el.clientWidth - pad) / natural.w, (el.clientHeight - pad) / natural.h)
}

function onViewerImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  natural.w = img.naturalWidth
  natural.h = img.naturalHeight
  scale.value = 1
  computeFit()
}

// Zooms keeping the point under (clientX, clientY) — or the viewport centre — fixed on screen.
async function zoomTo(next: number, clientX?: number, clientY?: number) {
  const el = viewport.value
  if (!el) return
  const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
  if (clamped === scale.value) return
  const rect = el.getBoundingClientRect()
  const px = (clientX ?? rect.left + rect.width / 2) - rect.left
  const py = (clientY ?? rect.top + rect.height / 2) - rect.top
  const ratio = clamped / scale.value
  const contentX = el.scrollLeft + px
  const contentY = el.scrollTop + py
  scale.value = clamped
  await nextTick()
  el.scrollLeft = contentX * ratio - px
  el.scrollTop = contentY * ratio - py
}

function zoomIn() {
  zoomTo(scale.value * 1.5)
}
function zoomOut() {
  zoomTo(scale.value / 1.5)
}
function fit() {
  scale.value = 1
}
// Tall exam pages read best filling the width and scrolling down, rather than shrunk to fit.
async function fitWidthOfScreen() {
  const el = viewport.value
  if (!el || !fitWidth.value) return
  scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (el.clientWidth - 32) / fitWidth.value))
  await nextTick()
  el.scrollTop = 0
  el.scrollLeft = 0
}
function actualSize() {
  if (fitWidth.value) zoomTo(natural.w / fitWidth.value)
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  zoomTo(scale.value * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY)
}

function onDoubleClick(e: MouseEvent) {
  if (scale.value > 1.05) fit()
  else zoomTo(2.5, e.clientX, e.clientY)
}

// Drag to pan; two pointers = pinch zoom.
const pointers = new Map<number, { x: number, y: number }>()
let pinchStart: { distance: number, scale: number } | null = null
const dragging = ref(false)

function pinchDistance() {
  const [a, b] = [...pointers.values()]
  return Math.hypot(a!.x - b!.x, a!.y - b!.y)
}

function onPointerDown(e: PointerEvent) {
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 2) pinchStart = { distance: pinchDistance(), scale: scale.value }
  dragging.value = pointers.size === 1
}

function onPointerMove(e: PointerEvent) {
  const prev = pointers.get(e.pointerId)
  const el = viewport.value
  if (!prev || !el) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 2 && pinchStart) {
    const [a, b] = [...pointers.values()]
    zoomTo(pinchStart.scale * (pinchDistance() / pinchStart.distance), (a!.x + b!.x) / 2, (a!.y + b!.y) / 2)
  } else if (pointers.size === 1) {
    el.scrollLeft -= e.clientX - prev.x
    el.scrollTop -= e.clientY - prev.y
  }
}

function onPointerUp(e: PointerEvent) {
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinchStart = null
  dragging.value = pointers.size === 1
}

function onKey(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === '+' || e.key === '=') zoomIn()
  else if (e.key === '-') zoomOut()
  else if (e.key === '0') fit()
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', computeFit)
  } else {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', computeFit)
    pointers.clear()
    pinchStart = null
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', computeFit)
})
</script>

<template>
  <button
    type="button"
    class="group relative block w-full cursor-zoom-in"
    :aria-label="`Enlarge ${alt}`"
    @click="open = true"
  >
    <img
      :src="src"
      :alt="alt"
      :class="imgClass"
    >
    <span class="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-md bg-inverted/70 px-1.5 py-1 text-xs text-inverted opacity-60 transition-opacity group-hover:opacity-100">
      <UIcon
        name="i-lucide-zoom-in"
        class="size-4"
      />
      <span class="hidden sm:inline">Zoom</span>
    </span>
  </button>

  <UModal
    v-model:open="open"
    fullscreen
    :title="alt"
    :ui="{ body: 'p-0 sm:p-0 flex-1 flex flex-col min-h-0' }"
  >
    <template #body>
      <div class="flex items-center justify-center gap-1 border-b border-default px-3 py-2">
        <UButton
          icon="i-lucide-zoom-out"
          variant="ghost"
          color="neutral"
          aria-label="Zoom out"
          :disabled="scale <= MIN_SCALE"
          @click="zoomOut"
        />
        <span class="w-14 text-center font-mono text-sm tabular-nums text-muted">{{ percent }}%</span>
        <UButton
          icon="i-lucide-zoom-in"
          variant="ghost"
          color="neutral"
          aria-label="Zoom in"
          :disabled="scale >= MAX_SCALE"
          @click="zoomIn"
        />
        <UButton
          label="Fit"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="fit"
        />
        <UButton
          label="Fit width"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="fitWidthOfScreen"
        />
        <UButton
          label="100%"
          variant="ghost"
          color="neutral"
          size="sm"
          class="hidden sm:inline-flex"
          @click="actualSize"
        />
        <span class="ml-3 hidden text-xs text-muted md:inline">Scroll or pinch to zoom · drag to move · double-click to toggle</span>
      </div>
      <div
        ref="viewport"
        class="min-h-0 flex-1 overflow-auto bg-muted select-none touch-none"
        :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
        @wheel="onWheel"
        @dblclick="onDoubleClick"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <div class="flex min-h-full min-w-full w-max items-center justify-center p-4">
          <img
            :src="props.src"
            :alt="alt"
            draggable="false"
            class="max-w-none bg-white shadow-lg"
            :style="fitWidth ? { width: `${displayWidth}px` } : { visibility: 'hidden' }"
            @load="onViewerImageLoad"
          >
        </div>
      </div>
    </template>
  </UModal>
</template>
