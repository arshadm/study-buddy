<script setup lang="ts">
const { user, clear } = useUserSession()
const router = useRouter()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <header class="border-b border-default">
      <UContainer class="flex h-16 items-center justify-between gap-4">
        <div class="flex items-center gap-8">
          <NuxtLink
            to="/start"
            class="text-lg font-bold tracking-tight"
          >
            Study Buddy
          </NuxtLink>
          <nav class="hidden sm:flex items-center gap-1">
            <UButton
              to="/start"
              label="Start Session"
              variant="ghost"
              color="neutral"
            />
            <UButton
              to="/history"
              label="History"
              variant="ghost"
              color="neutral"
            />
          </nav>
        </div>

        <div class="flex items-center gap-3">
          <span class="hidden sm:inline text-sm text-muted">{{ user?.displayName }}</span>
          <UButton
            label="Log out"
            variant="subtle"
            color="neutral"
            size="sm"
            @click="logout"
          />
        </div>
      </UContainer>
    </header>

    <UContainer
      as="main"
      class="py-10"
    >
      <slot />
    </UContainer>
  </div>
</template>
