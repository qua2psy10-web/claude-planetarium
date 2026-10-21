import * as Astronomy from 'astronomy-engine'

const DEG = Math.PI / 180

// Radii in km. The Earth's is enlarged by 1/85 when working out its shadow, the convention of the
// NASA eclipse catalogues, to allow for the atmosphere.
const SUN_RADIUS_KM = 696_000
const MOON_RADIUS_KM = 1737.4
const EARTH_RADIUS_KM = 6378.137
const SHADOW_ENLARGEMENT = 1 + 1 / 85

// ---------------------------------------------------------------------------------------------
// Geometry of two overlapping discs

/** Area where two discs of radii r1 and r2, d apart (centre to centre), overlap. */
export function overlapArea(r1: number, r2: number, d: number): number {
  if (d >= r1 + r2) return 0
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2
  const a = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1))
  const b = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2))
  const c = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2))
  return a + b - c
}

/** Fraction of the Sun's disc hidden by the Moon, given their angular radii and separation (any one unit). */
export function sunObscuration(sunRadius: number, moonRadius: number, separation: number): number {
  return overlapArea(sunRadius, moonRadius, separation) / (Math.PI * sunRadius * sunRadius)
}

// ---------------------------------------------------------------------------------------------
// Where things are at one moment

const angularRadius = (radiusKm: number, distanceKm: number) => Math.asin(radiusKm / distanceKm) / DEG

function angleBetweenRaDec(ra1: number, dec1: number, ra2: number, dec2: number): number {
  // degrees in, degrees out
  const d1 = dec1 * DEG, d2 = dec2 * DEG
  const c = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos((ra1 - ra2) * DEG)
  return Math.acos(Math.max(-1, Math.min(1, c))) / DEG
}

export interface SolarGeometry {
  /** Angular radii and the distance between the two centres, all in degrees, as seen from the observer. */
  sunRadiusDeg: number
  moonRadiusDeg: number
  separationDeg: number
  /** Fraction of the Sun's disc covered by the Moon, 0 to 1. */
  obscuration: number
}

/** The Sun and Moon as seen from the observer (so the Moon's parallax is included). */
export function solarGeometry(date: Date, observer: Astronomy.Observer): SolarGeometry {
  const sun = Astronomy.Equator(Astronomy.Body.Sun, date, observer, true, true)
  const moon = Astronomy.Equator(Astronomy.Body.Moon, date, observer, true, true)
  const sunRadiusDeg = angularRadius(SUN_RADIUS_KM, sun.dist * Astronomy.KM_PER_AU)
  const moonRadiusDeg = angularRadius(MOON_RADIUS_KM, moon.dist * Astronomy.KM_PER_AU)
  const separationDeg = angleBetweenRaDec(sun.ra * 15, sun.dec, moon.ra * 15, moon.dec)
  return { sunRadiusDeg, moonRadiusDeg, separationDeg, obscuration: sunObscuration(sunRadiusDeg, moonRadiusDeg, separationDeg) }
}

export interface LunarGeometry {
  moonRadiusDeg: number
  /** Radii of the Earth's umbra and penumbra at the Moon's distance, in degrees. */
  umbraRadiusDeg: number
  penumbraRadiusDeg: number
  /** Distance from the centre of the Moon to the centre of the shadow (the point opposite the Sun), degrees. */
  separationDeg: number
  /** How far the Moon is into the umbra, as a fraction of its diameter (above 1 the Moon is entirely inside). */
  umbralMagnitude: number
  penumbralMagnitude: number
}

/** The Moon against the Earth's shadow. Seen from the centre of the Earth: an eclipse looks the same everywhere. */
export function lunarGeometry(date: Date): LunarGeometry {
  const moon = Astronomy.GeoVector(Astronomy.Body.Moon, date, true)
  const sun = Astronomy.GeoVector(Astronomy.Body.Sun, date, true)
  const moonKm = Math.hypot(moon.x, moon.y, moon.z) * Astronomy.KM_PER_AU
  const sunKm = Math.hypot(sun.x, sun.y, sun.z) * Astronomy.KM_PER_AU
  const cos = -(moon.x * sun.x + moon.y * sun.y + moon.z * sun.z) / (Math.hypot(moon.x, moon.y, moon.z) * Math.hypot(sun.x, sun.y, sun.z))
  const separationDeg = Math.acos(Math.max(-1, Math.min(1, cos))) / DEG

  const moonParallax = Math.asin(EARTH_RADIUS_KM / moonKm) / DEG
  const sunParallax = Math.asin(EARTH_RADIUS_KM / sunKm) / DEG
  const sunRadius = angularRadius(SUN_RADIUS_KM, sunKm)
  const moonRadiusDeg = angularRadius(MOON_RADIUS_KM, moonKm)
  const reach = SHADOW_ENLARGEMENT * (moonParallax + sunParallax)
  const umbraRadiusDeg = reach - sunRadius
  const penumbraRadiusDeg = reach + sunRadius
  return {
    moonRadiusDeg,
    umbraRadiusDeg,
    penumbraRadiusDeg,
    separationDeg,
    umbralMagnitude: (umbraRadiusDeg - separationDeg + moonRadiusDeg) / (2 * moonRadiusDeg),
    penumbralMagnitude: (penumbraRadiusDeg - separationDeg + moonRadiusDeg) / (2 * moonRadiusDeg),
  }
}

// ---------------------------------------------------------------------------------------------
// Finding eclipses

export type SolarKind = 'partial' | 'annular' | 'total'
export type LunarKind = 'penumbral' | 'partial' | 'total'

export interface SolarEclipseHere {
  kind: SolarKind
  /** Fraction of the Sun's disc covered at the greatest moment, as seen from the observer. */
  obscuration: number
  partialBegin: Date
  peak: Date
  partialEnd: Date
  /** The total or annular phase, when there is one. */
  centralBegin: Date | null
  centralEnd: Date | null
  /** Sun's altitude at the greatest moment, degrees (negative: the Sun is below the horizon). */
  peakAltitude: number
}

export interface LunarEclipse {
  kind: LunarKind
  peak: Date
  penumbralBegin: Date
  partialBegin: Date | null
  totalBegin: Date | null
  totalEnd: Date | null
  partialEnd: Date | null
  penumbralEnd: Date
  /** How deep into the umbra the Moon goes, at the greatest moment (a fraction of its diameter). */
  umbralMagnitude: number
  penumbralMagnitude: number
  /** Moon's altitude at the greatest moment for the observer, degrees. */
  peakAltitude: number
}

const MINUTE_MS = 60_000

/** The next `count` solar eclipses that can be seen from the observer, after `from`. */
export function nextSolarEclipsesHere(from: Date, observer: Astronomy.Observer, count: number): SolarEclipseHere[] {
  const out: SolarEclipseHere[] = []
  let info = Astronomy.SearchLocalSolarEclipse(from, observer)
  for (let i = 0; i < count; i++) {
    out.push({
      kind: info.kind as SolarKind,
      obscuration: info.obscuration,
      partialBegin: info.partial_begin.time.date,
      peak: info.peak.time.date,
      partialEnd: info.partial_end.time.date,
      centralBegin: info.total_begin ? info.total_begin.time.date : null,
      centralEnd: info.total_end ? info.total_end.time.date : null,
      peakAltitude: info.peak.altitude,
    })
    if (i < count - 1) info = Astronomy.NextLocalSolarEclipse(info.peak.time, observer) // peak is an event here, not a time
  }
  return out
}

/** The next `count` lunar eclipses after `from`, with the Moon's altitude for the observer at the peak. */
export function nextLunarEclipses(from: Date, observer: Astronomy.Observer, count: number): LunarEclipse[] {
  const out: LunarEclipse[] = []
  let info = Astronomy.SearchLunarEclipse(from)
  for (let i = 0; i < count; i++) {
    const peak = info.peak.date
    const at = (minutes: number) => new Date(peak.getTime() + minutes * MINUTE_MS)
    const moon = Astronomy.Equator(Astronomy.Body.Moon, peak, observer, true, true)
    const altitude = Astronomy.Horizon(peak, observer, moon.ra, moon.dec, 'normal').altitude
    out.push({
      kind: info.kind as LunarKind,
      peak,
      penumbralBegin: at(-info.sd_penum),
      partialBegin: info.sd_partial > 0 ? at(-info.sd_partial) : null,
      totalBegin: info.sd_total > 0 ? at(-info.sd_total) : null,
      totalEnd: info.sd_total > 0 ? at(info.sd_total) : null,
      partialEnd: info.sd_partial > 0 ? at(info.sd_partial) : null,
      penumbralEnd: at(info.sd_penum),
      umbralMagnitude: lunarGeometry(peak).umbralMagnitude,
      penumbralMagnitude: lunarGeometry(peak).penumbralMagnitude,
      peakAltitude: altitude,
    })
    if (i < count - 1) info = Astronomy.NextLunarEclipse(info.peak)
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// What is happening right now

export interface EclipseNow {
  /** Sun and Moon as seen from the observer, when the Moon is near enough to the Sun to matter. */
  solar: SolarGeometry | null
  /** Moon and Earth's shadow, when the Moon is near enough to the shadow to matter. */
  lunar: LunarGeometry | null
}

const NONE: EclipseNow = { solar: null, lunar: null }
let observerCache: { key: string; observer: Astronomy.Observer } | null = null

function observerAt(latDeg: number, lonDeg: number): Astronomy.Observer {
  const key = `${latDeg}/${lonDeg}`
  if (observerCache?.key !== key) observerCache = { key, observer: new Astronomy.Observer(latDeg, lonDeg, 0) }
  return observerCache.observer
}

/** The Moon must be within this many degrees of the Sun for the Sun-Moon picture to be worth drawing. */
const SOLAR_RANGE_DEG = 4

/**
 * Eclipse geometry for a moment in time, for drawing. `phaseAngleDeg` is the Moon's phase angle
 * (0 full, 180 new), which tells cheaply whether an eclipse is even possible, so this can run every frame.
 */
export function eclipseNow(date: Date, latDeg: number, lonDeg: number, phaseAngleDeg: number): EclipseNow {
  if (phaseAngleDeg > 170) {
    const solar = solarGeometry(date, observerAt(latDeg, lonDeg))
    return solar.separationDeg < SOLAR_RANGE_DEG ? { solar, lunar: null } : NONE
  }
  if (phaseAngleDeg < 8) {
    const lunar = lunarGeometry(date)
    return lunar.penumbralMagnitude > -1 ? { solar: null, lunar } : NONE
  }
  return NONE
}

/** Where the Sun or Moon is in the observer's sky, in degrees (azimuth from north through east). */
export function horizontalPosition(body: 'sun' | 'moon', date: Date, latDeg: number, lonDeg: number): { altitude: number; azimuth: number } {
  const observer = observerAt(latDeg, lonDeg)
  const b = body === 'sun' ? Astronomy.Body.Sun : Astronomy.Body.Moon
  const eq = Astronomy.Equator(b, date, observer, true, true)
  const h = Astronomy.Horizon(date, observer, eq.ra, eq.dec, 'normal')
  return { altitude: h.altitude, azimuth: h.azimuth }
}

/**
 * One line about an eclipse in progress, or null. For a solar eclipse it is how much of the Sun
 * the Moon hides for the observer; for a lunar eclipse how deep the Moon is in the Earth's shadow.
 */
export function eclipseSummary(date: Date, latDeg: number, lonDeg: number, phaseAngleDeg: number): string | null {
  const { solar, lunar } = eclipseNow(date, latDeg, lonDeg, phaseAngleDeg)
  if (solar && solar.obscuration > 0) {
    const pct = `${(solar.obscuration * 100).toFixed(solar.obscuration > 0.99 ? 1 : 0)}%`
    if (solar.obscuration > 0.999) return `皆既日食 太陽が完全に隠れている`
    const ringLeft = solar.moonRadiusDeg < solar.sunRadiusDeg && solar.separationDeg < solar.sunRadiusDeg - solar.moonRadiusDeg
    return ringLeft ? `金環日食 太陽の${pct}が隠れている` : `部分日食 太陽の${pct}が隠れている`
  }
  if (lunar) {
    if (lunar.umbralMagnitude >= 1) return `皆既月食 月は地球の本影の中 (食分 ${lunar.umbralMagnitude.toFixed(2)})`
    if (lunar.umbralMagnitude > 0) return `部分月食 本影食分 ${lunar.umbralMagnitude.toFixed(2)}`
    if (lunar.penumbralMagnitude > 0) return `半影月食 半影食分 ${lunar.penumbralMagnitude.toFixed(2)}`
  }
  return null
}
