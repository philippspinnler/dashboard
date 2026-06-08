// SSR-fetches a server route for instant first paint, then (client-only) polls
// it on an interval. Replaces the old useApi + usePolling pair.
//
//   const { data, error, refresh } = useWidgetData('/api/weather', 3600000)
//
export function useWidgetData(endpoint, intervalMs) {
  const { data, error, refresh } = useAsyncData(endpoint, () => $fetch(endpoint))

  if (import.meta.client && intervalMs) {
    let intervalId = null
    onMounted(() => {
      intervalId = setInterval(() => refresh(), intervalMs)
    })
    onBeforeUnmount(() => {
      if (intervalId) clearInterval(intervalId)
    })
  }

  return { data, error, refresh }
}
