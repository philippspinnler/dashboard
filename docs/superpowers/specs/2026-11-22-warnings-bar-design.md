# Warnings bar instead of corner overlay

## Why

The warnings card floated in the bottom-left corner and covered the weather
forecast underneath. Goal: show warnings without covering anything, and without
reserving space while there are none.

## Approaches

- **A — block above the weather, one row per warning.** Covers nothing, but grows
  with the number of warnings and eats calendar space.
- **B — one-line bar above the bottom zone (chosen).** Constant height regardless
  of count; overflow collapses into "+N weitere". The layout shifts by one line
  only.
- **C — warnings as a regular widget** placeable in any zone. Fits the widget
  system, but shares the column width with the calendar.
- Rejected: keep it floating, just higher — then it covers the calendar instead.

## Design

- `WarningsOverlay.vue` renders in the page flow between `.container-content` and
  `.container-bottom` (flex item, no fixed positioning). No warnings → not
  rendered → zero height.
- Chips in one line: icon, room/device, value, optional note. The list wraps but
  only the first line is visible; wrapped chips are counted and shown as a
  trailing "+N weitere" chip (two-pass measure, re-run on data change and once
  the webfont has loaded).
- `NUXT_PUBLIC_WARNINGS_OVERLAY_POSITION` is removed: the bar has one place.
  `NUXT_PUBLIC_WARNINGS_OVERLAY_ENABLED` stays.
- Sonos overlay unchanged (it only covers the later forecast days; accepted).
- The calendar has a fixed row budget and does not adapt to height; the bar takes
  ~3 rem from the content area, which is normally free space.

## Revision, same day

After seeing the bar live: stack the warnings one per line instead (no "+N
weitere"; more warnings simply take more of the calendar), and move the Sonos
card up as well so it stops covering the forecast.

- Each content column is now `.zone-widgets` (its widgets, clipped) plus a status
  slot pinned to the column bottom: warnings on the left, Sonos on the right.
  Both are in the flow; an empty slot has no height.
- Warnings only take room from the left column, Sonos only from the right.
- The calendar measures against `.zone-widgets` and drops whole events.
- `NUXT_PUBLIC_SONOS_OVERLAY_POSITION` and the shared corner styles are removed.
