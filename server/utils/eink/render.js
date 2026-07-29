import { Resvg } from '@resvg/resvg-js'
import dayjs from '~/lib/datetime'
import { buildScreenSvg } from './layout.js'
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

let fontsPromise
function loadFonts() {
  fontsPromise ||= Promise.all([
    useStorage('assets:server').getItemRaw('fonts/DejaVuSans.ttf'),
    useStorage('assets:server').getItemRaw('fonts/DejaVuSans-Bold.ttf'),
  ])
    .then(([sans, sansBold]) => [Buffer.from(sans), Buffer.from(sansBold)])
    .catch((err) => {
      fontsPromise = undefined
      throw err
    })
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
      fontBuffers: [sans, sansBold],
      loadSystemFonts: false,
      defaultFontFamily: 'DejaVu Sans',
    },
  })
  const img = resvg.render()
  return packRgbaTo1Bit(img.pixels, img.width, img.height)
}
