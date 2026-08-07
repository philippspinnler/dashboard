import { renderEinkFrame } from '../../utils/eink/render.js'

// The raw panel frame: 800x480 / 8 = 48,000 bytes, 1 bit/pixel, MSB-first,
// bit 1 = white. The ESP8266 streams this straight into the display controller.
// renderEinkFrame applies a short (~15s) frame cache so the firmware's two
// intra-cycle fetches match; HTTP stays no-store so no proxy caches it longer.
export default defineEventHandler(async (event) => {
  const { frame, time } = await renderEinkFrame(event)
  setHeader(event, 'content-type', 'application/octet-stream')
  setHeader(event, 'cache-control', 'no-store')
  // the HH:mm baked into this frame — the firmware ticks its local clock
  // (redrawn between fetches without WiFi traffic) from this, no NTP needed
  setHeader(event, 'x-eink-time', time)
  return frame
})
