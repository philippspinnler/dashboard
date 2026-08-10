# Weekly EO-Guide Sub Change + E-ink Emoji Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the 7-day net subscriber change in the EO-Guide dashboard widget, and render calendar emojis as monochrome glyphs on the e-ink panel.

**Architecture:** Task group 1 extends the existing Appfigures pipeline (pure helper in `lib/subscriptions.js` → `server/api/eo-guide.get.ts` → `WidgetEoGuide.vue` metric row). Task group 2 bundles the monochrome Noto Emoji font into the resvg render path (`server/assets/fonts/` → `loadFonts()` in `render.js` → `font-family` in `layout.js`).

**Tech Stack:** Nuxt 3 / Nitro, vitest, @resvg/resvg-js, Appfigures REST API v2, dayjs (`~/lib/datetime`).

## Global Constraints

- Response field is `subscriptions.weeklyChange` (integer, may be negative) — spec name, used verbatim in handler, mock, and widget.
- Widget row label is exactly `7 Tage`; value formats as `+3` / `−1` (U+2212 minus) / `±0`.
- E-ink font stack is exactly `DejaVu Sans, Noto Emoji`; fonts must be passed to resvg as file paths, never buffers (linux-musl quirk, see comment in `render.js`).
- Cache TTL of `eo-guide.get.ts` stays 21 600 s.
- README must be updated when widget features change (repo convention).
- Do not push; local commits only.

---

### Task 1: `sumNetChange` helper

**Files:**
- Modify: `lib/subscriptions.js`
- Test: `tests/subscriptions.test.js` (new)

**Interfaces:**
- Consumes: existing `isPhantom(row)` module-private filter in `lib/subscriptions.js`.
- Produces: `export function sumNetChange(subs, ids): number` — `subs` is the Appfigures product-keyed report object, `ids` an array of product-id strings; returns Σ(`activations` − `cancellations`) over non-phantom rows.

- [ ] **Step 1: Write the failing tests**

Create `tests/subscriptions.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { sumNetChange } from '../lib/subscriptions.js'

describe('sumNetChange', () => {
  it('sums activations minus cancellations across the given products', () => {
    const subs = {
      a: { activations: 5, cancellations: 2, mrr: 10, gross_revenue: 100 },
      b: { activations: 1, cancellations: 3, mrr: 4, gross_revenue: 40 },
    }
    expect(sumNetChange(subs, ['a', 'b'])).toBe(1)
  })

  it('can be negative', () => {
    const subs = { a: { activations: 0, cancellations: 4, mrr: 10, gross_revenue: 100 } }
    expect(sumNetChange(subs, ['a'])).toBe(-4)
  })

  it('skips phantom rows (active subs but zero lifetime revenue)', () => {
    const subs = {
      real: { activations: 2, cancellations: 0, mrr: 10, gross_revenue: 100 },
      phantom: { activations: 9, cancellations: 0, active_subscriptions: 9, mrr: 0, gross_revenue: 0 },
    }
    expect(sumNetChange(subs, ['real', 'phantom'])).toBe(2)
  })

  it('ignores unknown ids and missing fields', () => {
    const subs = { a: { mrr: 10, gross_revenue: 100 } }
    expect(sumNetChange(subs, ['a', 'nope'])).toBe(0)
    expect(sumNetChange(undefined, ['a'])).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/subscriptions.test.js`
Expected: FAIL — `sumNetChange` is not exported.

- [ ] **Step 3: Implement `sumNetChange`**

Append to `lib/subscriptions.js`:

```js
// Net subscriber change over the report's date range: activations minus
// cancellations, with the same phantom-row filter as the active count.
export function sumNetChange(subs, ids) {
  let total = 0
  for (const id of ids) {
    const row = subs?.[id]
    if (!row || isPhantom(row)) continue
    total += Number(row.activations || 0) - Number(row.cancellations || 0)
  }
  return total
}
```

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/subscriptions.js tests/subscriptions.test.js
git commit -m "Add sumNetChange helper for 7-day subscriber delta"
```

---

### Task 2: API handler + mock return `weeklyChange`

**Files:**
- Modify: `server/api/eo-guide.get.ts`
- Modify: `server/mocks/eoGuide.js`

**Interfaces:**
- Consumes: `sumNetChange(subs, ids)` from Task 1; existing `classifyProducts`, `sumActiveSubscriptions`.
- Produces: API response shape `{ subscriptions: { yearly, monthly, weeklyChange }, overall_rating }` — Task 3's widget reads `subscriptions.weeklyChange`.

- [ ] **Step 1: Probe the live Appfigures API to confirm field names**

Credentials are in `.env` (`NUXT_EOGUIDE_*`). Run a read-only probe for a
product-grouped, date-ranged subscriptions report (last 7 days):

```bash
set -a; source .env; set +a
curl -s -u "$NUXT_EOGUIDE_USERNAME:$NUXT_EOGUIDE_PASSWORD" \
  "https://api.appfigures.com/v2/reports/subscriptions/?client_key=$NUXT_EOGUIDE_CLIENT_KEY&group_by=product&start_date=$(date -v-7d +%F)&end_date=$(date +%F)" | head -c 2000
```

(Adjust env var names to what `.env` actually uses.) Confirm each product row
contains `activations` and `cancellations`. If Appfigures uses different
names, update `sumNetChange` and its tests (Task 1) to the real names before
continuing.

- [ ] **Step 2: Extend the handler**

In `server/api/eo-guide.get.ts`:

- Change the lib import to also pull `sumNetChange`.
- Add `import dayjs from '~/lib/datetime'`.
- Inside the `if (allIds.length)` block, add a second, date-ranged fetch and
  compute the net change:

```ts
let weeklyChange = 0
// ...inside if (allIds.length):
const tz = config.timezone || 'UTC'
const end = dayjs().tz(tz)
const weekSubs = await $fetch<any>('https://api.appfigures.com/v2/reports/subscriptions/', {
  query: {
    client_key: clientKey,
    group_by: 'product',
    products: allIds.join(','),
    start_date: end.subtract(7, 'day').format('YYYY-MM-DD'),
    end_date: end.format('YYYY-MM-DD'),
  },
  headers,
})
weeklyChange = sumNetChange(weekSubs, allIds)
```

Fetch it in parallel with the existing unranged call (`Promise.all`), and
return `subscriptions: { yearly, monthly, weeklyChange }`. Update the
handler's top comment to mention the 7-day window.

- [ ] **Step 3: Update the mock**

In `server/mocks/eoGuide.js` add `weeklyChange: 3` inside `subscriptions`.

- [ ] **Step 4: Verify against the live API and mock**

Run: `npx vitest run` — expected PASS.
Then hit the real handler once in dev (real mode) and confirm
`subscriptions.weeklyChange` is a plausible integer:

```bash
rm -rf .nuxt/cache/nitro/handlers   # Nitro dev serves stale cached responses otherwise
npm run dev &  # then:
curl -s localhost:3000/api/eo-guide
```

- [ ] **Step 5: Commit**

```bash
git add server/api/eo-guide.get.ts server/mocks/eoGuide.js
git commit -m "EO-Guide API: report 7-day net subscriber change"
```

---

### Task 3: Widget row „7 Tage"

**Files:**
- Modify: `components/widgets/WidgetEoGuide.vue`

**Interfaces:**
- Consumes: `data.value.subscriptions.weeklyChange` from Task 2 (via existing `useWidgetData('/api/eo-guide', …)`).
- Produces: user-visible metric row; no downstream consumers.

- [ ] **Step 1: Add the row and formatting**

In the template, after the „Monatlich" row and before the stars row:

```html
<span class="metric-label">7 Tage</span>
<span class="metric-icon"></span>
<span class="metric-value">{{ weeklyChangeLabel }}</span>
```

In the script, after the `monthly` computed:

```js
const weeklyChangeLabel = computed(() => {
  const n = data.value?.subscriptions?.weeklyChange ?? 0
  if (n > 0) return `+${n}`
  if (n < 0) return `−${-n}` // U+2212 minus, matches typographic style
  return '±0'
})
```

- [ ] **Step 2: Eyeball in mock mode**

Use the project `/verify` recipe (mock mode) to load the dashboard and check
the EO-Guide widget shows `7 Tage  +3` aligned with the other rows.

- [ ] **Step 3: Commit**

```bash
git add components/widgets/WidgetEoGuide.vue
git commit -m "EO-Guide widget: show 7-day net subscriber change"
```

---

### Task 4: Bundle Noto Emoji for the e-ink renderer

**Files:**
- Create: `server/assets/fonts/NotoEmoji-Regular.ttf` (downloaded)
- Create: `server/assets/fonts/NotoEmoji-LICENSE` (OFL text)
- Modify: `server/utils/eink/render.js` (loadFonts)
- Modify: `server/utils/eink/layout.js:222` (font-family)
- Modify: `server/mocks/calendar.js` (emoji test event)
- Test: `tests/eink/layout.test.js` (font-stack assertion)

**Interfaces:**
- Consumes: nothing from other tasks (independent of Tasks 1–3).
- Produces: e-ink frames whose emoji render as monochrome glyphs; font stack `DejaVu Sans, Noto Emoji`.

- [ ] **Step 1: Download the font + license**

```bash
curl -fL -o server/assets/fonts/NotoEmoji-Regular.ttf \
  https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoEmoji-Regular.ttf
curl -fL -o server/assets/fonts/NotoEmoji-LICENSE \
  https://raw.githubusercontent.com/google/fonts/main/ofl/notoemoji/OFL.txt
```

Sanity-check: `file server/assets/fonts/NotoEmoji-Regular.ttf` reports a
TrueType font, size roughly 0.4–1.5 MB. If the first URL 404s, fall back to
the static TTF inside Google Fonts' Noto Emoji download; do not use the
color font (`NotoColorEmoji`), resvg cannot rasterize it.

- [ ] **Step 2: Write the failing font-stack test**

In `tests/eink/layout.test.js`, add alongside the existing top-level tests:

```js
it('declares the emoji fallback font in the root font stack', () => {
  const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days: [], inverter })
  expect(svg).toContain('font-family="DejaVu Sans, Noto Emoji"')
})
```

Run: `npx vitest run tests/eink/layout.test.js` — expected FAIL.

- [ ] **Step 3: Wire the font into the render path**

`server/utils/eink/layout.js` line 222: change
`font-family="DejaVu Sans"` → `font-family="DejaVu Sans, Noto Emoji"`.

`server/utils/eink/render.js` `loadFonts()`: extend to three fonts —

```js
fontsPromise ||= Promise.all([
  useStorage('assets:server').getItemRaw('fonts/DejaVuSans.ttf'),
  useStorage('assets:server').getItemRaw('fonts/DejaVuSans-Bold.ttf'),
  useStorage('assets:server').getItemRaw('fonts/NotoEmoji-Regular.ttf'),
])
  .then(async ([sans, sansBold, emoji]) => {
    const dir = await mkdtemp(join(tmpdir(), 'eink-fonts-'))
    const paths = [
      join(dir, 'DejaVuSans.ttf'),
      join(dir, 'DejaVuSans-Bold.ttf'),
      join(dir, 'NotoEmoji-Regular.ttf'),
    ]
    await writeFile(paths[0], Buffer.from(sans))
    await writeFile(paths[1], Buffer.from(sansBold))
    await writeFile(paths[2], Buffer.from(emoji))
    return paths
  })
```

(keep the existing `.catch` reset).

- [ ] **Step 4: Add an emoji event to the calendar mock**

In `server/mocks/calendar.js`, change the first event's summary to
`'🎉 Team Meeting'` (keeps day/count structure identical for other tests).

- [ ] **Step 5: Run tests, then eyeball the rendered frame**

Run: `npx vitest run` — expected PASS.
Then in mock mode fetch `/api/eink/screen.png` (via the `/verify` recipe) and
confirm the 🎉 renders as a monochrome glyph, not tofu/blank, and normal text
still renders in DejaVu.

- [ ] **Step 6: Commit**

```bash
git add server/assets/fonts/NotoEmoji-Regular.ttf server/assets/fonts/NotoEmoji-LICENSE \
  server/utils/eink/render.js server/utils/eink/layout.js server/mocks/calendar.js \
  tests/eink/layout.test.js
git commit -m "E-ink: render emoji via bundled monochrome Noto Emoji font"
```

---

### Task 5: README + final verification screenshots

**Files:**
- Modify: `README.md` (eo-guide widget description ~line 366 and feature table ~line 70; e-ink section gains an emoji-support note)

**Interfaces:**
- Consumes: everything above.
- Produces: docs; screenshots for the user (dashboard widget + e-ink PNG, both mock mode).

- [ ] **Step 1: Update README**

- eo-guide widget details section: mention the 7-day net subscriber change row.
- e-ink section: note that emoji in calendar entries render as monochrome
  Noto Emoji glyphs. Generic placeholders only, per repo convention.

- [ ] **Step 2: Full-suite + visual verification**

Run: `npx vitest run` — expected all PASS.
Via `/verify` in mock mode capture and save screenshots of (a) the EO-Guide
widget with the `7 Tage +3` row, (b) the e-ink `screen.png` with the emoji
event. Show both to the user.

- [ ] **Step 3: Commit (do not push)**

```bash
git add README.md
git commit -m "README: document 7-day sub change row and e-ink emoji support"
```
