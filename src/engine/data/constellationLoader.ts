import type { ConstellationLines, ConstellationMeta } from '@/types/constellation'

let linesCache: ConstellationLines | null = null
let metaCache: ConstellationMeta[] | null = null

export async function loadConstellationLines(): Promise<ConstellationLines> {
  if (linesCache) return linesCache
  const res = await fetch(`${import.meta.env.BASE_URL}data/constellations_lines.json`)
  if (!res.ok) throw new Error('Failed to load constellation lines')
  linesCache = await res.json() as ConstellationLines
  return linesCache
}

/** Look up a constellation by IAU abbreviation. Only works after the metadata has been loaded. */
export function findConstellation(abbr: string): ConstellationMeta | undefined {
  return metaCache?.find((c) => c.abbr === abbr)
}

export async function loadConstellationMeta(): Promise<ConstellationMeta[]> {
  if (metaCache) return metaCache
  const res = await fetch(`${import.meta.env.BASE_URL}data/constellations_meta.json`)
  if (!res.ok) throw new Error('Failed to load constellation metadata')
  metaCache = await res.json() as ConstellationMeta[]
  return metaCache
}
