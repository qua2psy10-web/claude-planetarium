import type { CometElements } from '@/engine/astronomy/comets'

let cache: CometElements[] | null = null

/** Comet orbital elements (public/data/comets.json, built by scripts/build_comets.py). */
export async function loadComets(): Promise<CometElements[]> {
  if (cache) return cache
  const res = await fetch(`${import.meta.env.BASE_URL}data/comets.json`)
  if (!res.ok) throw new Error('Failed to load comet data')
  cache = ((await res.json()) as { comets: CometElements[] }).comets
  return cache
}
