import { deflateSync } from 'node:zlib'

// Minimal PNG encoder for bit-depth-1 grayscale. PNG's 1-bit rows are packed
// MSB-first with 1 = white — exactly our panel frame format — so the preview is
// bit-identical to what the display shows. Avoids pulling in an image library.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

export function pngFrom1Bit(packed, width, height) {
  const rowBytes = Math.ceil(width / 8)
  const ihdr = Buffer.alloc(13) // compression/filter/interlace stay 0
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 1 // bit depth
  ihdr[9] = 0 // color type: grayscale

  // scanlines: filter byte 0 + raw packed row
  const raw = Buffer.alloc((rowBytes + 1) * height)
  for (let y = 0; y < height; y++) {
    packed.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
