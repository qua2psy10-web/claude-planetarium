import type { HygStar } from '@/types/star'

let cache: HygStar[] | null = null

export async function loadStars(): Promise<HygStar[]> {
  if (cache) return cache
  const res = await fetch('/data/hyg_stars.json')
  if (!res.ok) throw new Error('Failed to load star catalog')
  cache = await res.json() as HygStar[]
  return cache
}
