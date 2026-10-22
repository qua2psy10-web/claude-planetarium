import type { DisplayToggle } from '../types/store'

/** The parts of the planetarium's state that a link can carry. */
export interface ShareState {
  /** Simulated time. Omitted: the link opens at the viewer's current time, running. */
  time?: Date
  /** Observer. Omitted: the viewer's own (default) location. */
  location?: { lat: number; lon: number; name: string }
  /** Where the camera points (degrees) and the field of view. Omitted: the default view. */
  view?: { az: number; alt: number; fov: number }
  /** Display switches that differ from the defaults. */
  toggles?: Partial<Record<DisplayToggle, boolean>>
}

// Short codes keep the link short. The order is only for readability.
const TOGGLE_CODES: Record<DisplayToggle, string> = {
  showConstellationLines: 'cl',
  showConstellationNames: 'cn',
  showPlanetLabels: 'pl',
  showStarNames: 'sn',
  showEquatorialGrid: 'eg',
  showAltazGrid: 'ag',
  showMeteors: 'me',
  showPlanetTrails: 'pt',
  showAnalemma: 'an',
  showComets: 'co',
  showAtmosphere: 'at',
  showMilkyWay: 'mw',
  showDeepSky: 'ds',
  showSatellites: 'sa',
}
const CODE_TO_TOGGLE = Object.fromEntries(Object.entries(TOGGLE_CODES).map(([k, v]) => [v, k as DisplayToggle]))

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** 2026-10-22T13:34:00Z as 20261022T133400Z: no colons to percent-encode in the link. */
export function formatTime(d: Date): string {
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

export function parseTime(s: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s)
  if (!m) return null
  const [y, mo, d, h, mi, se] = m.slice(1).map(Number)
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, se))
  // Reject impossible dates (Date rolls 31 Feb over to March) and years the sky maths is not meant for.
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d || y < 1000 || y > 3000) return null
  return date
}

const round = (v: number, digits: number) => String(Number(v.toFixed(digits)))

/** The query string (without "?") for a state. */
export function encodeShare(state: ShareState): string {
  const p = new URLSearchParams()
  if (state.time) p.set('t', formatTime(state.time))
  if (state.location) {
    p.set('lat', round(state.location.lat, 4))
    p.set('lon', round(state.location.lon, 4))
    if (state.location.name) p.set('n', state.location.name)
  }
  if (state.view) {
    p.set('az', round(((state.view.az % 360) + 360) % 360, 1))
    p.set('alt', round(state.view.alt, 1))
    p.set('fov', round(state.view.fov, 1))
  }
  const on: string[] = []
  const off: string[] = []
  for (const [key, value] of Object.entries(state.toggles ?? {})) {
    ;(value ? on : off).push(TOGGLE_CODES[key as DisplayToggle])
  }
  if (on.length) p.set('on', on.join(','))
  if (off.length) p.set('off', off.join(','))
  return p.toString()
}

const num = (s: string | null): number | null => {
  if (s === null || s.trim() === '') return null
  const v = Number(s)
  return Number.isFinite(v) ? v : null
}

/** Reads a link's query string; every field that is missing or out of range is left out. */
export function decodeShare(search: string): ShareState {
  const p = new URLSearchParams(search)
  const out: ShareState = {}

  const t = p.get('t')
  const time = t ? parseTime(t) : null
  if (time) out.time = time

  const lat = num(p.get('lat'))
  const lon = num(p.get('lon'))
  if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    out.location = { lat, lon, name: (p.get('n') ?? '').slice(0, 40) }
  }

  const az = num(p.get('az'))
  const alt = num(p.get('alt'))
  const fov = num(p.get('fov'))
  if (az !== null && alt !== null && Math.abs(alt) <= 90) {
    out.view = { az: ((az % 360) + 360) % 360, alt, fov: fov !== null ? Math.max(5, Math.min(120, fov)) : 75 }
  }

  const toggles: Partial<Record<DisplayToggle, boolean>> = {}
  for (const [param, value] of [['on', true], ['off', false]] as const) {
    for (const code of (p.get(param) ?? '').split(',')) {
      const key = CODE_TO_TOGGLE[code]
      if (key) toggles[key] = value
    }
  }
  if (Object.keys(toggles).length) out.toggles = toggles
  return out
}
