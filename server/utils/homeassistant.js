// Home Assistant REST helpers, auto-imported into server routes.

async function haGetEntity(event, entityId) {
  const config = useRuntimeConfig(event)
  const baseUrl = config.homeAssistantUrl
  const token = config.homeAssistantToken
  if (!baseUrl || !token || !entityId) return null

  try {
    return await $fetch(`${baseUrl}/api/states/${entityId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return null
  }
}

// Numeric (or raw) state of an entity, or null when missing/unknown/unavailable.
// Ports the _ha_state() helper used by netatmo.
export async function haState(event, entityId) {
  const res = await haGetEntity(event, entityId)
  const state = res?.state
  if (state == null || state === 'unknown' || state === 'unavailable') return null
  const num = Number(state)
  return Number.isNaN(num) ? state : num
}

// Raw string state (no numeric coercion) — for cars/inverter, which the widgets
// parse themselves. Returns null when missing.
export async function haRawState(event, entityId) {
  const res = await haGetEntity(event, entityId)
  const state = res?.state
  return state == null ? null : state
}

// Full entity ({ state, attributes }) — for presence (needs entity_picture etc.).
export async function haEntity(event, entityId) {
  return haGetEntity(event, entityId)
}
