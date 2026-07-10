# Vacuum maintenance warnings on the dashboard

**Date:** 2026-07-10
**Status:** Approved design, pending implementation plan

## Problem

The Roborock app nags when a consumable is due for cleaning/replacement (e.g.
"filter needs cleaning"), but the dashboard's warnings overlay shows nothing.

Root cause: `server/api/warnings.get.ts` has four providers — `battery`,
`problem` (`device_class: problem` binary_sensors), `watch` (the two vacuum
enum error sensors), and `humidity`. The consumable reminders are none of
these. They are **countdown sensors in hours** (`*_time_left`) that tick down
to zero, at which point the app nags. No provider looks at them, so the
dashboard is structurally blind to every consumable reminder.

The six countdown sensors, and their state on 2026-07-10:

| sensor | hours left |
|---|---|
| `sensor.s8_maxv_ultra_dock_strainer_time_left` | 0 |
| `sensor.s8_maxv_ultra_sensor_time_left` | 2.9 |
| `sensor.s8_maxv_ultra_filter_time_left` | 123 |
| `sensor.s8_maxv_ultra_dock_maintenance_brush_time_left` | 150 |
| `sensor.s8_maxv_ultra_side_brush_time_left` | 173 |
| `sensor.s8_maxv_ultra_main_brush_time_left` | 273 |

There is no separate "filter dirty" entity — a full entity sweep confirmed the
only maintenance signals are these six `*_time_left` sensors. `filter_time_left`
is 123h (not low), but the dock strainer is literally 0h; Roborock's UI/
translations often call the dirty-water strainer a "filter", so the reminder the
user saw is almost certainly the strainer. A near-zero rule surfaces it.

## Approach

Add a fifth provider, `maintenance`, to `server/api/warnings.get.ts`. It mirrors
the existing numeric `battery` provider: read a configured list of `*_time_left`
duration sensors from the shared `/api/states` dump and warn when a sensor's
value drops to/near zero. No new HA entities, no extra network calls (reuses the
`all` states array the other providers already filter).

Rejected alternatives:
- **Extend the `watch` provider** — it is built around `okStates`/string
  matching, not numeric thresholds. Adding numeric comparison muddies a clean
  provider.
- **Template `device_class: problem` binary_sensors in Home Assistant** — the
  existing `problem` provider would surface them for free, but it spreads config
  across two repos and adds HA entities to maintain. Keep it in the dashboard.

## Detailed design

### Provider

`maintenanceWarnings(all: any[], watchlist: MaintenanceEntry[], threshold: number): Warning[]`

```
type MaintenanceEntry = {
  entity_id: string
  label: string
  detail?: string   // action verb; defaults to 'Reinigen'
}
```

- Build an id→entity map from `all` (or reuse a shared map).
- For each entry: look up the entity; skip if missing. Parse `state` as a
  number; skip `unknown`/`unavailable`/empty (reuse the existing `UNKNOWN` set)
  and `NaN`. Emit a warning when `hours <= threshold`.
- Emit `{ id: entity_id, kind: 'maintenance', name: label, detail, severity: 'warning' }`.
- `detail` is the entry's action verb (`'Reinigen'` for filter/strainer/sensor,
  `'Wechseln'` for brushes), defaulting to `'Reinigen'` when unset.
- Add `'maintenance'` to the `Warning['kind']` union.

### Defaults

`DEFAULT_MAINTENANCE` (this deployment; German labels like the rest):

| entity_id | label | detail |
|---|---|---|
| `sensor.s8_maxv_ultra_filter_time_left` | Staubsauger Filter | Reinigen |
| `sensor.s8_maxv_ultra_dock_strainer_time_left` | Staubsauger Sieb | Reinigen |
| `sensor.s8_maxv_ultra_sensor_time_left` | Staubsauger Sensoren | Reinigen |
| `sensor.s8_maxv_ultra_main_brush_time_left` | Staubsauger Hauptbürste | Wechseln |
| `sensor.s8_maxv_ultra_side_brush_time_left` | Staubsauger Seitenbürste | Wechseln |
| `sensor.s8_maxv_ultra_dock_maintenance_brush_time_left` | Staubsauger Dock-Bürste | Wechseln |

### Config

Follow the existing `envOr` / `parseJson` fallback pattern (empty env keeps the
built-in default):

- `NUXT_WARNINGS_MAINTENANCE_JSON` — override the list (JSON array of
  `MaintenanceEntry`). Empty → `DEFAULT_MAINTENANCE`.
- `NUXT_MAINTENANCE_THRESHOLD` — hours threshold, default **5**. At 5h, today's
  strainer (0h) and sensor (2.9h) warn; filter (123h) does not.
- Add both runtime config keys to `nuxt.config.ts`.
- Mirror the new `NUXT_*` vars into the homelab `compose.yml` (separate repo),
  commit and push. (See the homelab-compose-env note.)

Wire the provider into the handler alongside the other four:
`...maintenanceWarnings(all, maintenancelist, maintenanceThreshold)`.

### Rendering — `components/WarningsOverlay.vue`

- Import `Wrench` from `iconoir-vue/regular/Wrench` and map
  `kind === 'maintenance'` to it in `iconFor()`.
- No color/detail special-casing needed: `detailColor()` already returns the
  default text color for non-battery kinds, and the wrench inherits the standard
  `#ffd24d` warning color.

### Mock + docs

- Add a `maintenance` sample row to `server/mocks/warnings.js` so mock mode shows
  the new kind.
- Update `README.md` (TOC, warnings feature description, config table) to document
  the maintenance provider and the two new env vars — generic placeholders only,
  per the keep-README-updated rule.

## Testing

- **Mock mode**: confirm the overlay renders a maintenance row with the wrench
  icon and the verb detail.
- **Real mode**: hit `/api/warnings` against live `/api/states`; confirm the
  strainer and sensor surface (verb detail) and the filter does not. Clear
  `.nuxt/cache/nitro/handlers` first — real-mode dev serves stale cached API
  responses (see the nitro-dev-cache note).

## Out of scope

- The app's periodic "wash the filter" reminder that is time/cycle based and not
  represented by any HA entity. Only the `*_time_left` countdowns are available,
  so only those are surfaced.
