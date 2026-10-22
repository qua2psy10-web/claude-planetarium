import * as Astronomy from 'astronomy-engine'
import {
  degreesToRadians,
  ecfToEci,
  ecfToLookAngles,
  eciToEcf,
  geodeticToEcf,
  gstime,
  propagate,
  radiansToDegrees,
  sunPos,
  jday,
  twoline2satrec,
  type SatRec,
} from 'satellite.js'

const AU_KM = 149597870.7
const SUN_RADIUS_KM = 696000
const EARTH_RADIUS_KM = 6378.137
const DAY_MS = 86_400_000

/** A satellite's two-line element set. */
export interface Tle {
  name: string
  line1: string
  line2: string
  /** Epoch of the elements. */
  epoch: Date
}

export interface Observer {
  latDeg: number
  lonDeg: number
}

export interface SatState {
  /** Degrees above the horizon (geometric, no refraction) and from north through east. */
  altitude: number
  azimuth: number
  /** Distance from the observer. */
  rangeKm: number
  /** Height above the ellipsoid and speed relative to the inertial frame. */
  heightKm: number
  speedKmS: number
  /** Fraction of the Sun's disc visible from the satellite: 0 in Earth's shadow, 1 in full sunlight. */
  sunlit: number
  /** Apparent magnitude (null in shadow). */
  magnitude: number | null
}

export interface Pass {
  start: Date
  end: Date
  max: Date
  maxAltitude: number
  startAzimuth: number
  endAzimuth: number
  /** Naked-eye visible: above 10 degrees at some moment while lit and with the observer in the dark. */
  visible: boolean
  /** Why it cannot be seen, when `visible` is false. */
  reason: 'day' | 'shadow' | null
  /** Brightest magnitude during the visible part. */
  magnitude: number | null
}

function checksum(line: string): boolean {
  let sum = 0
  for (let i = 0; i < 68; i++) {
    const c = line[i]
    if (c >= '0' && c <= '9') sum += Number(c)
    else if (c === '-') sum += 1
  }
  return sum % 10 === Number(line[68])
}

/** Epoch from columns 19-32 of line 1 (two-digit year and fractional day of year). */
export function tleEpoch(line1: string): Date {
  const yy = Number(line1.slice(18, 20))
  const day = Number(line1.slice(20, 32))
  const year = yy < 57 ? 2000 + yy : 1900 + yy
  return new Date(Date.UTC(year, 0, 1) + (day - 1) * DAY_MS)
}

/** Parses a two- or three-line element set; null if it is malformed or fails its checksums. */
export function parseTle(text: string, fallbackName = 'ISS'): Tle | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)
  const i = lines.findIndex((l) => l.startsWith('1 ') && l.length >= 69)
  if (i < 0 || !lines[i + 1] || !lines[i + 1].startsWith('2 ') || lines[i + 1].length < 69) return null
  const [line1, line2] = [lines[i].slice(0, 69), lines[i + 1].slice(0, 69)]
  if (!checksum(line1) || !checksum(line2)) return null
  const epoch = tleEpoch(line1)
  if (Number.isNaN(epoch.getTime())) return null
  return { name: i > 0 ? lines[i - 1].replace(/^0 /, '').trim() : fallbackName, line1, line2, epoch }
}

/**
 * Fraction of the Sun's disc a satellite at `sat` (ECI, km) can see: 0 in the Earth's umbra,
 * 1 in full sunlight, between in the penumbra. Two overlapping discs: the Sun and the Earth as
 * seen from the satellite (Montenbruck & Gill, "Satellite Orbits", 3.4).
 */
export function sunlitFraction(sunAU: { x: number; y: number; z: number }, sat: { x: number; y: number; z: number }): number {
  const sun = { x: sunAU.x * AU_KM - sat.x, y: sunAU.y * AU_KM - sat.y, z: sunAU.z * AU_KM - sat.z }
  const sunDist = Math.hypot(sun.x, sun.y, sun.z)
  const satDist = Math.hypot(sat.x, sat.y, sat.z)
  const a = Math.asin(SUN_RADIUS_KM / sunDist) // apparent radius of the Sun
  const b = Math.asin(Math.min(1, EARTH_RADIUS_KM / satDist)) // ...and of the Earth
  // Angle between the Earth's centre and the Sun, seen from the satellite.
  const c = Math.acos(Math.max(-1, Math.min(1, -(sat.x * sun.x + sat.y * sun.y + sat.z * sun.z) / (satDist * sunDist))))
  if (c >= a + b) return 1
  if (c <= b - a) return 0
  if (c <= a - b) return 1 - (b * b) / (a * a) // Earth fully in front of the Sun's disc (annular): cannot happen in Earth orbit
  const x = (c * c + a * a - b * b) / (2 * c)
  const y = Math.sqrt(Math.max(0, a * a - x * x))
  const overlap = a * a * Math.acos(Math.max(-1, Math.min(1, x / a))) + b * b * Math.acos(Math.max(-1, Math.min(1, (c - x) / b))) - c * y
  return 1 - overlap / (Math.PI * a * a)
}

/**
 * One satellite on its SGP4 orbit, seen from an observer on the ground. Elements are good for
 * a few days: the error grows by roughly a kilometre or more per day for the ISS.
 */
export class SatelliteTrack {
  readonly tle: Tle
  private rec: SatRec
  /** Intrinsic magnitude at 1000 km range and half phase (McCants' value for the ISS). */
  private stdMag: number

  constructor(tle: Tle, stdMag = -1.8) {
    this.tle = tle
    this.stdMag = stdMag
    this.rec = twoline2satrec(tle.line1, tle.line2)
  }

  /** Days from the element epoch to `date` (negative before it). */
  ageDays(date: Date): number {
    return (date.getTime() - this.tle.epoch.getTime()) / DAY_MS
  }

  state(date: Date, observer: Observer): SatState | null {
    let pv
    try {
      pv = propagate(this.rec, date)
    } catch {
      return null
    }
    if (!pv || !pv.position || !pv.velocity) return null
    const gmst = gstime(date)
    const ecf = eciToEcf(pv.position, gmst)
    const obsGeo = { latitude: degreesToRadians(observer.latDeg), longitude: degreesToRadians(observer.lonDeg), height: 0 }
    const look = ecfToLookAngles(obsGeo, ecf)

    const { x, y, z } = pv.position
    const r = Math.hypot(x, y, z)
    const speed = Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z)
    // Height above the ellipsoid, from the geocentric latitude (good to a few km).
    const sinLat = z / r
    const earthR = 6378.137 * (1 - (1 / 298.257223563) * sinLat * sinLat)
    const heightKm = r - earthR

    const [sx, sy, sz] = sunPos(jday(date)).rsun // AU, Earth-centred inertial
    const sun = { rsun: { x: sx, y: sy, z: sz } }
    const sunlit = sunlitFraction(sun.rsun, pv.position)

    let magnitude: number | null = null
    if (sunlit > 0.01 && look.elevation > -0.2) {
      // Phase angle at the satellite between the directions to the observer and to the Sun.
      const obsEci = ecfToEci(geodeticToEcf(obsGeo), gmst)
      const toObs = { x: obsEci.x - x, y: obsEci.y - y, z: obsEci.z - z }
      const toSun = { x: sun.rsun.x * AU_KM - x, y: sun.rsun.y * AU_KM - y, z: sun.rsun.z * AU_KM - z }
      const cosPhase =
        (toObs.x * toSun.x + toObs.y * toSun.y + toObs.z * toSun.z) /
        (Math.hypot(toObs.x, toObs.y, toObs.z) * Math.hypot(toSun.x, toSun.y, toSun.z))
      const beta = Math.acos(Math.max(-1, Math.min(1, cosPhase)))
      // McCants: m = std - 15 + 5 log10(range) - 2.5 log10(sin b + (pi - b) cos b), scaled by how much of the Sun is visible.
      const phaseTerm = Math.sin(beta) + (Math.PI - beta) * Math.cos(beta)
      magnitude = this.stdMag - 15 + 5 * Math.log10(look.rangeSat) - 2.5 * Math.log10(Math.max(phaseTerm, 1e-3)) - 2.5 * Math.log10(sunlit)
    }

    return {
      altitude: radiansToDegrees(look.elevation),
      azimuth: radiansToDegrees(look.azimuth),
      rangeKm: look.rangeSat,
      heightKm,
      speedKmS: speed,
      sunlit,
      magnitude,
    }
  }

  /** Where the satellite is on the sky from `from` to `to`, one sample every `stepSec` (nulls where it cannot be computed). */
  skyTrack(from: Date, to: Date, stepSec: number, observer: Observer): { time: Date; state: SatState }[] {
    const out: { time: Date; state: SatState }[] = []
    for (let t = from.getTime(); t <= to.getTime(); t += stepSec * 1000) {
      const time = new Date(t)
      const state = this.state(time, observer)
      if (state) out.push({ time, state })
    }
    return out
  }

  /**
   * Passes above the horizon in the next `days`, with those reaching `minAltitude` degrees listed.
   * A pass is "visible" if, while above 10 degrees, the satellite is in sunlight and the Sun is
   * more than 6 degrees below the observer's horizon.
   */
  findPasses(from: Date, days: number, observer: Observer, minAltitude = 10, stepSec = 20): Pass[] {
    const passes: Pass[] = []
    const end = from.getTime() + days * DAY_MS
    const alt = (t: number) => this.state(new Date(t), observer)?.altitude ?? -90

    let t = from.getTime()
    let prev = alt(t)
    while (t < end) {
      const next = t + stepSec * 1000
      const a = alt(next)
      if (prev <= 0 && a > 0) {
        // A rise between t and next; follow the pass to its set.
        const rise = bisect(alt, t, next)
        let setT = next
        let cur = a
        while (cur > 0 && setT < end + 3_600_000) {
          setT += stepSec * 1000
          cur = alt(setT)
        }
        const set = cur > 0 ? setT : bisect(alt, setT - stepSec * 1000, setT)
        const pass = this.describePass(rise, set, observer)
        if (pass.maxAltitude >= minAltitude) passes.push(pass)
        t = setT
        prev = cur
        continue
      }
      t = next
      prev = a
    }
    return passes
  }

  private describePass(rise: number, set: number, observer: Observer): Pass {
    let maxAlt = -90
    let maxT = rise
    let visible = false
    let magnitude: number | null = null
    let sawLit = false
    let sawDark = false
    const step = Math.max(2000, Math.min(10_000, (set - rise) / 40))
    for (let t = rise; t <= set; t += step) {
      const s = this.state(new Date(t), observer)
      if (!s) continue
      if (s.altitude > maxAlt) {
        maxAlt = s.altitude
        maxT = t
      }
      if (s.altitude < 10) continue
      const dark = sunAltitude(new Date(t), observer) < -6
      if (dark) sawDark = true
      if (s.sunlit > 0.5) sawLit = true
      if (dark && s.sunlit > 0.5) {
        visible = true
        if (s.magnitude !== null && (magnitude === null || s.magnitude < magnitude)) magnitude = s.magnitude
      }
    }
    const start = this.state(new Date(rise + 1000), observer)
    const finish = this.state(new Date(set - 1000), observer)
    return {
      start: new Date(rise),
      end: new Date(set),
      max: new Date(maxT),
      maxAltitude: maxAlt,
      startAzimuth: start?.azimuth ?? 0,
      endAzimuth: finish?.azimuth ?? 0,
      visible,
      reason: visible ? null : sawDark && !sawLit ? 'shadow' : sawLit && !sawDark ? 'day' : sawDark ? 'shadow' : 'day',
      magnitude,
    }
  }
}

/** The Sun's altitude in degrees for the observer (with refraction). */
export function sunAltitude(date: Date, observer: Observer): number {
  const o = new Astronomy.Observer(observer.latDeg, observer.lonDeg, 0)
  const eq = Astronomy.Equator(Astronomy.Body.Sun, date, o, true, true)
  return Astronomy.Horizon(date, o, eq.ra, eq.dec, 'normal').altitude
}

/** Finds the time (ms) between `lo` and `hi` where `f` crosses 0, to one second. */
function bisect(f: (t: number) => number, lo: number, hi: number): number {
  const flo = f(lo)
  for (let i = 0; i < 12 && hi - lo > 1000; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) > 0 === flo > 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
