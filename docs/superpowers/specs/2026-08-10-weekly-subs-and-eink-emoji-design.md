# Weekly EO-Guide subscriber change + e-ink emoji rendering — Design

Date: 2026-08-10
Status: approved

Two independent, small features:

1. Show the net subscriber change over the last 7 days in the EO-Guide widget on the main dashboard.
2. Render calendar-entry emojis correctly on the e-ink companion display.

## 1. EO-Guide: 7-day net subscriber change

### Decision

Use the Appfigures date-ranged subscriptions report (chosen over local daily
snapshots, which would need persistent storage across Watchtower redeploys and
a week of warm-up). Net change = activations − cancellations over the last
7 days, summed across the same non-phantom yearly/monthly products the widget
already tracks. Dashboard only — the e-ink panel is not changed.

### Server (`server/api/eo-guide.get.ts`)

- Alongside the existing calls, fetch `/v2/reports/subscriptions/` with
  `group_by=product`, the same `products` list, and `start_date`/`end_date`
  covering the last 7 days (end = today).
- A new pure helper in `lib/subscriptions.js` — `sumNetChange(subs, ids)` —
  sums `activations − cancellations` per product, reusing the existing
  phantom-row filter.
- Response gains `subscriptions.weeklyChange: { yearly, monthly }` (integers,
  may be negative).
- Cache TTL stays 21 600 s.

### Widget (`components/widgets/WidgetEoGuide.vue`)

- (Revised after first review): no separate row. Each plan's 7-day net change
  renders as a small muted suffix (`.metric-unit`) directly behind the
  Jährlich / Monatlich counts — e.g. `26 +2`, `5 −1` (U+2212). A ±0 change
  renders nothing, keeping the row quiet.

### Ancillary

- `server/mocks/eoGuide.js`: add `weeklyChange` to the mock payload.
- README: feature list/config tables updated per repo convention.

## 2. E-ink: emoji in calendar entries

### Decision

Bundle the monochrome **Noto Emoji** outline font (~0.9 MB, OFL) so resvg can
rasterize emoji as black-and-white glyphs (chosen over stripping emoji, per
user preference).

### Changes

- `server/assets/fonts/NotoEmoji-Regular.ttf` added; OFL license text added
  alongside the existing font LICENSE.
- `server/utils/eink/render.js` `loadFonts()`: load and write the third font
  file to the temp dir, pass its path to resvg (paths, not buffers — the
  linux-musl quirk applies unchanged).
- `server/utils/eink/layout.js`: root `font-family` becomes
  `"DejaVu Sans, Noto Emoji"`. resvg/usvg falls back per-glyph, so ordinary
  text stays DejaVu.

### Known limitations

- Multi-codepoint ZWJ sequences (e.g. 👨‍👩‍👧) may decompose into individual
  glyphs. Acceptable for a status panel.
- Emoji newer than the bundled font remain tofu. Acceptable.

## Testing & verification

- Unit tests for `sumNetChange` (mixed products, phantom rows, negative net).
- Existing e-ink layout tests must keep passing.
- Manual verification in mock mode via the project's verify recipe: emoji
  event added to the calendar mock, eyeballed on `/api/eink/screen.png`;
  widget row checked on the dashboard.
