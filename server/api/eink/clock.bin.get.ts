import { renderClockStrip } from '../../utils/eink/render.js'

// Clock glyph strip ('0'…'9' + ':') rendered with the exact screen font and
// 1-bit threshold. The firmware fetches this once at boot and then composes
// HH:MM locally between server frames — see server/utils/eink/clockstrip.js
// for the wire format.
export default defineEventHandler(async (event) => {
  const strip = await renderClockStrip()
  setHeader(event, 'content-type', 'application/octet-stream')
  // pure font geometry — only changes with a (rare) layout/font change
  setHeader(event, 'cache-control', 'public, max-age=86400')
  return strip
})
