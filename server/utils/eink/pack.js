// Converts resvg's RGBA output into the e-paper frame format: 1 bit per pixel,
// MSB-first, row-major, bit 1 = white (GxEPD2 convention). The threshold sits
// above the midpoint so antialiased text edges lean black and glyphs stay crisp
// on the panel.
export const EINK_WIDTH = 800
export const EINK_HEIGHT = 480

const THRESHOLD = 160

export function packRgbaTo1Bit(rgba, width, height) {
  const rowBytes = Math.ceil(width / 8)
  const out = Buffer.alloc(rowBytes * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const lum = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]
      if (lum >= THRESHOLD) out[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7)
    }
  }
  return out
}
