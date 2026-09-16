<script setup lang="ts">
definePageMeta({ layout: false })

interface Overview {
  attempt: { status: string }
  currentSessionId: number | null
}

const route = useRoute()
const { data } = await useFetch<Overview>(`/api/paper-attempts/${route.params.id}`)

if (data.value?.attempt.status === 'completed' || !data.value?.currentSessionId) {
  await navigateTo(`/paper-attempts/${route.params.id}/results`)
} else {
  await navigateTo(`/session/${data.value.currentSessionId}`)
}
</script>

<template>
  <div />
</template>
