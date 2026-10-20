import * as Astronomy from 'astronomy-engine'

export interface MoonInfo {
  /** Lit fraction of the disk as seen from Earth, 0 (new) to 1 (full). */
  illumination: number
  /** Sun-Moon-Earth angle in degrees: 0 at full moon, 180 at new moon. */
  phaseAngle: number
  /** Moon's longitude east of the Sun, 0-360: 0 new, 90 first quarter, 180 full, 270 last quarter. */
  elongation: number
  /** Days since the last new moon (the Japanese 月齢). */
  ageDays: number
  nameJa: string
}

/** Phase angle in degrees (0 = full, 180 = new). Cheap enough to call every frame. */
export function getMoonPhaseAngle(date: Date): number {
  return Astronomy.Illumination(Astronomy.Body.Moon, date).phase_angle
}

/** Name for a phase, from the Moon's elongation east of the Sun (0-360 degrees). */
export function moonPhaseName(elongation: number): string {
  const e = ((elongation % 360) + 360) % 360
  if (e < 6 || e >= 354) return '新月'
  if (e < 84) return '三日月'
  if (e < 96) return '上弦の月'
  if (e < 174) return '満ちていく月'
  if (e < 186) return '満月'
  if (e < 264) return '欠けていく月'
  if (e < 276) return '下弦の月'
  return '有明の月'
}

/** Days since the most recent new moon at `date`. */
export function moonAgeDays(date: Date): number {
  const DAY = 86_400_000
  // A lunation lasts 29.3-29.8 days, so a 31-day window can hold two new moons: take the later one.
  const first = Astronomy.SearchMoonPhase(0, new Date(date.getTime() - 31 * DAY), 31)
  if (!first) return 0
  const second = Astronomy.SearchMoonPhase(0, new Date(first.date.getTime() + DAY), 31)
  const last = second && second.date.getTime() <= date.getTime() ? second : first
  return (date.getTime() - last.date.getTime()) / DAY
}

export function getMoonInfo(date: Date): MoonInfo {
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, date)
  const elongation = Astronomy.MoonPhase(date)
  return {
    illumination: illum.phase_fraction,
    phaseAngle: illum.phase_angle,
    elongation,
    ageDays: moonAgeDays(date),
    nameJa: moonPhaseName(elongation),
  }
}

let cached: { minute: number; info: MoonInfo } | null = null

/**
 * `getMoonInfo` at minute resolution, remembering the last answer. The age needs a search for the
 * previous new moon, so this is the one to use from code that runs every frame (e.g. React renders).
 */
export function getMoonInfoCached(date: Date): MoonInfo {
  const minute = Math.floor(date.getTime() / 60_000)
  if (cached?.minute !== minute) cached = { minute, info: getMoonInfo(new Date(minute * 60_000)) }
  return cached.info
}

/** Real angular radius of the Moon, in degrees (about 0.26 for a 0.52 degree disk). */
const MOON_RADIUS_DEG = 0.26
/** The real Moon is too small on a wide view for its phase to be seen, so it is drawn at least this big. */
const MIN_MOON_RADIUS_PX = 15

/** Radius in pixels to draw the Moon at, for a given vertical field of view and viewport height. */
export function moonDiskRadiusPx(fovDeg: number, heightPx: number): number {
  const pixelsPerUnit = heightPx / 2 / Math.tan((fovDeg * Math.PI) / 360)
  const real = pixelsPerUnit * Math.tan((MOON_RADIUS_DEG * Math.PI) / 180)
  return Math.max(MIN_MOON_RADIUS_PX, real)
}
