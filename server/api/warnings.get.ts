// Aggregated home warnings for the corner overlay. Three providers, all derived
// from a single /api/states dump (batteries, water/vacuum/etc. change slowly, so
// a 5-minute cache is plenty):
//
//   battery  — device_class:battery entities at/below batteryThreshold
//   problem  — device_class:problem binary_sensors currently `on`
//              (Home Assistant's standard "something's wrong" signal; the
//              Grünbeck salt warning surfaces here automatically)
//   watch    — configured enum/state sensors whose state isn't in `okStates`
//              (e.g. the vacuum dock error, where `none` means healthy)
//
// Each provider emits a normalized warning:
//   { id, kind, name, detail, level?, severity: 'warning'|'error' }

import { haAllStates } from '../utils/homeassistant'

type Warning = {
  id: string
  kind: 'battery' | 'problem' | 'watch'
  name: string
  detail: string
  level?: number
  severity: 'warning' | 'error'
}

type WatchEntry = {
  entity_id: string
  label?: string
  okStates?: string[]
  messages?: Record<string, string>
}

const UNKNOWN = new Set(['unknown', 'unavailable', ''])

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

// "maintenance_brush_jammed" -> "Maintenance brush jammed"
function humanize(state: string): string {
  const s = state.replace(/[_-]+/g, ' ').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : state
}

// Strip a trailing " Has error" / " Problem" so a problem sensor's friendly_name
// reads as the device, not the sensor.
function deviceName(friendly: string): string {
  return friendly.replace(/\s+(has\s+error|problem)$/i, '').trim() || friendly
}

function batteryWarnings(all: any[], threshold: number): Warning[] {
  return all
    .filter((e: any) => e?.attributes?.device_class === 'battery')
    .filter((e: any) => !String(e.entity_id || '').startsWith('binary_sensor.'))
    .map((e: any) => ({
      entity_id: e.entity_id as string,
      name: (e.attributes?.friendly_name || e.entity_id) as string,
      level: Number(e.state),
    }))
    .filter((e) => !Number.isNaN(e.level) && e.level <= threshold)
    .sort((a, b) => a.level - b.level)
    .map(
      (e): Warning => ({
        id: e.entity_id,
        kind: 'battery',
        name: e.name,
        detail: `${e.level}%`,
        level: e.level,
        severity: 'warning',
      }),
    )
}

function problemWarnings(
  all: any[],
  exclude: Set<string>,
  labels: Record<string, string>,
): Warning[] {
  return all
    .filter((e: any) => e?.attributes?.device_class === 'problem')
    .filter((e: any) => String(e.entity_id || '').startsWith('binary_sensor.'))
    .filter((e: any) => e.state === 'on' && !exclude.has(e.entity_id))
    .map((e: any): Warning => {
      const friendly = (e.attributes?.friendly_name || e.entity_id) as string
      const name = labels[e.entity_id] || deviceName(friendly)
      // Grünbeck-style entities carry an `errors` history; surface the newest
      // still-active one and honour its warning/error type.
      const errors = Array.isArray(e.attributes?.errors) ? e.attributes.errors : []
      const active = errors
        .filter((x: any) => x && x.isResolved === false)
        .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))[0]
      return {
        id: e.entity_id,
        kind: 'problem',
        name,
        detail: active?.message ? String(active.message) : friendly,
        severity: active?.type === 'error' ? 'error' : 'warning',
      }
    })
}

function watchWarnings(all: any[], watchlist: WatchEntry[]): Warning[] {
  const byId = new Map(all.map((e: any) => [e.entity_id, e]))
  const out: Warning[] = []
  for (const w of watchlist) {
    if (!w || !w.entity_id) continue
    const entity = byId.get(w.entity_id)
    if (!entity) continue
    const state = String(entity.state)
    const ok = new Set(w.okStates || [])
    if (ok.has(state) || UNKNOWN.has(state.toLowerCase())) continue
    out.push({
      id: w.entity_id,
      kind: 'watch',
      name: w.label || entity.attributes?.friendly_name || w.entity_id,
      detail: w.messages?.[state] || humanize(state),
      severity: 'warning',
    })
  }
  return out
}

// Built-in defaults for this deployment. Used whenever the matching env var is
// unset OR empty — Docker Compose passes an empty string for any var Portainer
// doesn't define, and an empty string would otherwise wipe these. Override by
// setting a non-empty value; set an explicit '[]' / '{}' / a sentinel to opt out.
const DEFAULT_WATCHLIST: WatchEntry[] = [
  {
    entity_id: 'sensor.s8_maxv_ultra_dock_dock_error',
    label: 'Staubsauger Dock',
    okStates: ['none'],
    messages: { maintenance_brush_jammed: 'Bürste blockiert' },
  },
  { entity_id: 'sensor.s8_maxv_ultra_vacuum_error', label: 'Staubsauger', okStates: ['none'] },
]
const DEFAULT_LABELS: Record<string, string> = {
  'binary_sensor.softliq_se_bs12005970_has_error': 'Grünbeck',
  'binary_sensor.s8_maxv_ultra_dock_clean_water_box': 'Staubsauger Frischwasser',
  'binary_sensor.s8_maxv_ultra_dock_dirty_water_box': 'Staubsauger Schmutzwasser',
  'binary_sensor.s8_maxv_ultra_water_shortage': 'Staubsauger Wassermangel',
}
const DEFAULT_EXCLUDE = 'binary_sensor.s8_maxv_ultra_dock_cleaning_fluid'

// Env value if provided (non-empty after trim), else the built-in default.
function envOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback
}

export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('warnings')

    const config = useRuntimeConfig(event)
    const threshold = Number(config.batteryThreshold) || 25
    const exclude = new Set(
      envOr(config.warningsProblemExclude, DEFAULT_EXCLUDE)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    // parseJson already falls back on an empty/invalid value, so unset (empty)
    // env vars keep the built-in defaults.
    const labels = parseJson<Record<string, string>>(config.warningsLabelsJson, DEFAULT_LABELS)
    const watchlist = parseJson<WatchEntry[]>(config.warningsWatchlistJson, DEFAULT_WATCHLIST)

    const all = await haAllStates(event)

    const warnings: Warning[] = [
      ...batteryWarnings(all, threshold),
      ...problemWarnings(all, exclude, labels),
      ...watchWarnings(all, watchlist),
    ]

    return { warnings, threshold }
  },
  { maxAge: 300 },
)
