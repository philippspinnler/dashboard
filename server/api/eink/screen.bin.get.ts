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
