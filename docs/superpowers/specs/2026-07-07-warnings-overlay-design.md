# Warnings Overlay — Design

**Date:** 2026-07-07
**Status:** Approved

## Goal

Generalize the existing low-battery overlay (bottom-left glass card) into a
general-purpose **warnings overlay**. Today it lists Home Assistant
`device_class: battery` entities at/below a threshold. We want it to also surface:

- The Roborock vacuum's warnings (kitchen — currently
  `sensor.s8_maxv_ultra_dock_dock_error` = `maintenance_brush_jammed`).
- The Grünbeck softliQ water softener salt warnings ("Salzvorrat gering / verbraucht").

It must be **extensible** (adding a warning type over time is cheap) and
**configurable** — e.g. a sibling deployment (brother) has no Grünbeck and runs a
different Home Assistant, so nothing device-specific may be hard-required.

## Approach (chosen: hybrid)

One overlay card, three server-side **providers**, each emitting a normalized
warning object. All three read from a single `/api/states` dump per poll.

Normalized warning shape:

```
{ id: string, kind: 'battery'|'problem'|'watch', name: string,
  detail: string, level?: number, severity: 'warning'|'error' }
```

### Provider 1 — battery (existing behaviour, preserved)

- Source: entities with `device_class: battery`.
- Excludes `binary_sensor.*` and unknown/unavailable states (as today).
- Emits when `level <= batteryThreshold` (default 25).
- `detail` = `"<level>%"`; the client colors it (red <10, amber <25) as today.
- `kind: 'battery'`, sorted lowest-level-first.

### Provider 2 — problem (new, generic, zero-config)

- Source: `binary_sensor` entities with `device_class: problem` whose state is `on`.
- This is HA's standard "something is wrong" signal; the Grünbeck
  `binary_sensor.softliq_se_bs12005970_has_error` (device_class `problem`) surfaces
  the salt warnings here automatically when active. Many integrations emit these.
- Excludes any entity id listed in `warningsProblemExclude` (safety against noise).
- Excludes unknown/unavailable states.
- **Name:** from `warningsLabelsJson[entity_id]` if present; else the friendly_name
  with a trailing " Has error" / " Problem" (case-insensitive) stripped.
- **Detail / severity:** if the sensor carries an `errors` attribute array (Grünbeck
  does), pick the most recent entry with `isResolved === false` (by `date`); use its
  `message` as detail and map its `type` (`error` → severity `error`, else `warning`).
  If there is no active (`isResolved:false`) error, fall back to detail = friendly
  short text and severity `warning`.
- `kind: 'problem'`.

### Provider 3 — watchlist (new, JSON-configured)

- Source: `warningsWatchlistJson` — a JSON array of entries:
  ```
  { "entity_id": string,
    "label": string,
    "okStates": string[],            // states considered healthy
    "messages"?: { [state]: string } // optional pretty per-state text
  }
  ```
- For each entry, read the entity's state from the same dump. Emit a warning when
  the state is **not** in `okStates` and not unknown/unavailable.
- `name` = `label`. `detail` = `messages[state]` if present, else the humanized raw
  state (underscores → spaces, first letter upper). `severity: 'warning'`.
- Covers the vacuum enum error sensors (`…_dock_dock_error`, `…_vacuum_error`,
  `okStates: ["none"]`). Fully generic — any enum/state sensor can be watched.
- `kind: 'watch'`.

## Data flow / efficiency

- Add `haAllStates(event)` to `server/utils/homeassistant.js` returning the full
  `/api/states` array (or `[]` on missing config / error). Refactor the existing
  `haStatesByDeviceClass` to filter `haAllStates` instead of doing its own fetch.
- `server/api/warnings.get.ts` (renamed from `batteries.get.ts`) calls
  `haAllStates` **once**, then runs all three providers against that one array —
  no extra HTTP per provider. Cached 300s (batteries/water/vacuum change slowly),
  same as today. Returns `{ warnings: Warning[], threshold }`.
- Sort order: battery warnings first (lowest level first), then problem, then
  watchlist. Stable within group.

## Client — `components/WarningsOverlay.vue`

- Renamed from `BatteryOverlay.vue`. Same corner-overlay mechanics
  (`useOverlayPosition`, `<Transition name="overlay-pop">`, `.overlay-corner`).
- Enabled/position from `warningsOverlayEnabled` / `warningsOverlayPosition`.
  Disabled deployments never poll (as today).
- Polls `/api/warnings` every 300s; renders while `warnings.length > 0`.
- Header: warning-triangle icon + "Warnungen".
- Single merged list. Each row: an icon by `kind` (battery glyph for `battery`,
  warning triangle for `problem`/`watch`; triangle turns red when
  `severity === 'error'`), the `name`, and a right-aligned `detail`. Battery rows
  keep the existing per-level color on the `detail`.
- Keep the existing glass card styling; widen slightly if needed for messages.

## Config (`nuxt.config.ts`)

Renames (public, client-visible):
- `batteryOverlayEnabled` → `warningsOverlayEnabled`
- `batteryOverlayPosition` → `warningsOverlayPosition`

Kept (private): `batteryThreshold`.

New (private, server-only — they hold entity ids):
- `warningsWatchlistJson` — default seeded with the two vacuum error sensors
  (`sensor.s8_maxv_ultra_dock_dock_error`, `sensor.s8_maxv_ultra_vacuum_error`),
  `okStates: ["none"]`, with a German `messages` map for common codes. Mirrors how
  `heizung*` / `inverter*` ship real discovered defaults.
- `warningsProblemExclude` — comma-separated entity ids to suppress (default `''`).
- `warningsLabelsJson` — `{ entity_id: label }` map; default seeds the Grünbeck
  error sensor → `"Grünbeck"` (default `'{}'` otherwise).

All overridable via `NUXT_*` env. A deployment without a Grünbeck simply never has
that problem sensor, so nothing shows — no action required. The vacuum default can
be cleared or repointed via `NUXT_WARNINGS_WATCHLIST_JSON`.

## Mock data

- Rename `server/mocks/batteries.js` → `server/mocks/warnings.js`, returning
  `{ warnings, threshold }` with a representative mix: two low batteries, one
  vacuum (`watch`) warning, one Grünbeck (`problem`, salt) warning — exercises all
  three kinds and both severities.
- Update `server/mocks/index.js`: key `batteries` → `warnings`.
- Verifiable end-to-end with `NUXT_PUBLIC_USE_MOCK_DATA=true`.

## Files touched

- `server/api/batteries.get.ts` → `server/api/warnings.get.ts`
- `server/utils/homeassistant.js` (add `haAllStates`, refactor `haStatesByDeviceClass`)
- `components/BatteryOverlay.vue` → `components/WarningsOverlay.vue`
- `server/mocks/batteries.js` → `server/mocks/warnings.js`; `server/mocks/index.js`
- `app.vue` (`<BatteryOverlay />` → `<WarningsOverlay />`)
- `nuxt.config.ts` (config above)
- `README.md` (overlay section + config tables, generic placeholders only)
- Homelab `compose.yml` (separate repo): rename `NUXT_PUBLIC_BATTERY_OVERLAY_*` →
  `NUXT_PUBLIC_WARNINGS_OVERLAY_*`, add new `NUXT_WARNINGS_*` vars; commit + push.

## Out of scope (YAGNI)

- Grouped/sectioned layout (single merged list chosen).
- Click-through / dismiss / acknowledge actions.
- Per-warning polling intervals (single 300s cache is enough).
- Device-registry name resolution for problem sensors (labels map + suffix-strip
  is sufficient).
