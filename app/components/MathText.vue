<script setup lang="ts">
import katex from 'katex'

const props = defineProps<{ text: string | null | undefined }>()

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderMath(source: string, displayMode: boolean): string {
  try {
    return katex.renderToString(source, { throwOnError: false, displayMode })
  } catch {
    return escapeHtml(displayMode ? `$$${source}$$` : `$${source}$`)
  }
}

// Splits on $$...$$ (block) and $...$ (inline) LaTeX delimiters; everything
// else is treated as plain text and HTML-escaped before insertion.
function renderSegment(segment: string): string {
  if (segment.startsWith('$$') && segment.endsWith('$$') && segment.length > 4) {
    return renderMath(segment.slice(2, -2), true)
  }
  if (segment.startsWith('$') && segment.endsWith('$') && segment.length > 2) {
    return renderMath(segment.slice(1, -1), false)
  }
  return escapeHtml(segment).replace(/\n/g, '<br>')
}

const html = computed(() => {
  const parts = (props.text ?? '').split(/(\$\$[^$]+?\$\$|\$[^$]+?\$)/g)
  return parts.map(renderSegment).join('')
})
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <span v-html="html" />
</template>
