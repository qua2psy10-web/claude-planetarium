#!/usr/bin/env node
/**
 * Regenerate the deep-sky data for the planetarium from d3-celestial (BSD-3, Olaf Frohn):
 *   public/data/milkyway.png   equirectangular Milky Way brightness map (RA/Dec, J2000)
 *   public/data/messier.json   the 110 Messier objects
 *
 *   npm pack d3-celestial@0.7.35 && tar xzf d3-celestial-0.7.35.tgz
 *   node scripts/build_milkyway.mjs package/data
 *
 * d3-celestial ships the Milky Way as five nested brightness contours (mw.json).
 * Each contour is filled (even-odd) into a W x H map where x is right ascension
 * (-180..180 degrees, the same longitude the data uses) and y is declination; the five
 * layers are summed, weighted and blurred so the shader can sample a smooth glow.
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/build_milkyway.mjs <d3-celestial data dir>')
  process.exit(1)
}
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')

const W = 2048
const H = 1024
const BLUR_DEG = 1.5
// Brightness after summing contours 0..5; the outer contours are faint, the core bright.
const LEVEL = [0, 0.14, 0.32, 0.56, 0.8, 1]

const mw = JSON.parse(fs.readFileSync(path.join(src, 'mw.json'), 'utf8'))
const sum = new Uint8Array(W * H)

/**
 * Close the ring across the +-180 seam: shift x by +-360 whenever consecutive points jump
 * more than half the map, so the path is continuous. The two outermost contours wind once
 * around the whole sky (they are the northern and southern edges of the band) and end up
 * spanning 360 degrees of longitude; everything else is a small closed loop.
 */
function unwrap(ring) {
  const out = [[ring[0][0], ring[0][1]]]
  let shift = 0
  for (let i = 1; i < ring.length; i++) {
    const dx = ring[i][0] - ring[i - 1][0]
    if (dx > 180) shift -= 360
    else if (dx < -180) shift += 360
    out.push([ring[i][0] + shift, ring[i][1]])
  }
  return out
}

for (const feature of mw.features) {
  const paths = feature.geometry.coordinates.flat().map(unwrap)
  // Fill column by column (constant right ascension): the winding contours cross each column
  // exactly once, so even-odd parity along declination is well defined there, starting from
  // the (empty) north pole. Rows would be ambiguous on a closed circle of longitude.
  const layer = new Uint8Array(W * H)
  for (let col = 0; col < W; col++) {
    const lon = -180 + ((col + 0.5) / W) * 360
    const ys = []
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i++) {
        const [x1, y1] = path[i]
        const [x2, y2] = path[i + 1]
        // The path may sit one turn away from this column; test every periodic copy.
        for (const t of [-360, 0, 360]) {
          if ((x1 + t <= lon) === (x2 + t <= lon)) continue
          ys.push(y1 + ((lon - (x1 + t)) / (x2 - x1)) * (y2 - y1))
        }
      }
    }
    ys.sort((a, b) => b - a) // north to south
    for (let k = 0; k + 1 < ys.length; k += 2) {
      const a = Math.max(0, Math.round(((90 - ys[k]) / 180) * H))
      const b = Math.min(H, Math.round(((90 - ys[k + 1]) / 180) * H))
      for (let row = a; row < b; row++) layer[row * W + col] = 1
    }
  }
  for (let i = 0; i < layer.length; i++) sum[i] += layer[i]
}

const img = new Float32Array(W * H)
for (let i = 0; i < img.length; i++) img[i] = LEVEL[Math.min(5, sum[i])]

// Separable Gaussian blur. Wraps in RA; the poles are left to clamp.
function blur(data, sigmaX, sigmaY) {
  const kernel = (s) => {
    const r = Math.ceil(s * 3)
    const k = new Float32Array(2 * r + 1)
    let t = 0
    for (let i = -r; i <= r; i++) t += k[i + r] = Math.exp((-i * i) / (2 * s * s))
    for (let i = 0; i < k.length; i++) k[i] /= t
    return { k, r }
  }
  const tmp = new Float32Array(data.length)
  const kx = kernel(sigmaX)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 0
      for (let i = -kx.r; i <= kx.r; i++) v += kx.k[i + kx.r] * data[y * W + ((x + i + W) % W)]
      tmp[y * W + x] = v
    }
  }
  const out = new Float32Array(data.length)
  const ky = kernel(sigmaY)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 0
      for (let i = -ky.r; i <= ky.r; i++) v += ky.k[i + ky.r] * tmp[Math.min(H - 1, Math.max(0, y + i)) * W + x]
      out[y * W + x] = v
    }
  }
  return out
}
const sigmaPx = (BLUR_DEG / 360) * W
const blurred = blur(img, sigmaPx, sigmaPx)

const gray = new Uint8Array(W * H)
for (let i = 0; i < gray.length; i++) gray[i] = Math.round(Math.min(1, blurred[i]) * 255)

function crc32(buf) {
  let c, crc = ~0
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return ~crc >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 0 // grayscale
const raw = Buffer.alloc((W + 1) * H)
for (let y = 0; y < H; y++) {
  raw[y * (W + 1)] = 0
  Buffer.from(gray.buffer, y * W, W).copy(raw, y * (W + 1) + 1)
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])
fs.writeFileSync(path.join(outDir, 'milkyway.png'), png)
console.log(`milkyway.png ${W}x${H}, ${(png.length / 1024).toFixed(0)} KB`)

// Messier objects: [ra deg 0..360, dec deg] J2000 plus the catalogue fields.
const messier = JSON.parse(fs.readFileSync(path.join(src, 'messier.json'), 'utf8'))
const objects = messier.features.map((f) => {
  const p = f.properties
  const [lon, lat] = f.geometry.coordinates
  const [major, minor] = String(p.dim).split('x').map(Number)
  return {
    id: p.name,
    ngc: p.desig,
    nameEn: p.alt || null,
    type: p.type,
    mag: p.mag,
    ra: +(((lon % 360) + 360) % 360).toFixed(4),
    dec: +lat.toFixed(4),
    size: major || 0, // arc minutes (major axis)
    sizeMinor: minor || major || 0,
  }
})
fs.writeFileSync(path.join(outDir, 'messier.json'), JSON.stringify(objects))
console.log(`messier.json ${objects.length} objects`)
