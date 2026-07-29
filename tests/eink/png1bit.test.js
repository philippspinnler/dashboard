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
