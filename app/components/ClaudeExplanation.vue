<script setup lang="ts">
// "Explain with Claude": fetches (or starts) Claude's step-by-step solution from `url` — the
// student session-question endpoint or the admin question endpoint — and renders it inline. One
// explanation is saved per question and shared, so usually it's already there; when it isn't,
// generation runs on the server and this polls until it lands.

interface Step {
  title: string
  explanation: string
  working: string | null
  marks: string | null
}
interface Explanation {
  summary: string
  steps: Step[]
  final_answer: string
  common_mistakes: string[]
  matches_official_answer: boolean | null
}
type State
  = | { status: 'none' }
    | { status: 'pending' }
    | { status: 'failed', error: string }
    | { status: 'done', explanation: Explanation }

const props = defineProps<{
  url: string
  // Admin view: shows a Regenerate button once an explanation is showing.
  admin?: boolean
}>()

const POLL_MS = 4000

const open = ref(false)
const state = ref<State | null>(null)
const requestError = ref('')
const startedAt = ref(0)
const now = ref(Date.now())
let pollTimer: ReturnType<typeof setTimeout> | undefined
let clockTimer: ReturnType<typeof setInterval> | undefined

const elapsedSeconds = computed(() => Math.max(0, Math.round((now.value - startedAt.value) / 1000)))

function stopTimers() {
  clearTimeout(pollTimer)
  clearInterval(clockTimer)
  clockTimer = undefined
}
onBeforeUnmount(stopTimers)

function applyState(next: State) {
  state.value = next
  if (next.status === 'pending') {
    if (!clockTimer) {
      startedAt.value = Date.now()
      clockTimer = setInterval(() => {
        now.value = Date.now()
      }, 1000)
    }
    pollTimer = setTimeout(poll, POLL_MS)
  } else {
    stopTimers()
  }
}

async function poll() {
  try {
    const next = await $fetch<State>(props.url)
    // 'none' mid-poll means the server abandoned a stale attempt (e.g. it restarted) — restart it.
    applyState(next.status === 'none' ? await $fetch<State>(props.url, { method: 'POST' }) : next)
  } catch (err) {
    stopTimers()
    requestError.value = apiErrorMessage(err, 'Could not load the explanation')
  }
}

async function start(regenerate = false) {
  open.value = true
  requestError.value = ''
  stopTimers()
  try {
    // A saved explanation shows instantly; otherwise ask the server to make one.
    const current = regenerate ? null : await $fetch<State>(props.url)
    applyState(current?.status === 'done' || current?.status === 'pending'
      ? current
      : await $fetch<State>(props.url, { method: 'POST' }))
  } catch (err) {
    requestError.value = apiErrorMessage(err, 'Could not ask Claude')
  }
}

// Working is display maths; several lines separated by \\ need an environment in KaTeX.
function displayMath(working: string) {
  const body = working.includes('\\\\') && !working.includes('\\begin') ? `\\begin{gathered}${working}\\end{gathered}` : working
  return `$$${body}$$`
}
</script>

<template>
  <div class="space-y-3">
    <UButton
      v-if="!open"
      label="Explain with Claude"
      icon="i-lucide-sparkles"
      variant="subtle"
      @click="start()"
    />

    <div
      v-else
      class="rounded-lg border border-default p-4 space-y-4"
    >
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs font-mono text-muted flex items-center gap-1">
          <UIcon name="i-lucide-sparkles" />
          Claude's explanation
        </p>
        <div class="flex items-center gap-1">
          <UButton
            v-if="admin && (state?.status === 'done' || state?.status === 'failed')"
            label="Regenerate"
            icon="i-lucide-rotate-ccw"
            variant="ghost"
            color="neutral"
            size="xs"
            @click="start(true)"
          />
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            color="neutral"
            size="xs"
            aria-label="Hide explanation"
            @click="open = false"
          />
        </div>
      </div>

      <p
        v-if="requestError"
        class="text-sm text-error"
      >
        {{ requestError }}
      </p>

      <div
        v-else-if="!state || state.status === 'pending' || state.status === 'none'"
        class="flex items-center gap-2 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="animate-spin"
        />
        Claude is working through the question… this can take a minute or two<span
          v-if="elapsedSeconds"
          class="font-mono"
        >({{ elapsedSeconds }}s)</span>
      </div>

      <div
        v-else-if="state.status === 'failed'"
        class="space-y-2"
      >
        <p class="text-sm text-error">
          {{ state.error }}
        </p>
        <UButton
          label="Try again"
          icon="i-lucide-rotate-ccw"
          variant="subtle"
          color="neutral"
          size="sm"
          @click="start(true)"
        />
      </div>

      <div
        v-else
        class="space-y-5"
      >
        <p class="text-sm">
          <MathText :text="state.explanation.summary" />
        </p>

        <div
          v-if="state.explanation.matches_official_answer === false"
          class="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          <UIcon
            name="i-lucide-triangle-alert"
            class="shrink-0 mt-0.5 text-warning"
          />
          <span>Claude's first attempt disagreed with the official answer, so it has followed the official one. Trust the mark scheme if anything below doesn't match it.</span>
        </div>

        <ol class="space-y-4">
          <li
            v-for="(step, i) in state.explanation.steps"
            :key="i"
            class="flex gap-3"
          >
            <span class="shrink-0 flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-mono font-semibold">
              {{ i + 1 }}
            </span>
            <div class="min-w-0 flex-1 space-y-1.5">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-medium">
                  <MathText :text="step.title" />
                </p>
                <UBadge
                  v-if="step.marks"
                  :label="step.marks"
                  variant="subtle"
                  color="neutral"
                  size="sm"
                  class="font-mono"
                />
              </div>
              <p class="text-sm text-muted">
                <MathText :text="step.explanation" />
              </p>
              <div
                v-if="step.working"
                class="overflow-x-auto rounded-md bg-elevated px-3 py-1"
              >
                <MathText :text="displayMath(step.working)" />
              </div>
            </div>
          </li>
        </ol>

        <div class="rounded-md border border-primary/30 bg-primary/5 p-3">
          <p class="text-xs font-mono text-primary mb-1">
            Final answer
          </p>
          <MathText :text="state.explanation.final_answer" />
        </div>

        <div
          v-if="state.explanation.common_mistakes.length"
          class="space-y-1"
        >
          <p class="text-xs font-mono text-muted">
            Watch out for
          </p>
          <ul class="list-disc pl-5 text-sm space-y-1">
            <li
              v-for="(mistake, i) in state.explanation.common_mistakes"
              :key="i"
            >
              <MathText :text="mistake" />
            </li>
          </ul>
        </div>

        <p class="text-xs text-muted">
          Written by Claude and checked against the official answer where there is one — it can still make mistakes.
        </p>
      </div>
    </div>
  </div>
</template>
