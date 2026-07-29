# E-ink Dashboard Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the dashboard's clock, calendar, and inverter data as a server-rendered 1-bit 800×480 bitmap that an ESP8266 streams onto a Waveshare 7.5" V2 e-paper panel every minute.

**Architecture:** A new renderer in `server/utils/eink/` composes an SVG from the existing `/api/calendar` and `/api/inverter` handlers, rasterizes it with `@resvg/resvg-js`, and thresholds to a packed 1-bit frame exposed at `/api/eink/screen.bin` (plus a `/api/eink/screen.png` preview). A PlatformIO firmware in `eink-display/` downloads the frame in row bands (the ESP8266 can't hold 48 KB) and writes it to the panel via GxEPD2.

**Tech Stack:** Nuxt 3 / Nitro (existing app), `@resvg/resvg-js`, vitest (new devDependency), PlatformIO + Arduino + GxEPD2 for the ESP8266.

**Spec:** `docs/superpowers/specs/2026-07-29-eink-display-design.md`

## Global Constraints

- Frame format: exactly 48,000 bytes = 800×480 px, 1 bit/pixel, MSB-first within each byte, row-major, 100 bytes/row, **bit 1 = white** (GxEPD2 convention).
- Panel: Waveshare 7.5" V2 B/W 800×480 (GxEPD2 class `GxEPD2_750_T7`).
- Driver board pins (fixed by hardware): CS=GPIO15, DC=GPIO4, RST=GPIO2, BUSY=GPIO5, SCK=GPIO14, MOSI=GPIO13.
- No new `NUXT_*` env vars.
- Code style: no semicolons, single quotes, 2-space indent (match existing files). Server utils are plain `.js`, API routes `.ts`.
- New API handlers must return a valid frame even when calendar/inverter data is unavailable.
- Docker base is `node:22-alpine` (musl) — `@resvg/resvg-js` ships musl prebuilds and `npm install` (already used in the Dockerfile) fetches platform-specific optional deps; no Dockerfile change needed.
- UI copy is German (matches the main dashboard): "Keine Termine", "Keine Daten", "Heute/Morgen" come pre-localized from the calendar API.

---

### Task 1: Vitest setup + 1-bit packing module

The repo has no test framework. Add vitest, then TDD the pixel-packing function that turns resvg's RGBA output into the panel frame.

**Files:**
- Modify: `package.json` (add `vitest` devDependency + `test` script)
- Create: `server/utils/eink/pack.js`
- Test: `tests/eink/pack.test.js`

**Interfaces:**
- Produces: `packRgbaTo1Bit(rgba: Buffer|Uint8Array, width: number, height: number): Buffer` — RGBA in, packed 1-bit out (bit 1 = white, luminance threshold 160). Also exports constants `EINK_WIDTH = 800`, `EINK_HEIGHT = 480`.

- [ ] **Step 1: Install vitest and add test script**

```bash
cd /Users/philipp/Workspace/private/dashboard
npm install --save-dev vitest
```

Then in `package.json` add to `scripts`:

```json
"test": "vitest run"
```

- [ ] **Step 2: Write the failing test**

Create `tests/eink/pack.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { packRgbaTo1Bit, EINK_WIDTH, EINK_HEIGHT } from '../../server/utils/eink/pack.js'

// Build an RGBA buffer from an array of 0|1 (1 = white pixel)
function rgbaOf(pixels) {
  const buf = Buffer.alloc(pixels.length * 4)
  pixels.forEach((p, i) => {
    const v = p ? 255 : 0
    buf[i * 4] = v
    buf[i * 4 + 1] = v
    buf[i * 4 + 2] = v
    buf[i * 4 + 3] = 255
  })
  return buf
}

describe('packRgbaTo1Bit', () => {
  it('packs MSB-first with bit 1 = white', () => {
    const row1 = [1, 1, 1, 1, 1, 1, 1, 1]
    const row2 = [0, 0, 0, 0, 0, 0, 0, 1]
    const out = packRgbaTo1Bit(rgbaOf([...row1, ...row2]), 8, 2)
    expect(out.length).toBe(2)
    expect(out[0]).toBe(0xff)
    expect(out[1]).toBe(0x01)
  })

  it('thresholds mid grays: dark gray -> black, light gray -> white', () => {
    const buf = Buffer.from([100, 100, 100, 255, 200, 200, 200, 255])
    const out = packRgbaTo1Bit(buf, 2, 1)
    expect(out[0]).toBe(0x40) // only second pixel white -> 0b01000000
  })

  it('produces exactly 48000 bytes for a full frame', () => {
    const out = packRgbaTo1Bit(Buffer.alloc(EINK_WIDTH * EINK_HEIGHT * 4), EINK_WIDTH, EINK_HEIGHT)
    expect(out.length).toBe(48000)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/eink/pack.test.js`
Expected: FAIL — cannot resolve `server/utils/eink/pack.js`

- [ ] **Step 4: Write the implementation**

Create `server/utils/eink/pack.js`:

```js
// Converts resvg's RGBA output into the e-paper frame format: 1 bit per pixel,
// MSB-first, row-major, bit 1 = white (GxEPD2 convention). The threshold sits
// above the midpoint so antialiased text edges lean black and glyphs stay crisp
// on the panel.
export const EINK_WIDTH = 800
export const EINK_HEIGHT = 480

const THRESHOLD = 160

export function packRgbaTo1Bit(rgba, width, height) {
  const rowBytes = Math.ceil(width / 8)
  const out = Buffer.alloc(rowBytes * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const lum = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]
      if (lum >= THRESHOLD) out[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7)
    }
  }
  return out
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/eink/pack.test.js`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tests/eink/pack.test.js server/utils/eink/pack.js
git commit -m "Add vitest and 1-bit frame packing for the e-ink renderer"
```

---

### Task 2: Minimal 1-bit PNG encoder (browser preview)

A tiny hand-rolled PNG encoder so the preview endpoint shows *exactly* what the panel shows (same packed bits), without adding an image library. PNG bit-depth-1 grayscale scanlines are byte-identical to our packed rows.

**Files:**
- Create: `server/utils/eink/png1bit.js`
- Test: `tests/eink/png1bit.test.js`

**Interfaces:**
- Consumes: packed frames from `packRgbaTo1Bit` (Task 1).
- Produces: `pngFrom1Bit(packed: Buffer, width: number, height: number): Buffer` — a valid PNG (grayscale, bit depth 1, no interlace).

- [ ] **Step 1: Write the failing test**

Create `tests/eink/png1bit.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { inflateSync } from 'node:zlib'
import { pngFrom1Bit } from '../../server/utils/eink/png1bit.js'

describe('pngFrom1Bit', () => {
  const packed = Buffer.from([0xff, 0x01]) // 8x2: white row, then black row ending white
  const png = pngFrom1Bit(packed, 8, 2)

  it('starts with the PNG signature', () => {
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  })

  it('declares 8x2, bit depth 1, grayscale in IHDR', () => {
    // IHDR data starts at offset 16 (8 sig + 4 len + 4 type)
    expect(png.readUInt32BE(16)).toBe(8) // width
    expect(png.readUInt32BE(20)).toBe(2) // height
    expect(png[24]).toBe(1) // bit depth
    expect(png[25]).toBe(0) // color type grayscale
  })

  it('IDAT inflates to filter-byte-prefixed packed rows', () => {
    // IDAT chunk follows IHDR: 8 sig + (4+4+13+4) IHDR = offset 33
    const idatLen = png.readUInt32BE(33)
    const idat = png.subarray(41, 41 + idatLen)
    const raw = inflateSync(idat)
    expect(raw).toEqual(Buffer.from([0x00, 0xff, 0x00, 0x01]))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/eink/png1bit.test.js`
Expected: FAIL — cannot resolve `server/utils/eink/png1bit.js`

- [ ] **Step 3: Write the implementation**

Create `server/utils/eink/png1bit.js`:

```js
import { deflateSync } from 'node:zlib'

// Minimal PNG encoder for bit-depth-1 grayscale. PNG's 1-bit rows are packed
// MSB-first with 1 = white — exactly our panel frame format — so the preview is
// bit-identical to what the display shows. Avoids pulling in an image library.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

export function pngFrom1Bit(packed, width, height) {
  const rowBytes = Math.ceil(width / 8)
  const ihdr = Buffer.alloc(13) // compression/filter/interlace stay 0
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 1 // bit depth
  ihdr[9] = 0 // color type: grayscale

  // scanlines: filter byte 0 + raw packed row
  const raw = Buffer.alloc((rowBytes + 1) * height)
  for (let y = 0; y < height; y++) {
    packed.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/eink/png1bit.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/eink/png1bit.test.js server/utils/eink/png1bit.js
git commit -m "Add minimal 1-bit PNG encoder for e-ink preview"
```

---

### Task 3: SVG screen layout builder

Pure function: dashboard data in, 800×480 SVG string out. No Nitro/network dependencies so it unit-tests cleanly.

**Files:**
- Create: `server/utils/eink/layout.js`
- Test: `tests/eink/layout.test.js`

**Interfaces:**
- Consumes: calendar API shape `[{ day, date, events: [{ summary, start_time, all_day, name }] }]`, inverter API shape `{ pv_power, power_consumption, grid_consumption, grid_feedin, battery_state_of_charge, battery_power }` (values may be numeric strings).
- Produces: `buildScreenSvg({ time, date, days, inverter }): string` — `days` and `inverter` may be `null` (data unavailable). Font family used: `DejaVu Sans`.

- [ ] **Step 1: Write the failing test**

Create `tests/eink/layout.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildScreenSvg } from '../../server/utils/eink/layout.js'

const inverter = {
  pv_power: '1789.5',
  power_consumption: 202.8,
  grid_consumption: 0,
  grid_feedin: 60.2,
  battery_state_of_charge: '49.1',
  battery_power: 418.5,
}

const days = [
  {
    day: 'Heute',
    date: '29. Juli',
    events: [
      { summary: 'Team Meeting', start_time: '09:00', all_day: false, name: 'Work' },
      { summary: 'Zoo & Aquarium <Besuch>', start_time: '00:00', all_day: true, name: 'Family' },
    ],
  },
]

describe('buildScreenSvg', () => {
  it('renders clock, date, events and inverter values', () => {
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch, 29. Juli', days, inverter })
    expect(svg).toContain('12:34')
    expect(svg).toContain('Team Meeting')
    expect(svg).toContain('1,79 kW')
    expect(svg).toContain('Einspeisung')
    expect(svg).toContain('49 %')
    expect(svg).toMatch(/^<svg[^>]*width="800" height="480"/)
  })

  it('escapes XML special characters in event summaries', () => {
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days, inverter })
    expect(svg).toContain('Zoo &amp; Aquarium &lt;Besuch&gt;')
    expect(svg).not.toContain('<Besuch>')
  })

  it('renders fallbacks when data is unavailable', () => {
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days: null, inverter: null })
    expect(svg).toContain('Keine Termine')
    expect(svg).toContain('Keine Daten')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/eink/layout.test.js`
Expected: FAIL — cannot resolve `server/utils/eink/layout.js`

- [ ] **Step 3: Write the implementation**

Create `server/utils/eink/layout.js`:

```js
// Composes the 800x480 e-ink screen as an SVG string. Pure — data in, SVG out —
// so the layout is unit-testable without a server. Black/white only: the
// rasterized result gets thresholded to 1 bit, so no grays, no colors.

const W = 800
const H = 480

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))
}

function truncate(s, max) {
  s = String(s)
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function formatWatts(w) {
  const abs = Math.abs(Number(w) || 0)
  if (abs >= 1000) return (abs / 1000).toFixed(2).replace('.', ',') + ' kW'
  return Math.round(abs) + ' W'
}

function gridLine(inv) {
  const cons = Number(inv.grid_consumption) || 0
  const feed = Number(inv.grid_feedin) || 0
  if (cons > 10) return 'Bezug ' + formatWatts(cons)
  if (feed > 10) return 'Einspeisung ' + formatWatts(feed)
  return '0 W'
}

function batteryLine(inv) {
  const soc = Math.round(Number(inv.battery_state_of_charge) || 0)
  const p = Number(inv.battery_power) || 0
  if (p > 25) return soc + ' % · lädt'
  if (p < -25) return soc + ' % · entlädt'
  return soc + ' %'
}

function eventLine(e) {
  const prefix = e.all_day ? '·  ' : e.start_time + '  '
  return prefix + truncate(e.summary, 34)
}

export function buildScreenSvg({ time, date, days, inverter }) {
  const parts = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="DejaVu Sans">`)
  parts.push(`<rect width="${W}" height="${H}" fill="white"/>`)

  // header: big clock left, date right
  parts.push(`<text x="24" y="92" font-size="88" font-weight="bold">${escapeXml(time)}</text>`)
  parts.push(`<text x="${W - 24}" y="88" font-size="30" text-anchor="end">${escapeXml(date)}</text>`)
  parts.push(`<line x1="24" y1="118" x2="${W - 24}" y2="118" stroke="black" stroke-width="3"/>`)

  // left column: calendar
  let y = 168
  if (!days || days.length === 0) {
    parts.push(`<text x="24" y="${y}" font-size="24">Keine Termine</text>`)
  } else {
    outer: for (const day of days) {
      if (y > H - 60) break
      parts.push(`<text x="24" y="${y}" font-size="24" font-weight="bold">${escapeXml(day.day + ' · ' + day.date)}</text>`)
      y += 36
      for (const e of day.events) {
        if (y > H - 30) break outer
        parts.push(`<text x="36" y="${y}" font-size="22">${escapeXml(eventLine(e))}</text>`)
        y += 32
      }
      y += 18
    }
  }

  // column divider
  parts.push(`<line x1="520" y1="140" x2="520" y2="${H - 24}" stroke="black" stroke-width="1"/>`)

  // right column: inverter
  const rx = 548
  parts.push(`<text x="${rx}" y="168" font-size="24" font-weight="bold">Energie</text>`)
  if (!inverter) {
    parts.push(`<text x="${rx}" y="204" font-size="22">Keine Daten</text>`)
  } else {
    const rows = [
      ['Produktion', formatWatts(inverter.pv_power)],
      ['Verbrauch', formatWatts(inverter.power_consumption)],
      ['Netz', gridLine(inverter)],
      ['Batterie', batteryLine(inverter)],
    ]
    let ry = 210
    for (const [label, value] of rows) {
      parts.push(`<text x="${rx}" y="${ry}" font-size="18">${escapeXml(label)}</text>`)
      parts.push(`<text x="${rx}" y="${ry + 34}" font-size="30" font-weight="bold">${escapeXml(value)}</text>`)
      ry += 72
    }
    const soc = Math.max(0, Math.min(100, Number(inverter.battery_state_of_charge) || 0))
    parts.push(`<rect x="${rx}" y="${ry - 10}" width="200" height="18" fill="white" stroke="black" stroke-width="2"/>`)
    parts.push(`<rect x="${rx + 2}" y="${ry - 8}" width="${(196 * soc) / 100}" height="14" fill="black"/>`)
  }

  // footer: last-updated stamp
  parts.push(`<text x="${W - 24}" y="${H - 16}" font-size="16" text-anchor="end">Stand ${escapeXml(time)}</text>`)
  parts.push('</svg>')
  return parts.join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/eink/layout.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS (9 tests across 3 files)

- [ ] **Step 6: Commit**

```bash
git add tests/eink/layout.test.js server/utils/eink/layout.js
git commit -m "Add SVG layout builder for the e-ink screen"
```

---

### Task 4: Renderer + API endpoints (fonts, resvg, screen.bin, screen.png)

Wire the pure pieces together: fetch data via the existing handlers, rasterize the SVG with bundled DejaVu fonts, expose `screen.bin` and `screen.png`. Verified end-to-end against the dev server in mock mode.

**Files:**
- Create: `server/assets/fonts/DejaVuSans.ttf`, `server/assets/fonts/DejaVuSans-Bold.ttf`, `server/assets/fonts/LICENSE` (downloaded)
- Create: `server/utils/eink/render.js`
- Create: `server/api/eink/screen.bin.get.ts`
- Create: `server/api/eink/screen.png.get.ts`
- Modify: `package.json` (add `@resvg/resvg-js` dependency)

**Interfaces:**
- Consumes: `buildScreenSvg` (Task 3), `packRgbaTo1Bit` (Task 1), `pngFrom1Bit` (Task 2), existing `/api/calendar` and `/api/inverter` routes, `~/lib/datetime` dayjs with `de-ch` locale, `useRuntimeConfig(event).timezone`.
- Produces: `renderEinkFrame(event): Promise<Buffer>` (48,000-byte packed frame); GET `/api/eink/screen.bin` (`application/octet-stream`, 48,000 bytes); GET `/api/eink/screen.png` (`image/png`).

- [ ] **Step 1: Install resvg and download the fonts**

```bash
cd /Users/philipp/Workspace/private/dashboard
npm install @resvg/resvg-js
mkdir -p server/assets/fonts
cd "$(mktemp -d)"
curl -sLO https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.zip
unzip -o dejavu-fonts-ttf-2.37.zip
cp dejavu-fonts-ttf-2.37/ttf/DejaVuSans.ttf dejavu-fonts-ttf-2.37/ttf/DejaVuSans-Bold.ttf dejavu-fonts-ttf-2.37/LICENSE /Users/philipp/Workspace/private/dashboard/server/assets/fonts/
```

Verify: `ls -la /Users/philipp/Workspace/private/dashboard/server/assets/fonts/` shows both TTFs (~700 KB each) and the LICENSE.

- [ ] **Step 2: Write the renderer**

Create `server/utils/eink/render.js`:

```js
import { Resvg } from '@resvg/resvg-js'
import dayjs from '~/lib/datetime'
import { buildScreenSvg } from './layout.js'
import { packRgbaTo1Bit } from './pack.js'

// Renders the full e-ink frame: data via the existing (cached) API handlers,
// SVG layout, resvg rasterization with bundled fonts (deterministic in Docker —
// no system fonts), then 1-bit packing for the panel.

let fontsPromise
function loadFonts() {
  fontsPromise ||= Promise.all([
    useStorage('assets:server').getItemRaw('fonts/DejaVuSans.ttf'),
    useStorage('assets:server').getItemRaw('fonts/DejaVuSans-Bold.ttf'),
  ])
  return fontsPromise
}

export async function renderEinkFrame(event) {
  const config = useRuntimeConfig(event)
  const timezone = config.timezone || 'UTC'
  const now = dayjs().tz(timezone)

  // a failed source renders as "Keine …" in the layout; the frame always builds
  const [days, inverter] = await Promise.all([
    event.$fetch('/api/calendar').catch(() => null),
    event.$fetch('/api/inverter').catch(() => null),
  ])

  const svg = buildScreenSvg({
    time: now.format('HH:mm'),
    date: now.format('dddd, D. MMMM'),
    days,
    inverter,
  })

  const [sans, sansBold] = await loadFonts()
  const resvg = new Resvg(svg, {
    background: '#ffffff',
    font: {
      fontBuffers: [Buffer.from(sans), Buffer.from(sansBold)],
      loadSystemFonts: false,
      defaultFontFamily: 'DejaVu Sans',
    },
  })
  const img = resvg.render()
  return packRgbaTo1Bit(img.pixels, img.width, img.height)
}
```

- [ ] **Step 3: Write the two endpoints**

Create `server/api/eink/screen.bin.get.ts`:

```ts
import { renderEinkFrame } from '../../utils/eink/render.js'

// The raw panel frame: 800x480 / 8 = 48,000 bytes, 1 bit/pixel, MSB-first,
// bit 1 = white. The ESP8266 streams this straight into the display controller.
// No response caching — the clock changes every minute; the underlying data
// handlers keep their own TTL caches.
export default defineEventHandler(async (event) => {
  const frame = await renderEinkFrame(event)
  setHeader(event, 'Content-Type', 'application/octet-stream')
  setHeader(event, 'Cache-Control', 'no-store')
  return frame
})
```

Create `server/api/eink/screen.png.get.ts`:

```ts
import { renderEinkFrame } from '../../utils/eink/render.js'
import { pngFrom1Bit } from '../../utils/eink/png1bit.js'
import { EINK_WIDTH, EINK_HEIGHT } from '../../utils/eink/pack.js'

// Browser preview of the exact panel frame (same 1-bit data, PNG-wrapped).
export default defineEventHandler(async (event) => {
  const frame = await renderEinkFrame(event)
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'no-store')
  return pngFrom1Bit(frame, EINK_WIDTH, EINK_HEIGHT)
})
```

- [ ] **Step 4: Verify end-to-end in mock mode**

Start the dev server (background) and probe both endpoints:

```bash
cd /Users/philipp/Workspace/private/dashboard
rm -rf .nuxt/cache/nitro/handlers   # avoid stale dev cache (see memory: nitro-dev-cache)
NUXT_PUBLIC_USE_MOCK_DATA=true npm run dev
# in another shell once it's up:
curl -s http://localhost:3000/api/eink/screen.bin | wc -c
curl -s http://localhost:3000/api/eink/screen.png -o <scratchpad>/eink-preview.png
```

Expected: `wc -c` prints `48000`. Open/Read `eink-preview.png` and confirm: big clock top-left, date top-right, mock calendar events on the left, Energie column (Produktion/Verbrauch/Netz/Batterie + SOC bar) on the right, umlauts render correctly. Stop the dev server afterwards.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS (all tests still green)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json server/assets/fonts server/utils/eink/render.js server/api/eink
git commit -m "Add e-ink screen renderer and screen.bin/screen.png endpoints"
```

---

### Task 5: ESP8266 firmware (PlatformIO project in `eink-display/`)

Streams `screen.bin` to the panel in 2,000-byte row bands — the ESP8266 cannot hold the 48 KB frame in heap. GxEPD2's low-level `epd2.writeImage` writes bands directly into the controller RAM; after a refresh, the same frame is streamed again via `writeImageAgain` to keep the controller's "previous frame" RAM in sync for differential (non-flashing) updates. Partial refresh every cycle, full refresh every `FULL_REFRESH_EVERY` cycles to clear ghosting.

**Files:**
- Create: `eink-display/platformio.ini`
- Create: `eink-display/src/main.cpp`
- Create: `eink-display/src/config.example.h`
- Create: `eink-display/.gitignore`

**Interfaces:**
- Consumes: GET `${SERVER_BASE_URL}/api/eink/screen.bin` — exactly 48,000 bytes, row-major, 100 bytes/row, bit 1 = white (Task 4).
- Produces: a flashable firmware; `config.h` (git-ignored, copied from `config.example.h`) holds WiFi credentials + server URL.

- [ ] **Step 1: Create the project files**

Create `eink-display/platformio.ini`:

```ini
; Waveshare e-Paper ESP8266 Driver Board (onboard ESP-12F) + 7.5" V2 panel
[env:waveshare-esp8266]
platform = espressif8266
board = esp12e
framework = arduino
monitor_speed = 115200
upload_speed = 921600
lib_deps =
    zinggjm/GxEPD2@^1.6.0
    adafruit/Adafruit GFX Library@^1.11.9
    adafruit/Adafruit BusIO@^1.16.1
```

Create `eink-display/.gitignore`:

```
.pio/
src/config.h
```

Create `eink-display/src/config.example.h`:

```cpp
// Copy to config.h and fill in. config.h is git-ignored.
#pragma once

#define WIFI_SSID "your-ssid"
#define WIFI_PASSWORD "your-password"

// Dashboard server base URL, no trailing slash
#define SERVER_BASE_URL "http://192.168.1.10:3000"

// Seconds between display updates
#define REFRESH_INTERVAL_S 60

// Every Nth update does a full (flashing) refresh to clear ghosting
#define FULL_REFRESH_EVERY 30
```

Create `eink-display/src/main.cpp`:

```cpp
// E-ink dashboard client for the Waveshare e-Paper ESP8266 Driver Board with a
// 7.5" V2 (800x480 B/W) panel. All layout happens server-side: this firmware
// downloads /api/eink/screen.bin (48,000 bytes, 1bpp, bit 1 = white) and
// streams it to the panel in row bands — the ESP8266 cannot hold a full frame.
//
// Refresh strategy: a differential (non-flashing) refresh each cycle needs the
// controller's "previous frame" RAM to match, so after each refresh the frame
// is streamed a second time via writeImageAgain. Every FULL_REFRESH_EVERY
// cycles a full refresh clears ghosting.
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <GxEPD2_BW.h>
#include <Fonts/FreeMonoBold9pt7b.h>
#include "config.h"

// Pin mapping is fixed by the driver board
static const uint8_t PIN_CS = 15;
static const uint8_t PIN_DC = 4;
static const uint8_t PIN_RST = 2;
static const uint8_t PIN_BUSY = 5;

static const uint16_t SCREEN_W = 800;
static const uint16_t SCREEN_H = 480;
static const uint16_t ROW_BYTES = SCREEN_W / 8;                       // 100
static const uint16_t BAND_ROWS = 20;                                 // 2000-byte bands
static const uint32_t FRAME_BYTES = (uint32_t)ROW_BYTES * SCREEN_H;   // 48000

// Small paged buffer (HEIGHT/8 = 6000 bytes) — only used for the offline marker
GxEPD2_BW<GxEPD2_750_T7, GxEPD2_750_T7::HEIGHT / 8> display(GxEPD2_750_T7(PIN_CS, PIN_DC, PIN_RST, PIN_BUSY));

static uint8_t band[ROW_BYTES * BAND_ROWS];
static uint32_t cycle = 0;
static uint32_t failures = 0;
static unsigned long lastAttempt = 0;
static bool offlineMarkerShown = false;

// Downloads the frame and writes it into the controller RAM band by band.
// `again` selects the controller's previous-frame RAM (for differential mode).
static bool streamFrame(bool again) {
  WiFiClient client;
  HTTPClient http;
  http.setTimeout(15000);
  if (!http.begin(client, String(SERVER_BASE_URL) + "/api/eink/screen.bin")) return false;
  int code = http.GET();
  if (code != HTTP_CODE_OK || http.getSize() != (int)FRAME_BYTES) {
    Serial.printf("GET failed: code=%d size=%d\n", code, http.getSize());
    http.end();
    return false;
  }
  WiFiClient *stream = http.getStreamPtr();
  for (uint16_t y = 0; y < SCREEN_H; y += BAND_ROWS) {
    const size_t need = (size_t)ROW_BYTES * BAND_ROWS;
    size_t got = 0;
    const unsigned long start = millis();
    while (got < need && millis() - start < 10000) {
      if (stream->available()) {
        got += stream->readBytes(band + got, need - got);
      } else {
        delay(1);
      }
      yield();
    }
    if (got < need) {
      Serial.printf("short read at row %u: %u/%u\n", y, (unsigned)got, (unsigned)need);
      http.end();
      return false;
    }
    if (again) {
      display.epd2.writeImageAgain(band, 0, y, SCREEN_W, BAND_ROWS);
    } else {
      display.epd2.writeImage(band, 0, y, SCREEN_W, BAND_ROWS);
    }
  }
  http.end();
  return true;
}

static void drawOfflineMarker() {
  display.setPartialWindow(SCREEN_W - 160, 0, 160, 40);
  display.setFont(&FreeMonoBold9pt7b);
  display.setTextColor(GxEPD_BLACK);
  display.firstPage();
  do {
    display.fillRect(SCREEN_W - 160, 0, 160, 40, GxEPD_WHITE);
    display.drawRect(SCREEN_W - 158, 2, 156, 36, GxEPD_BLACK);
    display.setCursor(SCREEN_W - 145, 26);
    display.print("offline");
  } while (display.nextPage());
  display.powerOff();
}

static void onFailure() {
  failures++;
  Serial.printf("update failed (%u consecutive)\n", failures);
  if (failures >= 10 && !offlineMarkerShown) {
    drawOfflineMarker();
    offlineMarkerShown = true;
  }
}

static void updateDisplay() {
  const bool full = (cycle % FULL_REFRESH_EVERY == 0) || offlineMarkerShown;
  if (!streamFrame(false)) {
    onFailure();
    return;
  }
  display.epd2.refresh(!full); // refresh(true) = differential/non-flashing
  // Sync the previous-frame RAM so the next differential refresh has a
  // correct base. A minute-boundary change between the two fetches shows as a
  // tiny artifact that the next full refresh clears.
  if (!streamFrame(true)) {
    onFailure();
    return;
  }
  display.epd2.powerOff();
  failures = 0;
  offlineMarkerShown = false;
  cycle++;
  Serial.printf("frame %u drawn (%s refresh)\n", cycle, full ? "full" : "partial");
}

void setup() {
  Serial.begin(115200);
  Serial.println("\ne-ink dashboard starting");
  display.init(115200);

  WiFi.mode(WIFI_STA);
  WiFi.hostname("eink-dashboard");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nconnected, IP %s\n", WiFi.localIP().toString().c_str());

  updateDisplay();
  lastAttempt = millis();
}

void loop() {
  if (millis() - lastAttempt >= (unsigned long)REFRESH_INTERVAL_S * 1000UL) {
    lastAttempt = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi down, reconnecting");
      WiFi.reconnect();
      onFailure();
      return;
    }
    updateDisplay();
  }
  delay(100);
}
```

- [ ] **Step 2: Create a local config and build**

```bash
cp /Users/philipp/Workspace/private/dashboard/eink-display/src/config.example.h /Users/philipp/Workspace/private/dashboard/eink-display/src/config.h
cd /Users/philipp/Workspace/private/dashboard/eink-display
pio run
```

If `pio` is missing, install the CLI first: `brew install platformio`.
Expected: `SUCCESS` — firmware compiles, RAM usage well under 80 KB (the 6 KB page buffer + 2 KB band buffer are the only big allocations).

- [ ] **Step 3: Fix any compile errors against the pinned GxEPD2 version**

If `writeImageAgain` signatures differ in the resolved GxEPD2 release, check the installed header:
`.pio/libdeps/waveshare-esp8266/GxEPD2/src/GxEPD2_EPD.h` — both `writeImage(const uint8_t bitmap[], int16_t x, int16_t y, int16_t w, int16_t h, ...)` and `writeImageAgain(...)` exist on the epd2 base class. Adjust call sites only if the build says so.

- [ ] **Step 4: Commit**

```bash
git add eink-display
git commit -m "Add ESP8266 e-ink firmware that streams server-rendered frames"
```

---

### Task 6: Documentation

**Files:**
- Modify: `README.md` (features/TOC + new section)
- Create: `eink-display/README.md`

**Interfaces:**
- Consumes: everything above; documents endpoints, hardware, flash procedure.

- [ ] **Step 1: Write `eink-display/README.md`**

Content must cover, with generic placeholders only (per repo policy):

```markdown
# 🪶 E-ink display companion

An ESP8266 + Waveshare 7.5" e-Paper panel showing a black-and-white
subset of the dashboard (clock, calendar, inverter). The screen is
rendered **server-side** by the main app; the firmware just downloads
`/api/eink/screen.bin` (800×480, 1 bit/pixel) every minute and streams
it to the panel.

## Hardware

- Waveshare **e-Paper ESP8266 Driver Board** (onboard ESP-12F, 24-pin FPC connector)
- Waveshare **7.5" e-Paper V2** panel, black/white, 800×480 (flex marking FPC-C001)

Connect the panel's flex cable to the driver board's connector (lift the
black latch, insert contacts-down, close the latch). No wiring — the pin
mapping is fixed by the board (CS 15, DC 4, RST 2, BUSY 5).

## Endpoints (served by the main app)

| Endpoint | Purpose |
| --- | --- |
| `/api/eink/screen.bin` | Raw 48,000-byte 1-bit frame for the ESP |
| `/api/eink/screen.png` | Same frame as PNG — open in a browser to preview |

## Flashing

1. Install [PlatformIO](https://platformio.org) (`brew install platformio` or the VS Code extension).
2. `cp src/config.example.h src/config.h` and fill in WiFi credentials and the dashboard server URL.
3. Connect the board via micro-USB. macOS may need the CH340/CP210x USB-serial driver for older board revisions.
4. Build and flash: `pio run -t upload` (auto-detects the serial port; use `--upload-port /dev/cu.usbserial-XXXX` if you have several).
5. Watch it boot: `pio device monitor` — you should see WiFi connect, then `frame 1 drawn (full refresh)`.

## Behavior

- Refreshes every 60 s with a non-flashing (differential) update; every
  30th refresh is a full flashing one to clear ghosting.
- If the server is unreachable, the last frame stays on screen; after 10
  consecutive failures a small "offline" badge appears top-right.
- Layout changes are server-side only (`server/utils/eink/layout.js`) —
  no reflashing needed.

## Troubleshooting

- **Inverted image (black background):** panel/firmware bit convention
  mismatch — pass `true` for the `invert` parameter in the
  `writeImage`/`writeImageAgain` calls in `src/main.cpp`.
- **Blank screen, BUSY timeout in the serial log:** flex cable not seated
  or latch open.
- **`screen.png` looks right but the panel shows garbage:** confirm
  `curl -s $SERVER/api/eink/screen.bin | wc -c` prints 48000.
```

- [ ] **Step 2: Update the main `README.md`**

- Add `🪶 E-ink companion` to the Features section (one line, linking to `eink-display/README.md`).
- Add TOC entry.
- Add the two `/api/eink/*` endpoints wherever endpoints are listed (check the Project structure / API sections and follow their format).

- [ ] **Step 3: Commit**

```bash
git add README.md eink-display/README.md
git commit -m "Document the e-ink display companion"
```

---

## Verification checklist (whole feature)

- `npm test` — all vitest suites pass.
- Mock-mode dev server: `screen.bin` is exactly 48,000 bytes; `screen.png` visually correct (clock, calendar, Energie column, umlauts).
- `pio run` compiles the firmware.
- On hardware (user-assisted): panel shows the frame, minute updates are non-flashing, full refresh every 30 min, unplugging the server for >10 min produces the offline badge.
