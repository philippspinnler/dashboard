// Polls /api/doorbell for a fresh doorbell press and drives the overlay's
// visibility. Follows the client-only setInterval pattern of useWidgetData.js.
//
//   const { visible, pressedAt, friendlyName, dismiss } = useDoorbell()
//
// A press shows the overlay and (re)starts an auto-dismiss timer. We only react
// to a press that is both NEW (timestamp changed) and RECENT (within
// FRESHNESS_MS) so a kiosk reload doesn't re-pop a long-past ring.
const FRESHNESS_MS = 30 * 1000

export function useDoorbell() {
  const cfg = useRuntimeConfig().public
  const enabled = cfg.doorbellEnabled === true || cfg.doorbellEnabled === 'true'
  // TEMP dev/tuning aid: pin the overlay open so you can style it without ringing.
  const alwaysShow = cfg.doorbellAlwaysShow === true || cfg.doorbellAlwaysShow === 'true'
  const pollMs = Number(cfg.doorbellPollMs) || 1500
  const overlayMs = (Number(cfg.doorbellOverlaySeconds) || 60) * 1000

  const visible = ref(false)
  const pressedAt = ref(null)
  const friendlyName = ref('Doorbell')

  let lastSeen = null
  let pollId = null
  let dismissId = null

  const show = () => {
    visible.value = true
    if (dismissId) clearTimeout(dismissId)
    dismissId = setTimeout(() => {
      visible.value = false
    }, overlayMs)
  }

  const dismiss = () => {
    visible.value = false
    if (dismissId) clearTimeout(dismissId)
  }

  const poll = async () => {
    try {
      const data = await $fetch('/api/doorbell')
      if (data?.friendlyName) friendlyName.value = data.friendlyName
      const ts = data?.pressedAt
      if (!ts || ts === lastSeen) return
      lastSeen = ts
      // Ignore stale presses (e.g. surfaced on first load after a reload).
      if (Date.now() - Date.parse(ts) > FRESHNESS_MS) return
      pressedAt.value = ts
      show()
    } catch {
      // transient; next tick retries
    }
  }

  if (import.meta.client && alwaysShow) {
    onMounted(() => {
      pressedAt.value = new Date().toISOString()
      visible.value = true // pinned open; no polling, no auto-dismiss
    })
    return { visible, pressedAt, friendlyName, dismiss }
  }

  if (import.meta.client && enabled) {
    onMounted(() => {
      poll() // prime lastSeen so we don't pop an old press on load
      pollId = setInterval(poll, pollMs)

      // Dev/offline affordance: press "d" to force-show the overlay without HA.
      if (import.meta.dev) {
        window.addEventListener('keydown', onDevKey)
      }
    })
    onBeforeUnmount(() => {
      if (pollId) clearInterval(pollId)
      if (dismissId) clearTimeout(dismissId)
      if (import.meta.dev) window.removeEventListener('keydown', onDevKey)
    })
  }

  function onDevKey(e) {
    if (e.key === 'd') {
      pressedAt.value = new Date().toISOString()
      show()
    }
  }

  return { visible, pressedAt, friendlyName, dismiss }
}
