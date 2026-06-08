// Doorbell ring signal, from the UniFi Protect doorbell entity in Home Assistant.
// Polled at a short interval by the client (see composables/useDoorbell.js), so we
// keep real-mode cache off (maxAge 0) for freshness; mock mode bypasses cache too.
//
// Modern UniFi Protect HA integration exposes an `event.<name>_doorbell` entity
// whose state is an ISO-8601 timestamp of the last press. Older setups expose a
// `binary_sensor` that flips to 'on' momentarily — we handle both.
//
// NOT cached: this is polled for freshness, and a cache here would mask new rings.
export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'no-store')

  if (isMockEnabled(event)) return getMock('doorbell')

  const config = useRuntimeConfig(event)
  const entityId = config.doorbellEventEntity
  const cameraEntity = config.doorbellCameraEntity

  const ent: any = await haEntity(event, entityId)
  const state = ent?.state
  const attrs = ent?.attributes || {}

  let pressedAt: string | null = null
  if (state && state !== 'unknown' && state !== 'unavailable') {
    if (state === 'on') {
      // binary_sensor form: pressed now; use when it last changed.
      pressedAt = ent.last_changed || null
    } else if (!Number.isNaN(Date.parse(state))) {
      // event form: state is the ISO timestamp of the last press.
      pressedAt = state
    }
  }

  return {
    pressedAt,
    cameraEntity,
    friendlyName: attrs.friendly_name || 'Doorbell',
  }
})
