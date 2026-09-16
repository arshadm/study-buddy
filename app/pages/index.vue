<script setup lang="ts">
definePageMeta({ layout: false })

const { user } = useUserSession()

await navigateTo(user.value?.role === 'admin' ? '/admin' : '/start')
</script>

<template>
  <div />
</template>
