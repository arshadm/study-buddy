<script setup lang="ts">
interface AuthStatus {
  status: 'ok' | 'needs_reauth'
  lastCheckedAt: number | null
  lastErrorMessage: string | null
}

const { data: status, refresh } = await useFetch<AuthStatus>('/api/admin/claude-status')
const checking = ref(false)

async function checkNow() {
  checking.value = true
  try {
    await $fetch('/api/admin/claude-status/check', { method: 'POST' })
  } catch {
    // the check endpoint already recorded the failure as needs_reauth — just refresh below
  } finally {
    await refresh()
    checking.value = false
  }
}
</script>

<template>
  <div
    v-if="status?.status === 'needs_reauth'"
    class="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 flex items-center justify-between gap-4"
  >
    <div class="min-w-0">
      <p class="text-sm font-medium">
        Claude CLI needs re-authentication
      </p>
      <p class="text-xs text-muted truncate">
        {{ status.lastErrorMessage || 'Discussion-activity grading will fail until this is fixed.' }}
        Run <code>kamal app exec -i "claude auth login --claudeai"</code> over SSH, then check again.
      </p>
    </div>
    <UButton
      label="Check now"
      size="sm"
      variant="subtle"
      color="warning"
      :loading="checking"
      class="shrink-0"
      @click="checkNow"
    />
  </div>
</template>
