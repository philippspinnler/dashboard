import { renderEinkFrame } from '../../utils/eink/render.js'
import { pngFrom1Bit } from '../../utils/eink/png1bit.js'
import { EINK_WIDTH, EINK_HEIGHT } from '../../utils/eink/pack.js'

// Browser preview of the exact panel frame (same 1-bit data, PNG-wrapped).
export default defineEventHandler(async (event) => {
  const { frame } = await renderEinkFrame(event)
  setHeader(event, 'content-type', 'image/png')
  setHeader(event, 'cache-control', 'no-store')
  return pngFrom1Bit(frame, EINK_WIDTH, EINK_HEIGHT)
})
