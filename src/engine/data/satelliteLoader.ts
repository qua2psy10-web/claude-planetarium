import { parseTle, SatelliteTrack, type Tle } from '@/engine/astronomy/satellites'

const CELESTRAK_ISS = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE'
const CACHE_KEY = 'planetarium.iss.tle'
/** CelesTrak updates the elements a few times a day and asks clients not to poll more often than every two hours. */
const CACHE_MAX_AGE_MS = 2 * 3_600_000
const FETCH_TIMEOUT_MS = 6000

export type IssSource = 'live' | 'cache' | 'bundled'

export interface IssData {
  track: SatelliteTrack
  source: IssSource
  /** When the elements were downloaded (the bundled file's date for 'bundled'). */
  fetchedAt: Date
}

interface Cached {
  text: string
  fetchedAt: number
}

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Cached
    return typeof c.text === 'string' && typeof c.fetchedAt === 'number' ? c : null
  } catch {
    return null
  }
}

function writeCache(c: Cached) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    // private window or storage full: the elements simply are not remembered
  }
}

async function fetchLive(): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(CELESTRAK_ISS, { signal: controller.signal })
    if (!res.ok) return null
    const text = await res.text()
    return parseTle(text) ? text : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function fetchBundled(): Promise<{ text: string; fetchedAt: number } | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/tle.json`)
    if (!res.ok) return null
    const j = (await res.json()) as { iss: string; fetchedAt: string }
    return { text: j.iss, fetchedAt: Date.parse(j.fetchedAt) }
  } catch {
    return null
  }
}

const make = (tle: Tle, source: IssSource, fetchedAt: number): IssData => ({
  track: new SatelliteTrack(tle),
  source,
  fetchedAt: new Date(fetchedAt),
})

let pending: Promise<IssData | null> | null = null

/**
 * The ISS's orbital elements: a fresh download from CelesTrak when possible (kept for two hours so
 * reloads do not hammer it), otherwise the copy bundled with the site at build time, or the last
 * download. Whichever has the newest epoch wins.
 */
export function loadIss(): Promise<IssData | null> {
  pending ??= (async () => {
    const now = Date.now()
    const cached = readCache()
    if (cached && now - cached.fetchedAt < CACHE_MAX_AGE_MS) {
      const tle = parseTle(cached.text)
      if (tle) return make(tle, 'cache', cached.fetchedAt)
    }

    const live = await fetchLive()
    if (live) {
      writeCache({ text: live, fetchedAt: now })
      return make(parseTle(live)!, 'live', now)
    }

    const candidates: { tle: Tle; source: IssSource; fetchedAt: number }[] = []
    if (cached) {
      const tle = parseTle(cached.text)
      if (tle) candidates.push({ tle, source: 'cache', fetchedAt: cached.fetchedAt })
    }
    const bundled = await fetchBundled()
    const bundledTle = bundled && parseTle(bundled.text)
    if (bundled && bundledTle) candidates.push({ tle: bundledTle, source: 'bundled', fetchedAt: bundled.fetchedAt })

    candidates.sort((a, b) => b.tle.epoch.getTime() - a.tle.epoch.getTime())
    const best = candidates[0]
    return best ? make(best.tle, best.source, best.fetchedAt) : null
  })()
  return pending
}
