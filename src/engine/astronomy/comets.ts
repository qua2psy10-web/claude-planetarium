import * as Astronomy from 'astronomy-engine'

export type Vec3 = [number, number, number]

export interface CometElements {
  name: string
  /** IAU designation, e.g. "C/2020 F3". */
  designation: string
  nameJa: string | null
  /** Julian dates. */
  epoch: number
  perihelion: number
  /** Perihelion distance in AU, eccentricity, and angles in degrees, for the J2000 ecliptic. */
  q: number
  e: number
  i: number
  node: number
  peri: number
  /** Magnitude parameters: m = H + 5 log10(distance to Earth) + K log10(distance to Sun). */
  H: number
  K: number
}

export interface CometState {
  /** Geocentric position, J2000 equatorial, AU. */
  geo: Vec3
  /** Unit vector pointing from the Sun to the comet (J2000 equatorial): the way the tail points. */
  away: Vec3
  /** Right ascension and declination of date (the same frame as the planets), radians. */
  ra: number
  dec: number
  earthDistance: number
  sunDistance: number
  magnitude: number
}

const DEG = Math.PI / 180
// Gaussian gravitational constant: with it the Sun's gravity is k^2 in AU^3 / day^2.
const K_GAUSS = 0.01720209895
const MU = K_GAUSS * K_GAUSS
const OBLIQUITY_J2000 = 23.4392911 * DEG
const UNIX_EPOCH_JD = 2440587.5

export const julianDate = (date: Date): number => date.getTime() / 86_400_000 + UNIX_EPOCH_JD

// ---------------------------------------------------------------------------------------------
// Kepler's problem for any conic

// Stumpff functions C2(z) = (1 - cos sqrt z) / z and C3(z) = (sqrt z - sin sqrt z) / z^1.5, and their
// continuations to z <= 0 (hyperbolas) and z near 0 (parabolas).
function stumpff(z: number): [number, number] {
  if (z > 1e-8) {
    const s = Math.sqrt(z)
    return [(1 - Math.cos(s)) / z, (s - Math.sin(s)) / (s * z)]
  }
  if (z < -1e-8) {
    const s = Math.sqrt(-z)
    return [(Math.cosh(s) - 1) / -z, (Math.sinh(s) - s) / (s * -z)]
  }
  return [0.5 - z / 24, 1 / 6 - z / 120]
}

/**
 * Position in the orbit's own plane, in AU, `dt` days after perihelion. The "universal variable"
 * form works the same for ellipses, parabolas and hyperbolas, so comets with eccentricity just
 * above or below 1 need no special case.
 */
export function perifocalPosition(q: number, e: number, dt: number): [number, number] {
  const alpha = (1 - e) / q // 1 / semi-major axis (negative for a hyperbola)
  const speed = Math.sqrt((MU * (1 + e)) / q) // speed at perihelion
  const sqrtMu = Math.sqrt(MU)

  // Along an ellipse the motion repeats: work with the shortest equivalent time.
  if (e < 1) {
    const period = (2 * Math.PI) / (K_GAUSS * Math.pow(alpha, 1.5))
    dt -= Math.round(dt / period) * period
  }

  // Solve  F(x) = e x^3 C3(alpha x^2) + q x - sqrt(mu) dt = 0.  F rises everywhere (F' is the
  // distance r > 0), so a bracket plus Newton steps cannot fail.
  const target = sqrtMu * dt
  const F = (x: number) => e * x ** 3 * stumpff(alpha * x * x)[1] + q * x - target
  const r = (x: number) => e * x * x * stumpff(alpha * x * x)[0] + q
  let lo = -1, hi = 1
  while (F(lo) > 0) lo *= 2
  while (F(hi) < 0) hi *= 2
  let x = Math.abs(target) < 1e-12 ? 0 : (lo + hi) / 2
  for (let n = 0; n < 100; n++) {
    const fx = F(x)
    if (Math.abs(fx) < 1e-13 * Math.max(1, Math.abs(target))) break
    if (fx > 0) hi = x
    else lo = x
    let next = x - fx / r(x)
    if (!(next > lo && next < hi)) next = (lo + hi) / 2 // Newton left the bracket: bisect instead
    x = next
  }

  const [c2, c3] = stumpff(alpha * x * x)
  const f = 1 - (x * x * c2) / q
  const g = dt - (x ** 3 * c3) / sqrtMu
  return [f * q, g * speed] // r = f r0 + g v0, with r0 = (q, 0) and v0 = (0, speed)
}

/** Heliocentric position in J2000 ecliptic coordinates, AU. */
export function heliocentricEcliptic(el: CometElements, date: Date): Vec3 {
  const [px, py] = perifocalPosition(el.q, el.e, julianDate(date) - el.perihelion)
  const O = el.node * DEG, w = el.peri * DEG, i = el.i * DEG
  const cO = Math.cos(O), sO = Math.sin(O), cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(i), si = Math.sin(i)
  return [
    (cO * cw - sO * sw * ci) * px + (-cO * sw - sO * cw * ci) * py,
    (sO * cw + cO * sw * ci) * px + (-sO * sw + cO * cw * ci) * py,
    sw * si * px + cw * si * py,
  ]
}

const eclipticToEquatorial = ([x, y, z]: Vec3): Vec3 => {
  const c = Math.cos(OBLIQUITY_J2000), s = Math.sin(OBLIQUITY_J2000)
  return [x, y * c - z * s, y * s + z * c]
}

// ---------------------------------------------------------------------------------------------
// Where a comet is, and how bright

/** The comet as seen from the Earth at `date`. */
export function cometState(el: CometElements, date: Date): CometState {
  const helio = eclipticToEquatorial(heliocentricEcliptic(el, date))
  const earth = Astronomy.HelioVector(Astronomy.Body.Earth, date) // J2000 equatorial
  const geo: Vec3 = [helio[0] - earth.x, helio[1] - earth.y, helio[2] - earth.z]
  const sunDistance = Math.hypot(...helio)
  const earthDistance = Math.hypot(...geo)

  // Right ascension and declination of date, like the planets (the J2000 frame is about 0.4 degrees off by now).
  const t = Astronomy.MakeTime(date)
  const ofDate = Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(t), new Astronomy.Vector(geo[0], geo[1], geo[2], t))
  const eq = Astronomy.EquatorFromVector(ofDate)

  return {
    geo,
    away: [helio[0] / sunDistance, helio[1] / sunDistance, helio[2] / sunDistance],
    ra: eq.ra * 15 * DEG, // hours -> degrees -> radians
    dec: eq.dec * DEG,
    earthDistance,
    sunDistance,
    magnitude: el.H + 5 * Math.log10(earthDistance) + el.K * Math.log10(sunDistance),
  }
}

/**
 * How long to draw the tail, in AU. Brighter comets have longer tails, and a comet far from the Sun
 * has hardly any. This is a rough look, not a measurement.
 */
export function tailLengthAU(magnitude: number, sunDistance: number): number {
  const length = 0.3 * Math.pow(10, 0.15 * (8 - magnitude)) * Math.min(1, 1.5 / sunDistance)
  return Math.max(0.02, Math.min(0.8, length))
}

/**
 * Points along the tail on the sky (right ascension and declination of date, radians), from the
 * head outwards. The ion tail points straight away from the Sun, so these are positions along that
 * line as seen from the Earth.
 */
export function tailSkyPoints(state: CometState, lengthAU: number, count: number, date: Date): { ra: number; dec: number }[] {
  const t = Astronomy.MakeTime(date)
  const rotation = Astronomy.Rotation_EQJ_EQD(t)
  const points: { ra: number; dec: number }[] = []
  for (let k = 1; k <= count; k++) {
    const s = (lengthAU * k) / count
    const v = new Astronomy.Vector(state.geo[0] + state.away[0] * s, state.geo[1] + state.away[1] * s, state.geo[2] + state.away[2] * s, t)
    const eq = Astronomy.EquatorFromVector(Astronomy.RotateVector(rotation, v))
    points.push({ ra: eq.ra * 15 * DEG, dec: eq.dec * DEG })
  }
  return points
}
