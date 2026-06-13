import Fuse from 'fuse.js'
import type { HygStar } from '@/types/star'
import type { ConstellationMeta } from '@/types/constellation'

export type SearchResult =
  | { type: 'star'; star: HygStar }
  | { type: 'constellation'; constellation: ConstellationMeta }
  | { type: 'planet'; name: string; nameJa: string; body: string }

interface SearchEntry {
  type: 'star' | 'constellation' | 'planet'
  label: string
  labelJa: string
  data: HygStar | ConstellationMeta | { name: string; nameJa: string; body: string }
}

const PLANETS = [
  { name: 'Sun', nameJa: '太陽', body: 'Sun' },
  { name: 'Moon', nameJa: '月', body: 'Moon' },
  { name: 'Mercury', nameJa: '水星', body: 'Mercury' },
  { name: 'Venus', nameJa: '金星', body: 'Venus' },
  { name: 'Mars', nameJa: '火星', body: 'Mars' },
  { name: 'Jupiter', nameJa: '木星', body: 'Jupiter' },
  { name: 'Saturn', nameJa: '土星', body: 'Saturn' },
]

let fuse: Fuse<SearchEntry> | null = null

export function buildSearchIndex(stars: HygStar[], constellations: ConstellationMeta[]) {
  const entries: SearchEntry[] = []

  for (const s of stars) {
    if (!s.proper) continue
    entries.push({ type: 'star', label: s.proper, labelJa: s.proper, data: s })
  }

  for (const c of constellations) {
    entries.push({ type: 'constellation', label: c.name, labelJa: c.nameJa, data: c })
  }

  for (const p of PLANETS) {
    entries.push({ type: 'planet', label: p.name, labelJa: p.nameJa, data: p })
  }

  fuse = new Fuse(entries, {
    keys: ['label', 'labelJa'],
    threshold: 0.4,
    minMatchCharLength: 1,
  })
}

export function search(query: string): SearchResult[] {
  if (!fuse || !query.trim()) return []
  return fuse.search(query, { limit: 8 }).map((r) => {
    const e = r.item
    if (e.type === 'star') return { type: 'star', star: e.data as HygStar }
    if (e.type === 'constellation') return { type: 'constellation', constellation: e.data as ConstellationMeta }
    return { type: 'planet', ...(e.data as { name: string; nameJa: string; body: string }) }
  })
}
