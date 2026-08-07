import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import dayjs from '~/lib/datetime'
import { buildScreenSvg, buildClockStripSvg } from './layout.js'
import { packClockStrip } from './clockstrip.js'
import { packRgbaTo1Bit } from './pack.js'

// Renders the full e-ink frame: data via the existing (cached) API handlers,
// SVG layout, resvg rasterization with bundled fonts (deterministic in Docker —
// no system fonts), then 1-bit packing for the panel.
//
// Error handling is intentional: data-source failures (calendar, inverter) are
// caught below and render as fallback sections, so the frame always builds.
// Genuine render failures (missing font asset, resvg error) intentionally
// propagate as an HTTP error instead of being swallowed — the display firmware
// keeps showing the last frame on any non-200 response, so a loud failure here
// is safer than silently serving a blank/broken frame.

// The bundled font assets are written to a temp dir once and passed to resvg
// by PATH, not as buffers: resvg-js 2.6.2's linux-musl binding silently
// ignores fontBuffers (text renders blank on Alpine/Docker), while fontFiles
// works on every platform — verified via a CI probe on node:22-alpine.
let fontsPromise
function loadFonts() {
  fontsPromise ||= Promise.all([
    useStorage('assets:server').getItemRaw('fonts/DejaVuSans.ttf'),
    useStorage('assets:server').getItemRaw('fonts/DejaVuSans-Bold.ttf'),
  ])
    .then(async ([sans, sansBold]) => {
      const dir = await mkdtemp(join(tmpdir(), 'eink-fonts-'))
      const paths = [join(dir, 'DejaVuSans.ttf'), join(dir, 'DejaVuSans-Bold.ttf')]
      await writeFile(paths[0], Buffer.from(sans))
      await writeFile(paths[1], Buffer.from(sansBold))
      return paths
    })
    .catch((err) => {
      fontsPromise = undefined
      throw err
    })
  return fontsPromise
}

// Short frame cache. The firmware fetches the frame twice per refresh cycle
// (once to draw, once via writeImageAgain to sync the controller's previous-frame
// RAM); caching makes those two fetches byte-identical — removing the ghosting
// that a minute-rollover between them would otherwise cause — and halves the
// render work. The clock is at most FRAME_TTL_MS stale, invisible at a 60s panel
// refresh. Bypassed in mock mode so dev previews always reflect live edits.
const FRAME_TTL_MS = 15000
let cachedFrame = null
let cachedAt = 0

// Returns { frame, time } — time is the HH:mm the frame was rendered with, so
// screen.bin can hand it to the firmware (x-eink-time) for local clock ticks.
export async function renderEinkFrame(event) {
  const mock = isMockEnabled(event)
  if (!mock && cachedFrame && Date.now() - cachedAt < FRAME_TTL_MS) {
    return cachedFrame
  }

  const config = useRuntimeConfig(event)
  const timezone = config.timezone || 'UTC'
  const now = dayjs().tz(timezone)

  // a failed source renders as "Keine …"/"—" in the layout; the frame always builds
  const [days, inverter, presence, speedtest, warnings, heizung, netatmo, weather] = await Promise.all([
    event.$fetch('/api/calendar').catch(() => null),
    event.$fetch('/api/inverter').catch(() => null),
    event.$fetch('/api/presence').catch(() => null),
    event.$fetch('/api/speedtest').catch(() => null),
    event.$fetch('/api/warnings').catch(() => null),
    event.$fetch('/api/heizung').catch(() => null),
    event.$fetch('/api/netatmo').catch(() => null),
    event.$fetch('/api/weather').catch(() => null),
  ])

  const svg = buildScreenSvg({
    time: now.format('HH:mm'),
    date: now.format('dddd, D. MMMM'),
    days,
    inverter,
    presence,
    speedtest,
    warnings,
    heizung,
    netatmo,
    weather,
  })

  const fontFiles = await loadFonts()
  const resvg = new Resvg(svg, {
    background: '#ffffff',
    font: {
      fontFiles,
      loadSystemFonts: false,
      defaultFontFamily: 'DejaVu Sans',
    },
  })
  const img = resvg.render()
  const result = {
    frame: packRgbaTo1Bit(img.pixels, img.width, img.height),
    time: now.format('HH:mm'),
  }
  if (!mock) {
    cachedFrame = result
    cachedAt = Date.now()
  }
  return result
}

// The clock glyph strip is pure font geometry — render it once per process.
let clockStripPromise
export function renderClockStrip() {
  clockStripPromise ||= loadFonts()
    .then((fontFiles) => {
      const resvg = new Resvg(buildClockStripSvg(), {
        background: '#ffffff',
        font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' },
      })
      const img = resvg.render()
      return packClockStrip(packRgbaTo1Bit(img.pixels, img.width, img.height))
    })
    .catch((err) => {
      clockStripPromise = undefined
      throw err
    })
  return clockStripPromise
}
