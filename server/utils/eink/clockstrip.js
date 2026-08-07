import { CLOCK } from './layout.js'

// Packs the rasterized glyph strip (buildClockStripSvg → packRgbaTo1Bit) into
// the /api/eink/clock.bin wire format consumed by eink-display/src/main.cpp:
//
//   16-byte header: 'E' 'K' <version> <reserved>, then u16-LE winX winY winW
//   winH digitW colonW — the firmware refuses the strip if the geometry does
//   not match its compiled constants, so a layout change can never smear
//   misplaced digits onto the panel.
//   Then ten digit cells (digitW/8 × winH bytes each, row-major, same 1bpp
//   MSB-first bit-1-is-white format as screen.bin) and the colon cell
//   (colonW/8 × winH bytes).
export const CLOCK_STRIP_VERSION = 1

export function packClockStrip(strip1bit) {
  const { digitW, colonW, win } = CLOCK
  const rowBytes = digitW / 8
  const digitBytes = rowBytes * win.h
  const colonRowBytes = colonW / 8
  if (strip1bit.length !== digitBytes * 11) {
    throw new Error(`clock strip: expected ${digitBytes * 11} bytes, got ${strip1bit.length}`)
  }

  const header = Buffer.alloc(16)
  header.write('EK', 0, 'ascii')
  header[2] = CLOCK_STRIP_VERSION
  header.writeUInt16LE(win.x, 4)
  header.writeUInt16LE(win.y, 6)
  header.writeUInt16LE(win.w, 8)
  header.writeUInt16LE(win.h, 10)
  header.writeUInt16LE(digitW, 12)
  header.writeUInt16LE(colonW, 14)

  const digits = strip1bit.subarray(0, digitBytes * 10)
  // the colon cell keeps only the leftmost colonW pixels of its digit-wide rows
  const colon = Buffer.alloc(colonRowBytes * win.h)
  for (let r = 0; r < win.h; r++) {
    const src = (10 * win.h + r) * rowBytes
    strip1bit.copy(colon, r * colonRowBytes, src, src + colonRowBytes)
  }
  return Buffer.concat([header, digits, colon])
}
