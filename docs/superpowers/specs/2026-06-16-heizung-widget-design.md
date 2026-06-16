# Heizung Widget — Design

**Date:** 2026-06-16
**Status:** Approved

## Goal

Add a new "Heizung" section to the dashboard that surfaces the Stiebel Eltron
heat pump's current activity: whether the floor is being **heated**, **cooled**,
or is **idle**, with a little supporting temperature context.

Data comes from the `stiebel_eltron_isg` Home Assistant custom integration
(already installed and reachable via the configured HA URL + token).

## What it shows

```
Heizung
☀ Heizt          ← headline state (Heizt / Kühlt / Bereit), icon + color
Raum     22.5° → 21.0°
Außen    18.7°
```

- **Headline state** — the primary signal, with an icon and color:
  - **Heizt** (heating) — warm icon, orange/red
  - **Kühlt** (cooling) — snowflake icon, blue
  - **Bereit** (idle) — neutral icon, gray
- **Raum** — current room/circuit temperature (Ist) → comfort target (Soll)
- **Außen** — outdoor temperature

## State logic

Evaluated server-side from the two boolean flags:

1. `is_cooling` on → **cooling**
2. else `is_heating` on → **heating**
3. else → **idle**

Cooling is checked first so an (unexpected) simultaneous-on never hides cooling.

## Entities

All entity ids are env-overridable via `runtimeConfig` (matching every other
integration). Defaults are the ids discovered on the user's HA instance.

| Field         | Default entity                                                 | Notes |
|---------------|----------------------------------------------------------------|-------|
| heating flag  | `binary_sensor.stiebel_eltron_isg_is_heating`                  | space heating to the floor |
| cooling flag  | `binary_sensor.stiebel_eltron_isg_is_cooling`                  | cooling to the floor |
| Raum Ist      | `sensor.stiebel_eltron_isg_actual_temperature_hk_1`            | HK1 assumed = floor circuit |
| Raum Soll     | `number.stiebel_eltron_isg_comfort_temperature_target_hk1`     | comfort target (21°), **not** the live summer-mode target (drops to ~5°) |
| Außen         | `sensor.stiebel_eltron_isg_outdoor_temperature`                | |

If the floor circuit is HK2 in a given install, flip the two HK1 env vars to
their HK2 equivalents — no code change needed.

## Architecture

Mirrors the existing inverter widget end-to-end.

1. **`server/api/heizung.get.ts`** — `defineDashboardCachedHandler` (`maxAge: 30`).
   - `if (isMockEnabled(event)) return getMock('heizung')`
   - Reads the five entities (`haRawState` for the two binary flags, `haState`
     for the three temps).
   - Returns `{ is_heating, is_cooling, room_actual, room_target, outdoor }`.
   - Booleans normalized to `true`/`false` from HA's `'on'`/`'off'`.
   - Temps are numbers or `null` when unavailable.

2. **`server/mocks/heizung.js`** — sample payload for `useMockData` mode.

3. **`components/widgets/WidgetHeizung.vue`** — `useWidgetData('/api/heizung', 30000)`.
   - Computes state (`cooling` / `heating` / `idle`) → label, icon, color.
   - Renders headline + Raum (Ist → Soll) + Außen.
   - Temps formatted to 1 decimal with `°`; a missing temp line is hidden.

4. **`app.vue`** — import `WidgetHeizung`, add `heizung: WidgetHeizung` to
   `widgetComponents`.

5. **`nuxt.config.ts`** — add the five `heizung*` entity defaults to
   `runtimeConfig`; swap `sonos` → `heizung` in the default `widgetsRight`.

6. **`.env` / `.env.example`** — swap `sonos` → `heizung` in
   `NUXT_PUBLIC_WIDGETS_RIGHT`; document the new `NUXT_HEIZUNG_*` entity vars.
   - Live `.env` right column becomes: `heizung,internet,netatmo,eo-guide,inverter`

## Out of scope / notes

- The Sonos widget component (`WidgetSonos.vue`) and route (`server/api/sonos*`)
  are left untouched — only removed from the layout, so Sonos can be re-enabled
  by putting `sonos` back into a `NUXT_PUBLIC_WIDGETS_*` var.
- No interactivity / control — read-only display, consistent with the rest of
  the dashboard.
- Cache TTL 30s (heating state changes slowly); client polls every 30s.

## Verification

- With `useMockData` on, the widget renders all three states from mock data.
- Against live HA (currently summer mode), the widget shows **Bereit**, Raum
  ~22.5° → 21.0°, Außen ~18.7°.
