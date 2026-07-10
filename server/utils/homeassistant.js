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

// Full /api/states dump (every entity). Returns [] on missing config/error.
// One call the caller can filter many ways — the warnings overlay derives
// batteries, problem sensors and watched entities from a single dump.
export async function haAllStates(event) {
  const config = useRuntimeConfig(event)
  const baseUrl = config.homeAssistantUrl
  const token = config.homeAssistantToken
  if (!baseUrl || !token) return []
  try {
    const all = await $fetch(`${baseUrl}/api/states`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return Array.isArray(all) ? all : []
  } catch {
    return []
  }
}

// All entities matching a device_class attribute, filtered from the full dump.
export async function haStatesByDeviceClass(event, deviceClass) {
  const all = await haAllStates(event)
  return all.filter((e) => e?.attributes?.device_class === deviceClass)
}

// Render a Jinja template via HA's REST template endpoint and return the raw
// rendered string (or null on missing config/error). Unlike /api/states this can
// reach registry data — e.g. `area_name(entity_id)` for an entity's room, which
// the warnings overlay uses to name humidity sensors by area. The endpoint
// returns text/plain, so we ask $fetch not to JSON-parse it.
export async function haTemplate(event, template) {
  const config = useRuntimeConfig(event)
  const baseUrl = config.homeAssistantUrl
  const token = config.homeAssistantToken
  if (!baseUrl || !token || !template) return null
  try {
    return await $fetch(`${baseUrl}/api/template`, {
      method: 'POST',
      body: { template },
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'text',
    })
  } catch {
    return null
  }
}
