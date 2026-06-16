# Heizung Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Heizung" dashboard widget that shows whether the Stiebel Eltron heat pump is heating, cooling, or idle (plus room + outdoor temps), replacing the Sonos widget in the right column.

**Architecture:** Mirrors the existing inverter widget end-to-end — a cached Nitro `server/api` route reads Home Assistant entities (the `stiebel_eltron_isg` integration) and returns a small JSON payload; a Vue widget renders it via `useWidgetData`; entities and layout are wired through `runtimeConfig` env vars.

**Tech Stack:** Nuxt 3 (SSR + Nitro), Vue 3 `<script setup>`, iconoir-vue icons, Home Assistant REST.

**Testing note:** This project has **no test framework** (no test scripts or test files — every widget is verified by rendering and by hitting its API route). This plan follows that existing pattern: verification is done by curling the route in mock + live mode and loading the page, not by unit tests.

---

### Task 1: Server route — `/api/heizung`

**Files:**
- Create: `server/api/heizung.get.ts`

- [ ] **Step 1: Create the route**

```ts
// Stiebel Eltron ISG heat-pump status from Home Assistant. Reports whether the
// floor is being heated, cooled, or is idle, plus room + outdoor temps.
// Cache TTL 30s — heating state changes slowly. Mirrors inverter.get.ts.
export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('heizung')

    const config = useRuntimeConfig(event)
    const e = {
      is_heating: config.heizungIsHeatingEntity,
      is_cooling: config.heizungIsCoolingEntity,
      room_actual: config.heizungRoomActualEntity,
      room_target: config.heizungRoomTargetEntity,
      outdoor: config.heizungOutdoorEntity,
    }

    // HA binary_sensor → boolean (raw state is the string 'on' / 'off').
    const bool = async (entity: string) => (await haRawState(event, entity)) === 'on'
    // Numeric temp, or null when the entity is missing / unavailable.
    const temp = async (entity: string) => {
      const v = await haState(event, entity)
      return v == null ? null : Number(v)
    }

    return {
      is_heating: await bool(e.is_heating),
      is_cooling: await bool(e.is_cooling),
      room_actual: await temp(e.room_actual),
      room_target: await temp(e.room_target),
      outdoor: await temp(e.outdoor),
    }
  },
  { maxAge: 30 },
)
```

Note: `defineDashboardCachedHandler`, `isMockEnabled`, `getMock`, `haRawState`, `haState`, and `useRuntimeConfig` are all auto-imported by Nitro (see `server/utils/`). No imports needed.

- [ ] **Step 2: Commit**

```bash
git add server/api/heizung.get.ts
git commit -m "Add /api/heizung route reading Stiebel Eltron ISG status"
```

---

### Task 2: Runtime config — entity defaults

**Files:**
- Modify: `nuxt.config.ts` (the `runtimeConfig` block, after the inverter entries ending at `inverterPowerScale: '1',`)

- [ ] **Step 1: Add the five entity defaults**

Insert immediately after the `inverterPowerScale: '1',` line:

```ts
    // Heizung (Stiebel Eltron ISG heat pump via Home Assistant). Entity ids are
    // the defaults discovered on the install; override per-deployment via
    // NUXT_HEIZUNG_* env vars. State = cooling if is_cooling, else heating if
    // is_heating, else idle. Room target uses the comfort target (not the live
    // target, which drops to ~5° in summer mode).
    heizungIsHeatingEntity: 'binary_sensor.stiebel_eltron_isg_is_heating',
    heizungIsCoolingEntity: 'binary_sensor.stiebel_eltron_isg_is_cooling',
    heizungRoomActualEntity: 'sensor.stiebel_eltron_isg_actual_temperature_hk_1',
    heizungRoomTargetEntity: 'number.stiebel_eltron_isg_comfort_temperature_target_hk1',
    heizungOutdoorEntity: 'sensor.stiebel_eltron_isg_outdoor_temperature',
```

- [ ] **Step 2: Swap the default right-column layout**

In the same file, in `runtimeConfig.public`, change the `widgetsRight` default line from:

```ts
      widgetsRight: 'sonos,presence,internet,netatmo,public-transportation,eo-guide',
```

to:

```ts
      widgetsRight: 'heizung,presence,internet,netatmo,public-transportation,eo-guide',
```

- [ ] **Step 3: Commit**

```bash
git add nuxt.config.ts
git commit -m "Wire Heizung entity defaults + default layout into runtimeConfig"
```

---

### Task 3: Mock data

**Files:**
- Create: `server/mocks/heizung.js`
- Modify: `server/mocks/index.js`

- [ ] **Step 1: Create the mock payload**

```js
export default {
  is_heating: true,
  is_cooling: false,
  room_actual: 22.5,
  room_target: 21.0,
  outdoor: 18.7,
}
```

- [ ] **Step 2: Register it in the mock index**

In `server/mocks/index.js`, add the import alongside the others (after the `inverter` import):

```js
import heizung from './heizung.js'
```

and add it to the `mocks` object (after the `inverter,` entry):

```js
  heizung,
```

- [ ] **Step 3: Verify mock route works**

Run (starts dev server in mock mode, waits, hits the route):

```bash
NUXT_PUBLIC_USE_MOCK_DATA=true TMPDIR=/tmp npx nuxt dev >/tmp/heizung-dev.log 2>&1 &
sleep 25
curl -s http://localhost:3000/api/heizung
```

Expected: `{"is_heating":true,"is_cooling":false,"room_actual":22.5,"room_target":21,"outdoor":18.7}`

Then stop the dev server:

```bash
pkill -f "nuxt dev"
```

- [ ] **Step 4: Commit**

```bash
git add server/mocks/heizung.js server/mocks/index.js
git commit -m "Add Heizung mock data"
```

---

### Task 4: Widget component

**Files:**
- Create: `components/widgets/WidgetHeizung.vue`

- [ ] **Step 1: Create the component**

```vue
<template>
  <div class="heizung">
    <h1 class="title">Heizung</h1>

    <div class="state" :style="{ color: stateColor }">
      <component :is="stateIcon" class="state-icon" />
      <span class="state-label">{{ stateLabel }}</span>
    </div>

    <div class="metrics">
      <template v-if="roomActual !== null">
        <span class="m-label">Raum</span>
        <span class="m-value">
          {{ fmt(roomActual)
          }}<template v-if="roomTarget !== null"><span class="arrow"> → </span>{{ fmt(roomTarget) }}</template>
        </span>
      </template>
      <template v-if="outdoor !== null">
        <span class="m-label">Außen</span>
        <span class="m-value">{{ fmt(outdoor) }}</span>
      </template>
    </div>
  </div>
</template>

<script setup>
import FireFlame from 'iconoir-vue/regular/FireFlame'
import SnowFlake from 'iconoir-vue/regular/SnowFlake'
import Minus from 'iconoir-vue/regular/Minus'

const { data } = useWidgetData('/api/heizung', 30000)

// null stays null (so the line hides); numbers pass through.
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))
// '21.5°' — one decimal.
const fmt = (v) => `${Number(v).toFixed(1)}°`

const roomActual = computed(() => num(data.value?.room_actual))
const roomTarget = computed(() => num(data.value?.room_target))
const outdoor = computed(() => num(data.value?.outdoor))

const state = computed(() => {
  if (data.value?.is_cooling) return 'cooling'
  if (data.value?.is_heating) return 'heating'
  return 'idle'
})

const stateLabel = computed(() => ({ heating: 'Heizt', cooling: 'Kühlt', idle: 'Bereit' })[state.value])
const stateColor = computed(
  () => ({ heating: '#f97316', cooling: '#38bdf8', idle: 'rgba(255, 255, 255, 0.55)' })[state.value],
)
const stateIcon = computed(() => ({ heating: FireFlame, cooling: SnowFlake, idle: Minus })[state.value])
</script>

<style scoped>
/* inline-flex / inline-grid follow the column's text-align (right column → right),
   matching how WidgetInverter aligns itself within the column. */
.state {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
}

.state-icon {
  width: 1.9rem;
  height: 1.9rem;
  filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.55));
}

.state-label {
  font-size: 1.9rem;
  font-weight: 400;
  line-height: 1.05;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.55);
}

.metrics {
  display: inline-grid;
  grid-template-columns: auto auto;
  align-items: center;
  column-gap: 0.7rem;
  row-gap: 0.45rem;
  margin-top: 0.55rem;
}

.m-label {
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.92rem;
  letter-spacing: 0.04em;
  text-align: right;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.55);
}

.m-value {
  font-size: 1.5rem;
  font-weight: 400;
  line-height: 1.05;
  color: #fff;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.arrow {
  color: rgba(255, 255, 255, 0.5);
}
</style>
```

`useWidgetData` and `computed` are auto-imported (Nuxt). Icon names verified present in `node_modules/iconoir-vue/regular/` (`FireFlame`, `SnowFlake`, `Minus`).

- [ ] **Step 2: Commit**

```bash
git add components/widgets/WidgetHeizung.vue
git commit -m "Add WidgetHeizung component"
```

---

### Task 5: Register the widget in app.vue

**Files:**
- Modify: `app.vue` (imports block ~line 64-74, and `widgetComponents` map ~line 80-92)

- [ ] **Step 1: Add the import**

After the `import WidgetInverter from '~/components/widgets/WidgetInverter.vue'` line, add:

```js
import WidgetHeizung from '~/components/widgets/WidgetHeizung.vue'
```

- [ ] **Step 2: Register in the component map**

In the `widgetComponents` object, after the `inverter: WidgetInverter,` line, add:

```js
  heizung: WidgetHeizung,
```

- [ ] **Step 3: Commit**

```bash
git add app.vue
git commit -m "Register heizung widget in app.vue"
```

---

### Task 6: Swap Sonos → Heizung in env files

**Files:**
- Modify: `.env` (line 8)
- Modify: `.env.example` (line 13, plus new documented entity vars)

- [ ] **Step 1: Update the live `.env` right column**

Change line 8 from:

```
NUXT_PUBLIC_WIDGETS_RIGHT=sonos,internet,netatmo,eo-guide,inverter
```

to:

```
NUXT_PUBLIC_WIDGETS_RIGHT=heizung,internet,netatmo,eo-guide,inverter
```

- [ ] **Step 2: Update `.env.example` right column**

Change its line 13 from:

```
NUXT_PUBLIC_WIDGETS_RIGHT=sonos,presence,internet,netatmo,public-transportation,eo-guide
```

to:

```
NUXT_PUBLIC_WIDGETS_RIGHT=heizung,presence,internet,netatmo,public-transportation,eo-guide
```

- [ ] **Step 3: Document the new entity vars in `.env.example`**

Find the inverter entity block in `.env.example` and add this block right after it (keep the same comment style as the surrounding file):

```
# Heizung (Stiebel Eltron ISG heat pump via Home Assistant). Defaults match the
# stiebel_eltron_isg integration's entity ids; override if yours differ (e.g.
# HK2 instead of HK1). State = Kühlt if is_cooling, else Heizt if is_heating,
# else Bereit. Room target uses the comfort target (the live target drops to
# ~5° in summer mode).
NUXT_HEIZUNG_IS_HEATING_ENTITY=binary_sensor.stiebel_eltron_isg_is_heating
NUXT_HEIZUNG_IS_COOLING_ENTITY=binary_sensor.stiebel_eltron_isg_is_cooling
NUXT_HEIZUNG_ROOM_ACTUAL_ENTITY=sensor.stiebel_eltron_isg_actual_temperature_hk_1
NUXT_HEIZUNG_ROOM_TARGET_ENTITY=number.stiebel_eltron_isg_comfort_temperature_target_hk1
NUXT_HEIZUNG_OUTDOOR_ENTITY=sensor.stiebel_eltron_isg_outdoor_temperature
```

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "Swap Sonos for Heizung in default layout; document Heizung env vars"
```

(Note: `.env` is gitignored — Step 1 changes the live runtime config but is not committed.)

---

### Task 7: End-to-end verification (mock + live)

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server against live HA**

```bash
TMPDIR=/tmp npx nuxt dev >/tmp/heizung-dev.log 2>&1 &
sleep 25
```

- [ ] **Step 2: Verify the live route returns real data**

```bash
curl -s http://localhost:3000/api/heizung
```

Expected (values will vary): a JSON object with boolean `is_heating`/`is_cooling` and numeric `room_actual`, `room_target` (≈21), `outdoor`. In summer mode both booleans are `false` → widget shows **Bereit**.

- [ ] **Step 3: Verify the page renders the widget**

Open `http://localhost:3000/` in a browser (or screenshot via the project's run tooling). Confirm the right column shows a **Heizung** widget with a state headline (Heizt/Kühlt/Bereit), a **Raum** line (Ist → Soll), and an **Außen** line — and that the Sonos widget is gone.

- [ ] **Step 4: Verify all three states render (mock)**

Stop the live server, restart in mock mode, and confirm the heating state renders:

```bash
pkill -f "nuxt dev"
NUXT_PUBLIC_USE_MOCK_DATA=true TMPDIR=/tmp npx nuxt dev >/tmp/heizung-dev.log 2>&1 &
sleep 25
curl -s http://localhost:3000/api/heizung
```

Expected: `is_heating:true` → page shows **Heizt** (orange) with **Raum 22.5° → 21.0°** and **Außen 18.7°**. Optionally edit `server/mocks/heizung.js` to set `is_cooling:true` and reload to confirm **Kühlt** (blue), and both `false` to confirm **Bereit** (gray).

- [ ] **Step 5: Stop the dev server**

```bash
pkill -f "nuxt dev"
```
