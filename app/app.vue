<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'en' }
})

useSeoMeta({
  title: 'Study Buddy',
  description: 'ESAT practice sessions'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
