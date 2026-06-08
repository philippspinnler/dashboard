// Like defineCachedEventHandler, but bypasses the cache entirely in mock mode.
// This keeps real-mode caching (mirroring the old FastAPI TTLs) while ensuring
// mock responses are never written to / read from the persisted Nitro cache —
// so toggling NUXT_PUBLIC_USE_MOCK_DATA can't cross-contaminate, and edits to
// mock files show up immediately.
export function defineDashboardCachedHandler(handler, options) {
  return defineCachedEventHandler(handler, {
    ...options,
    shouldBypassCache: (event) => isMockEnabled(event),
  })
}
