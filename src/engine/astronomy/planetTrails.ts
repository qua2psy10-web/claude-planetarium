import * as Astronomy from 'astronomy-engine'

export interface TrailPoint {
  /** Time of this position, ms since the epoch. */
  time: number
  /** Right ascension and declination of date, radians (same frame as the planet markers). */
  ra: number
  dec: number
  /** Date text ("11/1") for points worth labelling, otherwise null. */
  label: string | null
}

export interface PlanetTrail {
  /** Matches PlanetData.name, e.g. "Mars". */
  name: string
  color: string
  /** One point per day (UTC midnight), in time order, centred on the day of the date asked for. */
  points: TrailPoint[]
}

interface TrailConfig {
  body: Astronomy.Body
  name: string
  color: string
  /** Days shown each side of now: long enough to take in a retrograde loop. */
  halfSpanDays: number
  /** Days of the month that get a date label. */
  labelDays: number[]
}

// The inner planets race along and the outer ones crawl, so each gets a window that suits it.
const TRAILS: TrailConfig[] = [
  { body: Astronomy.Body.Mercury, name: 'Mercury', color: '#c9c9c9', halfSpanDays: 30, labelDays: [1, 11, 21] },
  { body: Astronomy.Body.Venus, name: 'Venus', color: '#ffe0a0', halfSpanDays: 60, labelDays: [1, 15] },
  { body: Astronomy.Body.Mars, name: 'Mars', color: '#ff7a4d', halfSpanDays: 90, labelDays: [1] },
  { body: Astronomy.Body.Jupiter, name: 'Jupiter', color: '#ffd9a8', halfSpanDays: 150, labelDays: [1] },
  { body: Astronomy.Body.Saturn, name: 'Saturn', color: '#e8cc88', halfSpanDays: 150, labelDays: [1] },
]

const DAY_MS = 86_400_000
const DEG = Math.PI / 180

// Geocentre to within a few arcseconds for planets: parallax is negligible next to the trail.
const OBSERVER = new Astronomy.Observer(0, 0, 0)

/** UTC day number (days since the epoch) that `date` falls on. */
export function dayIndex(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS)
}

/**
 * Each planet's path among the stars around `date`: one point per day, from
 * `halfSpanDays` before the day of `date` to the same after. Positions are right
 * ascension and declination of date, so they match the planet markers.
 */
export function computePlanetTrails(date: Date): PlanetTrail[] {
  const centre = dayIndex(date) * DAY_MS
  return TRAILS.map((cfg) => {
    const points: TrailPoint[] = []
    for (let k = -cfg.halfSpanDays; k <= cfg.halfSpanDays; k++) {
      const t = new Date(centre + k * DAY_MS)
      const eq = Astronomy.Equator(cfg.body, t, OBSERVER, true, true)
      const labelled = cfg.labelDays.includes(t.getUTCDate())
      points.push({
        time: t.getTime(),
        ra: eq.ra * 15 * DEG, // hours -> degrees -> radians
        dec: eq.dec * DEG,
        label: labelled ? `${t.getUTCMonth() + 1}/${t.getUTCDate()}` : null,
      })
    }
    return { name: cfg.name, color: cfg.color, points }
  })
}
