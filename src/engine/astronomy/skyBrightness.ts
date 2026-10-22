export type Rgb = readonly [number, number, number]

interface SkyKey {
  /** Sun altitude, degrees. */
  sun: number
  /** Faintest star the naked eye can pick out against this sky. */
  limitMag: number
  zenith: Rgb
  horizon: Rgb
  /** Glow around the Sun's side of the horizon: colour and strength. */
  glow: Rgb
  glowAmt: number
  /** Elevation (sine of altitude) over which the horizon colour fades into the zenith colour. */
  band: number
}

// Night is the planetarium's original look (a thin blue haze at the horizon); the rest is a
// blend of day sky, sunset colours and the three twilights, by the Sun's altitude.
const KEYS: SkyKey[] = [
  { sun: -18, limitMag: 6.5, zenith: [0, 0, 0.02], horizon: [0.05, 0.08, 0.2], glow: [0, 0, 0], glowAmt: 0, band: 0.1 },
  { sun: -12, limitMag: 5.5, zenith: [0.01, 0.02, 0.08], horizon: [0.1, 0.12, 0.28], glow: [0.35, 0.25, 0.45], glowAmt: 0.15, band: 0.16 },
  { sun: -8, limitMag: 4.2, zenith: [0.02, 0.06, 0.18], horizon: [0.22, 0.2, 0.38], glow: [0.7, 0.35, 0.4], glowAmt: 0.4, band: 0.25 },
  { sun: -4, limitMag: 2.5, zenith: [0.06, 0.14, 0.36], horizon: [0.55, 0.4, 0.5], glow: [1, 0.5, 0.32], glowAmt: 0.65, band: 0.35 },
  { sun: 0, limitMag: -1, zenith: [0.1, 0.24, 0.52], horizon: [0.85, 0.66, 0.56], glow: [1, 0.62, 0.32], glowAmt: 0.75, band: 0.45 },
  { sun: 6, limitMag: -3, zenith: [0.14, 0.34, 0.7], horizon: [0.7, 0.77, 0.88], glow: [1, 0.85, 0.6], glowAmt: 0.3, band: 0.55 },
  { sun: 25, limitMag: -3.5, zenith: [0.12, 0.33, 0.72], horizon: [0.55, 0.72, 0.92], glow: [1, 0.95, 0.8], glowAmt: 0.15, band: 0.6 },
]

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerp3 = (a: Rgb, b: Rgb, t: number): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

function segment(sunAltDeg: number): { a: SkyKey; b: SkyKey; t: number } {
  const first = KEYS[0]
  const last = KEYS[KEYS.length - 1]
  if (sunAltDeg <= first.sun) return { a: first, b: first, t: 0 }
  if (sunAltDeg >= last.sun) return { a: last, b: last, t: 0 }
  let i = 0
  while (KEYS[i + 1].sun < sunAltDeg) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  return { a, b, t: (sunAltDeg - a.sun) / (b.sun - a.sun) }
}

/** Faintest star (magnitude) visible to the naked eye with the Sun at `sunAltDeg`. */
export function limitingMagnitude(sunAltDeg: number): number {
  const { a, b, t } = segment(sunAltDeg)
  return lerp(a.limitMag, b.limitMag, t)
}

export interface SkyColors {
  zenith: [number, number, number]
  horizon: [number, number, number]
  glow: [number, number, number]
  glowAmt: number
  band: number
}

/** Sky colours for the Sun at `sunAltDeg`. */
export function skyColors(sunAltDeg: number): SkyColors {
  const { a, b, t } = segment(sunAltDeg)
  return {
    zenith: lerp3(a.zenith, b.zenith, t),
    horizon: lerp3(a.horizon, b.horizon, t),
    glow: lerp3(a.glow, b.glow, t),
    glowAmt: lerp(a.glowAmt, b.glowAmt, t),
    band: lerp(a.band, b.band, t),
  }
}

/** Name of the twilight stage for the Sun at `sunAltDeg`. */
export function twilightName(sunAltDeg: number): string {
  if (sunAltDeg > 0) return '昼'
  if (sunAltDeg > -6) return '市民薄明'
  if (sunAltDeg > -12) return '航海薄明'
  if (sunAltDeg > -18) return '天文薄明'
  return '夜'
}
