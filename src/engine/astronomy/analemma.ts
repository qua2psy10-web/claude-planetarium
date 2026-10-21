import * as Astronomy from 'astronomy-engine'

export interface AnalemmaPoint {
  /** Where the Sun is at local mean noon on this date, in degrees (azimuth from north through east). */
  altitude: number
  azimuth: number
  /** Date text ("11/1") for the 1st of each month, otherwise null. */
  label: string | null
}

const DAY_MS = 86_400_000

/**
 * The Sun's position at the same time of day on every day of a year: the analemma, a
 * stretched figure of eight. The time of day is local mean noon, 12:00 by the clock of
 * the observer's longitude (mean solar time). Mean time is what keeps the figure steady:
 * the Sun's drift from side to side comes from the equation of time, and its height from
 * the seasons.
 *
 * Positions are for the observer's horizon, so unlike the stars they do not turn with
 * the sky, and they are the same wherever on the same latitude the observer stands.
 */
export function computeAnalemma(year: number, latDeg: number, lonDeg: number): AnalemmaPoint[] {
  const observer = new Astronomy.Observer(latDeg, lonDeg, 0)
  // Local mean noon is 12:00 UTC shifted by the longitude (15 degrees per hour).
  const noonOffset = (12 - lonDeg / 15) * 3_600_000
  const start = Date.UTC(year, 0, 1)
  const days = Math.round((Date.UTC(year + 1, 0, 1) - start) / DAY_MS) // 365 or 366

  const points: AnalemmaPoint[] = []
  for (let i = 0; i < days; i++) {
    const day = new Date(start + i * DAY_MS)
    const t = new Date(start + i * DAY_MS + noonOffset)
    const eq = Astronomy.Equator(Astronomy.Body.Sun, t, observer, true, true)
    const hor = Astronomy.Horizon(t, observer, eq.ra, eq.dec, 'normal')
    points.push({
      altitude: hor.altitude,
      azimuth: hor.azimuth,
      label: day.getUTCDate() === 1 ? `${day.getUTCMonth() + 1}/1` : null,
    })
  }
  return points
}

/**
 * The local mean date at the observer's longitude for a moment in time: which calendar
 * day it is by mean solar time there. Returns the year and the 0-based day of the year,
 * matching the order of `computeAnalemma`.
 */
export function localMeanDay(date: Date, lonDeg: number): { year: number; dayOfYear: number } {
  const local = new Date(date.getTime() + (lonDeg / 15) * 3_600_000)
  const year = local.getUTCFullYear()
  const dayOfYear = Math.floor((Date.UTC(year, local.getUTCMonth(), local.getUTCDate()) - Date.UTC(year, 0, 1)) / DAY_MS)
  return { year, dayOfYear }
}
