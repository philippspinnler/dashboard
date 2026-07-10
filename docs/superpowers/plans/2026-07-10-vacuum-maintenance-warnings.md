# Vacuum Maintenance Warnings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the robot vacuum's consumable-maintenance reminders (filter, brushes, sensors, dock strainer) in the warnings overlay when a consumable's remaining runtime drops to/near zero.

**Architecture:** Add a fifth provider, `maintenance`, to the existing `server/api/warnings.get.ts` aggregator. It mirrors the numeric `battery` provider: read a configured list of Roborock `*_time_left` (hours) sensors from the shared `/api/states` dump already fetched for the other providers, and emit a warning when a sensor's value is `<= threshold`. The overlay component renders the new kind with a wrench icon and a German action verb ("Reinigen"/"Wechseln") as the detail text.

**Tech Stack:** Nuxt 3 (Nitro server route), Vue 3 SFC, iconoir-vue icons. No test framework exists in this repo — verification is via mock mode and the live `/api/warnings` endpoint, matching the established pattern.

## Global Constraints

- **No new network calls.** The provider reuses the `all` states array already fetched by `haAllStates(event)` in the handler — do not add a fetch.
- **Empty env keeps built-in defaults.** New `NUXT_*` config vars must default to `''` in `nuxt.config.ts` and fall back to the in-file defaults via the existing `envOr` / `parseJson` helpers — an empty value from Docker Compose must never wipe the defaults.
- **German labels**, matching the existing warning names ("Staubsauger Dock", "Grünbeck").
- **Threshold default `1` hour.** Fires only at the app's nag point.
- **Follow existing file patterns** in `warnings.get.ts` — new provider is a top-level function in the same file, wired into the handler's `warnings` array.
- **Homelab mirror rule:** any new `NUXT_*` var must also be added to the separate homelab `compose.yml` repo (Task 4).
- **README rule:** keep `README.md` (overlay reference + config table) in sync; generic placeholders only, no personal entity ids in prose.

---

### Task 1: Add the `maintenance` provider and wire it into the warnings handler

Adds the numeric provider, its defaults, the two config keys, and the handler wiring. Deliverable: `/api/warnings` returns a `maintenance` warning for a consumable whose `*_time_left` is `<= threshold`.

**Files:**
- Modify: `server/api/warnings.get.ts`
- Modify: `nuxt.config.ts` (runtimeConfig block, after `humidityExclude` at line 75)

**Interfaces:**
- Consumes: the `Warning` type, the `UNKNOWN` set, and `parseJson` — all already defined at the top of `server/api/warnings.get.ts`; the `all` states array and `config` from `useRuntimeConfig(event)` inside the handler.
- Produces:
  - `type MaintenanceEntry = { entity_id: string; label: string; detail?: string }`
  - `function maintenanceWarnings(all: any[], watchlist: MaintenanceEntry[], threshold: number): Warning[]`
  - `const DEFAULT_MAINTENANCE: MaintenanceEntry[]`
  - runtimeConfig keys `maintenanceThreshold: string` and `warningsMaintenanceJson: string`

- [ ] **Step 1: Extend the `Warning` kind union**

In `server/api/warnings.get.ts`, change the `Warning` type's `kind` field (currently at lines 19-26) to include `'maintenance'`:

```ts
type Warning = {
  id: string
  kind: 'battery' | 'problem' | 'watch' | 'humidity' | 'maintenance'
  name: string
  detail: string
  level?: number
  severity: 'warning' | 'error'
}
```

- [ ] **Step 2: Add the `MaintenanceEntry` type**

Add directly after the `WatchEntry` type (after line 40):

```ts
type MaintenanceEntry = {
  entity_id: string
  label: string
  detail?: string
}
```

- [ ] **Step 3: Add the `maintenanceWarnings` provider function**

Add after `watchWarnings` (after line 135, before the `HUMIDITY_TEMPLATE` const). It looks each configured consumable up in the shared states dump, parses its hours, and warns when `hours <= threshold`. Unknown/unavailable and non-numeric states are skipped.

```ts
// Roborock consumables expose a "*_time_left" countdown in hours; when one
// reaches zero the vacuum app nags to clean/replace that part. Warn on any
// configured consumable at/below `threshold` hours. detail is a fixed action
// verb (the raw "0 h" reads oddly), defaulting to 'Reinigen'.
function maintenanceWarnings(
  all: any[],
  watchlist: MaintenanceEntry[],
  threshold: number,
): Warning[] {
  const byId = new Map(all.map((e: any) => [e.entity_id, e]))
  const out: Warning[] = []
  for (const w of watchlist) {
    if (!w || !w.entity_id) continue
    const entity = byId.get(w.entity_id)
    if (!entity) continue
    const state = String(entity.state)
    if (UNKNOWN.has(state.toLowerCase())) continue
    const hours = Number(state)
    if (Number.isNaN(hours) || hours > threshold) continue
    out.push({
      id: w.entity_id,
      kind: 'maintenance',
      name: w.label || entity.attributes?.friendly_name || w.entity_id,
      detail: w.detail || 'Reinigen',
      severity: 'warning',
    })
  }
  return out
}
```

- [ ] **Step 4: Add the `DEFAULT_MAINTENANCE` defaults**

Add directly after `DEFAULT_WATCHLIST` (after line 187):

```ts
const DEFAULT_MAINTENANCE: MaintenanceEntry[] = [
  { entity_id: 'sensor.s8_maxv_ultra_filter_time_left', label: 'Staubsauger Filter', detail: 'Reinigen' },
  { entity_id: 'sensor.s8_maxv_ultra_dock_strainer_time_left', label: 'Staubsauger Sieb', detail: 'Reinigen' },
  { entity_id: 'sensor.s8_maxv_ultra_sensor_time_left', label: 'Staubsauger Sensoren', detail: 'Reinigen' },
  { entity_id: 'sensor.s8_maxv_ultra_main_brush_time_left', label: 'Staubsauger Hauptbürste', detail: 'Wechseln' },
  { entity_id: 'sensor.s8_maxv_ultra_side_brush_time_left', label: 'Staubsauger Seitenbürste', detail: 'Wechseln' },
  { entity_id: 'sensor.s8_maxv_ultra_dock_maintenance_brush_time_left', label: 'Staubsauger Dock-Bürste', detail: 'Wechseln' },
]
```

- [ ] **Step 5: Read config and wire the provider into the handler**

In the handler (`defineDashboardCachedHandler`, starting line 205), after the `watchlist` line (line 227) add the two config reads:

```ts
    const maintenanceThreshold = Number(config.maintenanceThreshold) || 1
    const maintenanceList = parseJson<MaintenanceEntry[]>(
      config.warningsMaintenanceJson,
      DEFAULT_MAINTENANCE,
    )
```

Then add the provider to the `warnings` array (currently lines 236-241), after the `...humidity` spread:

```ts
    const warnings: Warning[] = [
      ...batteryWarnings(all, threshold),
      ...problemWarnings(all, exclude, labels),
      ...watchWarnings(all, watchlist),
      ...humidity,
      ...maintenanceWarnings(all, maintenanceList, maintenanceThreshold),
    ]
```

- [ ] **Step 6: Add the runtimeConfig keys**

In `nuxt.config.ts`, immediately after the `humidityExclude` line (line 75) add:

```ts
    // Maintenance provider: warn on configured vacuum consumable "*_time_left"
    // (hours) sensors at/below maintenanceThreshold. The per-home default list
    // lives in server/api/warnings.get.ts so an empty value from Docker Compose
    // keeps it.
    maintenanceThreshold: '1', // NUXT_MAINTENANCE_THRESHOLD
    warningsMaintenanceJson: '', // NUXT_WARNINGS_MAINTENANCE_JSON
```

- [ ] **Step 7: Verify against the live endpoint**

The dock strainer is currently `0h` (`<= 1`) so it must appear; the filter (`123h`) must not. Real-mode dev serves stale cached API responses, so clear the Nitro handler cache first.

Run:
```bash
rm -rf .nuxt/cache/nitro/handlers
npm run dev
# in a second shell, once the server is up:
curl -s http://localhost:3000/api/warnings | npx --yes json 'warnings' | grep -A5 maintenance
```
Expected: a JSON object with `"kind":"maintenance"`, `"name":"Staubsauger Sieb"`, `"detail":"Reinigen"`, `"severity":"warning"`, and **no** entry named `"Staubsauger Filter"`.

- [ ] **Step 8: Commit**

```bash
git add server/api/warnings.get.ts nuxt.config.ts
git commit -m "Add vacuum maintenance provider to warnings overlay"
```

---

### Task 2: Render the `maintenance` kind and add a mock sample

Gives the new kind a wrench icon and a mock-mode sample row so it's visible without live HA. Deliverable: the overlay shows a wrench-iconed "Staubsauger Sieb — Reinigen" row in mock mode.

**Files:**
- Modify: `components/WarningsOverlay.vue`
- Modify: `server/mocks/warnings.js`

**Interfaces:**
- Consumes: the `maintenance` warning kind and its `{ id, kind, name, detail, severity }` shape produced by Task 1.
- Produces: no new exported symbols.

- [ ] **Step 1: Import the Wrench icon**

In `components/WarningsOverlay.vue`, after the existing icon imports (after line 26) add:

```js
import Wrench from 'iconoir-vue/regular/Wrench'
```

- [ ] **Step 2: Map the kind to the icon**

Update `iconFor` (lines 30-34) to:

```js
function iconFor(kind) {
  if (kind === 'battery') return BatteryWarning
  if (kind === 'humidity') return Droplet
  if (kind === 'maintenance') return Wrench
  return WarningTriangle
}
```

- [ ] **Step 3: Add a mock sample row**

In `server/mocks/warnings.js`, add a maintenance entry to the `warnings` array (after the humidity entry, before the closing `]` at line 45):

```js
    {
      id: 'sensor.vacuum_strainer_time_left',
      kind: 'maintenance',
      name: 'Staubsauger Sieb',
      detail: 'Reinigen',
      severity: 'warning',
    },
```

Also update the file's top comment (line 1) from "all four provider kinds" to "all five provider kinds" and add ", a vacuum consumable due for cleaning (maintenance)" to the description sentence.

- [ ] **Step 4: Verify in mock mode**

Run:
```bash
NUXT_PUBLIC_USE_MOCK_DATA=true npm run dev
```
Open `http://localhost:3000` and confirm the warnings overlay (bottom-left) shows a row with a **wrench icon**, name "Staubsauger Sieb", and detail "Reinigen" in the warning yellow (`#ffd24d`), alongside the existing battery/watch/problem/humidity rows.

- [ ] **Step 5: Commit**

```bash
git add components/WarningsOverlay.vue server/mocks/warnings.js
git commit -m "Render maintenance warnings with a wrench icon; add mock sample"
```

---

### Task 3: Document the maintenance provider in the README

Keeps the README overlay reference and config table complete. Deliverable: the Warnings overlay section describes the maintenance provider and lists both new env vars.

**Files:**
- Modify: `README.md` (Warnings `<details>` block, lines ~408-447; overlay table line 79)

**Interfaces:** none.

- [ ] **Step 1: Update the overlay "Appears when…" row**

Change line 79 from:

```
| ⚠️ **Warnings** | a battery is low, a device reports a problem, a watched sensor leaves its healthy state, or a room's humidity is too high |
```
to:
```
| ⚠️ **Warnings** | a battery is low, a device reports a problem, a watched sensor leaves its healthy state, a room's humidity is too high, or a device is due for maintenance |
```

- [ ] **Step 2: Update the provider count and add a bullet**

In the Warnings `<details>` block, change "from four sources" (line 410) to "from five sources". Then add this bullet after the **Humidity** bullet (after line 429):

```
- **Maintenance** — configured consumable "time left" sensors (hours) at or below
  `NUXT_MAINTENANCE_THRESHOLD` (default 1 h), e.g. a robot vacuum's filter, brushes,
  sensors, and dock strainer. Each shows a fixed action label ("Reinigen" /
  "Wechseln") rather than the raw hours. List entries in `NUXT_WARNINGS_MAINTENANCE_JSON`.
```

- [ ] **Step 3: Add the config-table rows**

In the variable table, add after the `NUXT_HUMIDITY_EXCLUDE` row (line 445):

```
| `NUXT_MAINTENANCE_THRESHOLD` | `1` | Warn on consumable `*_time_left` sensors at/below this many hours |
| `NUXT_WARNINGS_MAINTENANCE_JSON` | _(built-in)_ | JSON array of `{ entity_id, label, detail? }` consumables to watch |
```

- [ ] **Step 4: Verify**

Run:
```bash
grep -n "Maintenance\|NUXT_MAINTENANCE_THRESHOLD\|NUXT_WARNINGS_MAINTENANCE_JSON\|five sources" README.md
```
Expected: matches on the new bullet, both table rows, and "five sources".

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "Document maintenance warnings provider in README"
```

---

### Task 4: Mirror the new env vars into the homelab compose (separate repo)

The homelab `compose.yml` lives in a **separate repository**. Every new `NUXT_*` var must be mirrored there or production silently keeps only the built-in defaults with no override path. This task is a reminder/handoff — if the homelab repo is not checked out in this session, note it as a follow-up rather than blocking.

**Files:**
- Modify (separate repo): homelab `compose.yml`, the dashboard service's `environment:` block.

**Interfaces:** none.

- [ ] **Step 1: Add the two vars to the dashboard service environment**

In the homelab `compose.yml`, under the dashboard service `environment:`, add (leave values matching the defaults, or omit `NUXT_WARNINGS_MAINTENANCE_JSON` to keep the built-in list):

```yaml
      - NUXT_MAINTENANCE_THRESHOLD=1
      # - NUXT_WARNINGS_MAINTENANCE_JSON=   # optional; empty keeps the built-in list
```

- [ ] **Step 2: Commit and push in the homelab repo**

```bash
git add compose.yml
git commit -m "dashboard: add NUXT_MAINTENANCE_THRESHOLD"
git push
```

- [ ] **Step 3: If the homelab repo is unavailable**

If the homelab repo is not accessible in this session, do not block — record a follow-up note to the user that `NUXT_MAINTENANCE_THRESHOLD` must be added to the homelab `compose.yml` before the threshold can be overridden in production (the built-in default of `1 h` works without it).

---

## Self-Review

**Spec coverage:**
- New `maintenance` provider (numeric, `<= threshold`, skip unknown/NaN) → Task 1 Steps 3-5. ✓
- `MaintenanceEntry` type + `'maintenance'` kind → Task 1 Steps 1-2. ✓
- `DEFAULT_MAINTENANCE` list (six consumables, German labels, verbs) → Task 1 Step 4. ✓
- `NUXT_WARNINGS_MAINTENANCE_JSON` + `NUXT_MAINTENANCE_THRESHOLD` (default 1), empty-keeps-default via `parseJson`/`|| 1` → Task 1 Steps 5-6. ✓
- Wrench icon rendering → Task 2 Steps 1-2. ✓
- Mock sample → Task 2 Step 3. ✓
- README (overlay row, bullet, config table) → Task 3. ✓
- Homelab compose mirror → Task 4. ✓
- Testing via mock mode + live endpoint with Nitro cache clear → Task 1 Step 7, Task 2 Step 4. ✓
- Out of scope (app's cycle-based "wash filter" nag with no HA entity) → correctly omitted. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases" — every code step shows full content. ✓

**Type consistency:** `MaintenanceEntry` fields (`entity_id`, `label`, `detail?`) and `maintenanceWarnings(all, watchlist, threshold)` signature are used identically in the function, defaults, and handler wiring. Config keys `maintenanceThreshold` / `warningsMaintenanceJson` match between `nuxt.config.ts` and the handler reads. ✓

**Note on threshold idiom:** `Number(config.maintenanceThreshold) || 1` follows the existing `battery`/`humidity` pattern. Consequence: an explicit `0` env value falls back to `1` (0 is falsy). This is acceptable — the intended nag point is reached at `<= 1 h`, and the strainer's `0h` still fires. If an exact-zero threshold is ever needed, switch to a `Number.isFinite` guard, but that diverges from the codebase idiom and is out of scope here.
