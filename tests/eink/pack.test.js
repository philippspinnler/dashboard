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
