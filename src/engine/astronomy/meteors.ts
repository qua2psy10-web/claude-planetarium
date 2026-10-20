// Meteor shower data and the geometry of a meteor's path. No imports on purpose:
// everything here is plain math so it can be checked on its own.

export type Vec3 = [number, number, number]

export interface MeteorShower {
  id: string
  nameJa: string
  /** Date of the peak (month 1-12, day of month). */
  peakMonth: number
  peakDay: number
  /** How quickly activity falls off around the peak, in days (Gaussian sigma). */
  sigmaDays: number
  /** Zenithal hourly rate at the peak: roughly how strong the shower is. */
  zhr: number
  /** Radiant position (J2000), degrees. */
  raDeg: number
  decDeg: number
}

// Peak dates, radiants and rates follow the IMO working list of major showers.
export const METEOR_SHOWERS: MeteorShower[] = [
  { id: 'QUA', nameJa: 'しぶんぎ座流星群', peakMonth: 1, peakDay: 4, sigmaDays: 0.6, zhr: 110, raDeg: 230, decDeg: 49 },
  { id: 'LYR', nameJa: 'こと座流星群', peakMonth: 4, peakDay: 22, sigmaDays: 2, zhr: 18, raDeg: 271, decDeg: 34 },
  { id: 'ETA', nameJa: 'みずがめ座η流星群', peakMonth: 5, peakDay: 6, sigmaDays: 4, zhr: 50, raDeg: 338, decDeg: -1 },
  { id: 'PER', nameJa: 'ペルセウス座流星群', peakMonth: 8, peakDay: 12, sigmaDays: 3, zhr: 100, raDeg: 48, decDeg: 58 },
  { id: 'ORI', nameJa: 'オリオン座流星群', peakMonth: 10, peakDay: 21, sigmaDays: 4, zhr: 20, raDeg: 95, decDeg: 16 },
  { id: 'LEO', nameJa: 'しし座流星群', peakMonth: 11, peakDay: 17, sigmaDays: 1.5, zhr: 15, raDeg: 152, decDeg: 22 },
  { id: 'GEM', nameJa: 'ふたご座流星群', peakMonth: 12, peakDay: 14, sigmaDays: 2.5, zhr: 150, raDeg: 112, decDeg: 33 },
  { id: 'URS', nameJa: 'こぐま座流星群', peakMonth: 12, peakDay: 22, sigmaDays: 1.5, zhr: 10, raDeg: 217, decDeg: 76 },
]

/** Below this strength a shower is treated as not active. */
export const ACTIVE_THRESHOLD = 0.15

const DAY_MS = 86_400_000

/**
 * How active a shower is on a given date: 1 at the peak, falling off on either
 * side. A simple bell curve around the peak date, not a measured profile. The
 * peak is taken as the middle (12:00 UTC) of the peak day, so the whole day is
 * close to full strength.
 */
export function showerStrength(shower: MeteorShower, date: Date): number {
  const year = date.getUTCFullYear()
  let nearest = Infinity
  // The peak in the neighbouring years matters near New Year (e.g. Dec 22 vs Jan 4).
  for (let y = year - 1; y <= year + 1; y++) {
    const peak = Date.UTC(y, shower.peakMonth - 1, shower.peakDay, 12)
    nearest = Math.min(nearest, Math.abs(date.getTime() - peak) / DAY_MS)
  }
  return Math.exp(-0.5 * (nearest / shower.sigmaDays) ** 2)
}

export function activeShowers(date: Date): { shower: MeteorShower; strength: number }[] {
  return METEOR_SHOWERS
    .map((shower) => ({ shower, strength: showerStrength(shower, date) }))
    .filter((s) => s.strength >= ACTIVE_THRESHOLD)
    .sort((a, b) => b.strength - a.strength)
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** Angle between two unit vectors, radians. */
export function angleBetween(a: Vec3, b: Vec3): number {
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b))))
}

/**
 * The direction a meteor at `point` travels if it comes from `radiant`: along the
 * great circle that leaves the radiant, pointing away from it. Both are unit
 * vectors. Returns null when the point is (almost) on the radiant itself.
 */
export function tangentAwayFrom(radiant: Vec3, point: Vec3): Vec3 | null {
  const c = dot(radiant, point)
  const s = Math.sqrt(Math.max(0, 1 - c * c))
  if (s < 1e-6) return null
  // U is the unit vector at the point, perpendicular to the radiant, in the plane of both.
  const u: Vec3 = [
    (point[0] - c * radiant[0]) / s,
    (point[1] - c * radiant[1]) / s,
    (point[2] - c * radiant[2]) / s,
  ]
  // Derivative of (R cos t + U sin t) at the point's angle t, where cos t = c and sin t = s.
  return norm([
    u[0] * c - radiant[0] * s,
    u[1] * c - radiant[1] * s,
    u[2] * c - radiant[2] * s,
  ])
}

/** Move `angle` radians from `point` along the great circle heading `tangent`. */
export function moveAlong(point: Vec3, tangent: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [
    point[0] * c + tangent[0] * s,
    point[1] * c + tangent[1] * s,
    point[2] * c + tangent[2] * s,
  ]
}

/** A random unit vector perpendicular to `point`, for meteors that belong to no shower. */
export function randomTangent(point: Vec3, random: () => number = Math.random): Vec3 {
  // Cross the point with a random vector; retry on the (unlikely) near-parallel case.
  for (;;) {
    const r: Vec3 = [random() * 2 - 1, random() * 2 - 1, random() * 2 - 1]
    const t: Vec3 = [
      point[1] * r[2] - point[2] * r[1],
      point[2] * r[0] - point[0] * r[2],
      point[0] * r[1] - point[1] * r[0],
    ]
    if (Math.hypot(t[0], t[1], t[2]) > 1e-3) return norm(t)
  }
}
