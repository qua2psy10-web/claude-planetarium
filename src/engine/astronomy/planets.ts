import * as Astronomy from 'astronomy-engine'
import type { PlanetData } from '@/types/planet'
import { degToRad } from './coordinates'

const PLANET_BODIES: Array<{ body: Astronomy.Body; name: string; nameJa: string }> = [
  { body: Astronomy.Body.Sun, name: 'Sun', nameJa: '太陽' },
  { body: Astronomy.Body.Moon, name: 'Moon', nameJa: '月' },
  { body: Astronomy.Body.Mercury, name: 'Mercury', nameJa: '水星' },
  { body: Astronomy.Body.Venus, name: 'Venus', nameJa: '金星' },
  { body: Astronomy.Body.Mars, name: 'Mars', nameJa: '火星' },
  { body: Astronomy.Body.Jupiter, name: 'Jupiter', nameJa: '木星' },
  { body: Astronomy.Body.Saturn, name: 'Saturn', nameJa: '土星' },
]

export function getPlanetPositions(date: Date, latDeg: number, lonDeg: number): PlanetData[] {
  const observer = new Astronomy.Observer(latDeg, lonDeg, 0)
  const results: PlanetData[] = []

  for (const { body, name, nameJa } of PLANET_BODIES) {
    try {
      const equatorial = Astronomy.Equator(body, date, observer, true, true)
      const horizontal = Astronomy.Horizon(date, observer, equatorial.ra, equatorial.dec, 'normal')
      const mag = body === Astronomy.Body.Sun ? -26.7
        : body === Astronomy.Body.Moon ? -12.6
        : getMagnitude(body, date, observer)

      results.push({
        name,
        nameJa,
        altitude: horizontal.altitude,
        azimuth: horizontal.azimuth,
        ra: degToRad(equatorial.ra * 15), // hours → degrees → radians
        dec: degToRad(equatorial.dec),
        magnitude: mag,
        body: name,
      })
    } catch {
      // skip if calculation fails
    }
  }

  return results
}

function getMagnitude(body: Astronomy.Body, date: Date, _observer: Astronomy.Observer): number {
  try {
    const illum = Astronomy.Illumination(body, date)
    return illum.mag
  } catch {
    return 0
  }
}

export function getMoonPhase(date: Date): number {
  return Astronomy.MoonPhase(date) // 0-360 degrees
}
