# Widget Style Unification — Design

**Date:** 2026-06-16
**Status:** Approved

## Goal

Give the dashboard one consistent visual system. Today widgets diverge in font
sizes, label placement (some labels sit above the value, some to the left),
label colors, and unit styling. Unify them so the dashboard reads as a single
designed surface.

Decisions made during brainstorming (visual companion):
- **Label-left** layout wins over label-above (more compact, fewer rows).
- **Keep colored icons** (3-column grid: label · icon · value) over text-only.
- **Hero elements stay big** — the Clock time and the current Weather temp
  remain large focal anchors; they are not shrunk to the metric scale.
- **Autos and ÖV are gridified** into the same metric grid as the rest.

## Type scale (the shared scale)

| Element                | Size      | Color                       |
|------------------------|-----------|-----------------------------|
| Widget title (`.title`)| 1.9rem    | white @ 40%, uppercase      |
| Value                  | **1.6rem**| white                       |
| Label                  | 0.92rem   | white @ 55%, uppercase      |
| Unit (kW, %, °C, ppm)  | 0.8rem    | white @ 60%                 |
| Icon                   | ~1.3rem   | per-row accent color        |
| Sub-line               | 0.78rem   | white @ 60%                 |

All values keep `font-variant-numeric: tabular-nums` and the existing text
shadows for legibility over photo backgrounds.

## Shared building block (global CSS)

Add one set of classes to `assets/css/main.css`, next to the existing
`.title` / `.subtitle`. No new Vue component — global classes match how the
codebase already shares `.title`/`.subtitle`, keep churn low, and let each
widget keep its own data logic.

- `.metric-grid` — `inline-grid`, columns `auto auto auto` (label · icon ·
  value), `align-items: center`, consistent column/row gaps. Being inline-level
  it follows the column's `text-align`, so it right-aligns in the right column
  exactly like the current inverter grid. Rows without an icon leave the middle
  cell empty (`<span class="metric-icon"></span>`) so values stay aligned.
- `.metric-label` — uppercase, white @ 55%, right-aligned within its cell.
- `.metric-icon` — ~1.3rem, centered in its cell, colored per-row via inline
  `:style`/class. iconoir SVGs already inherit size via the existing `svg` rule;
  this sets the box.
- `.metric-value` — 1.6rem, white, tabular-nums, right-aligned, `nowrap`.
- `.metric-unit` — 0.8rem, white @ 60%, for trailing units.
- `.metric-sub` — 0.78rem, white @ 60%, a small secondary line under a value
  (e.g. battery "lädt 1.7 kW", or a transit absolute time).
- `.title` gets an explicit `font-size: 1.9rem` so every widget title matches
  (today they rely on the browser default `h1` size).

Also remove the now-unused `.subtitle` usages from widgets that move to the grid
(the class itself stays for any Tier-2 widget that still wants it).

## Tier 1 — full metric grid

Each of these renders as `.metric-grid`. Pure presentation change; no data or
behavior changes.

- **Wechselrichter** — already this shape. Swap scoped `.metrics`/`.m-*` for the
  shared classes; value 1.7rem → 1.6rem; battery charge/discharge line becomes
  `.metric-sub`. Keep all colors, icons, and logic.
- **Heizung** — drop the standalone large state block. Becomes a `Status` row:
  state icon (flame / snowflake / dash) in the icon cell, colored value
  (`Heizt` orange / `Kühlt` blue / `Aus` gray). Then `Raum` (Ist → Soll) and
  `Außen` rows with empty icon cells.
- **Netatmo** — convert from stacked `subtitle`+`h2` to the grid: `Innen`
  (indoor-temp icon), `Außen` (outdoor-temp icon), `CO2` (air/CO₂ icon). `°C`
  and `ppm` become `.metric-unit`.
- **Internet** — per speedtest: a dim provider line (`.metric-sub`, e.g. INIT7),
  then `Down` (download icon) / `Up` (upload icon) rows with `Gbps` units. Uses
  the `Download`/`Upload` icons already imported.
- **eo-guide** — already label-left; move from its bespoke `.abos` grid to the
  shared `.metric-grid`. `Jährlich` / `Monatlich` rows (empty icon cell), and a
  `Bewertung` row with the star rating in the icon cell and the numeric value
  (3.9). Keep the amber star colors. Value 1.7rem → 1.6rem.
- **Autos** — convert from stacked to the grid, per car (car name as a
  `.metric-sub` line when more than one): `SoC` (battery icon, %), `Reichweite`
  (plug icon, km); when charging, `Geladen um` (clock icon, time) and
  `Leistung` (flash icon, kW, green). Keep the existing battery-icon-by-percent
  and charging logic.
- **ÖV** — one row per connection: label = route/destination, value =
  `departureRelative` (e.g. "5 Min"), with the absolute `HH:MM Uhr` shown as a
  `.metric-sub` line under the value. Keep the existing time math.

## Tier 2 — keep layout, adopt the tokens

These are structurally different and stay in their bespoke layouts; only their
type sizes, label/unit colors, and title are aligned to the scale.

- **Weather** — keep the `.weather-container` flex strip and the large current
  weather icon + current temp (hero, stays big). Align: `°C` unit treatment,
  the daily forecast day label → `.metric-label`, min/max temps → consistent
  value sizing. Keep the horizontal forecast row.
- **Calendar** — keep the agenda card layout, colored event borders, and all-day
  pill. Align the day `.title`, event time, and event text to the scale and the
  muted color tokens. Light touch — no structural change.
- **Clock** — keep the 4rem time hero and seconds. Align only the date sub-text
  to the secondary color token. Light touch.

## Excluded

- **Presence** (avatars) and **Sonos** (album art) — no text metrics; nothing to
  unify. Left untouched.

## Out of scope

- No data, API, or behavior changes anywhere — presentation only.
- No layout/column changes; widgets keep their configured positions.

## Verification

For each widget, render it (live or mock) and confirm: consistent title size,
label-left rows where applicable, value at 1.6rem, units dimmed, icons colored
and aligned, heroes (clock/weather temp) still large. Compare the full right
column before/after against the brainstorm mockups.
