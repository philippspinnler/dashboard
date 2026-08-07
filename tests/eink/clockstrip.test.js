import { describe, it, expect } from 'vitest'
import { buildClockStripSvg, CLOCK } from '../../server/utils/eink/layout.js'
import { packClockStrip, CLOCK_STRIP_VERSION } from '../../server/utils/eink/clockstrip.js'

const rowBytes = CLOCK.digitW / 8
const cellBytes = rowBytes * CLOCK.win.h

describe('buildClockStripSvg', () => {
  it('stacks the 11 glyphs at the on-screen baseline offset', () => {
    const svg = buildClockStripSvg()
    expect(svg).toMatch(new RegExp(`^<svg[^>]*width="${CLOCK.digitW}" height="${CLOCK.win.h * 11}"`))
    const base = CLOCK.baseline - CLOCK.win.y
    ;[...'0123456789:'].forEach((ch, i) => {
      expect(svg).toContain(`<text x="0" y="${i * CLOCK.win.h + base}" font-size="${CLOCK.fontSize}" font-weight="bold">${ch}</text>`)
    })
  })
})

describe('packClockStrip', () => {
  // synthetic strip: cell k's rows are filled with byte value k, so slicing
  // mistakes (wrong cell, wrong row stride) are immediately visible
  const strip = Buffer.alloc(cellBytes * 11)
  for (let k = 0; k < 11; k++) strip.fill(k, k * cellBytes, (k + 1) * cellBytes)

  it('writes the geometry header the firmware validates against', () => {
    const bin = packClockStrip(strip)
    expect(bin.length).toBe(16 + 10 * cellBytes + (CLOCK.colonW / 8) * CLOCK.win.h)
    expect(bin.toString('ascii', 0, 2)).toBe('EK')
    expect(bin[2]).toBe(CLOCK_STRIP_VERSION)
    expect(bin.readUInt16LE(4)).toBe(CLOCK.win.x)
    expect(bin.readUInt16LE(6)).toBe(CLOCK.win.y)
    expect(bin.readUInt16LE(8)).toBe(CLOCK.win.w)
    expect(bin.readUInt16LE(10)).toBe(CLOCK.win.h)
    expect(bin.readUInt16LE(12)).toBe(CLOCK.digitW)
    expect(bin.readUInt16LE(14)).toBe(CLOCK.colonW)
  })

  it('passes digit cells through and trims the colon cell to colonW', () => {
    const bin = packClockStrip(strip)
    for (let d = 0; d < 10; d++) {
      const cell = bin.subarray(16 + d * cellBytes, 16 + (d + 1) * cellBytes)
      expect(cell.every((b) => b === d)).toBe(true)
    }
    const colon = bin.subarray(16 + 10 * cellBytes)
    expect(colon.length).toBe((CLOCK.colonW / 8) * CLOCK.win.h)
    expect(colon.every((b) => b === 10)).toBe(true)
  })

  it('rejects a strip of the wrong size', () => {
    expect(() => packClockStrip(Buffer.alloc(10))).toThrow(/expected/)
  })
})
