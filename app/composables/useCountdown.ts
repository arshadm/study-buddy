export function useCountdown(initialRemainingMs: Ref<number>, onExpire: () => void) {
  const remainingMs = ref(initialRemainingMs.value)
  let interval: ReturnType<typeof setInterval> | undefined
  let expired = false

  const minutes = computed(() => Math.floor(remainingMs.value / 60000))
  const seconds = computed(() => Math.floor((remainingMs.value % 60000) / 1000))
  const formatted = computed(() => `${String(minutes.value).padStart(2, '0')}:${String(seconds.value).padStart(2, '0')}`)

  function tick() {
    remainingMs.value = Math.max(0, remainingMs.value - 1000)
    if (remainingMs.value <= 0 && !expired) {
      expired = true
      stop()
      onExpire()
    }
  }

  function start() {
    stop()
    interval = setInterval(tick, 1000)
  }

  function stop() {
    if (interval) clearInterval(interval)
  }

  function sync(newRemainingMs: number) {
    remainingMs.value = newRemainingMs
    expired = false
  }

  onUnmounted(stop)

  return { remainingMs, formatted, start, stop, sync }
}
