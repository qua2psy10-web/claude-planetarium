import type { HygStar } from '@/types/star'

let cache: HygStar[] | null = null

export async function loadStars(): Promise<HygStar[]> {
  if (cache) return cache
  const res = await fetch(`${import.meta.env.BASE_URL}data/hyg_stars.json`)
  if (!res.ok) throw new Error('Failed to load star catalog')
  cache = await res.json() as HygStar[]
  return cache
}
