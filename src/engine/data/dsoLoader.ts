import type { DsoType, MessierObject } from '@/types/dso'

interface RawMessier {
  id: string
  ngc: string
  nameEn: string | null
  type: DsoType
  mag: number
  ra: number
  dec: number
  size: number
  sizeMinor: number
}

// Japanese names for the well-known ones; the rest are shown by their M number.
const NAMES_JA: Record<string, string> = {
  M1: 'かに星雲',
  M6: 'バタフライ星団',
  M7: 'プトレマイオス星団',
  M8: '干潟星雲',
  M11: 'ワイルドダック星団',
  M13: 'ヘルクレス座球状星団',
  M16: 'わし星雲',
  M17: 'オメガ星雲',
  M20: '三裂星雲',
  M24: 'いて座の星雲状星団',
  M27: 'あれい状星雲',
  M31: 'アンドロメダ銀河',
  M33: 'さんかく座銀河',
  M42: 'オリオン大星雲',
  M44: 'プレセペ星団',
  M45: 'すばる',
  M51: '子持ち銀河',
  M57: 'リング星雲',
  M63: 'ひまわり銀河',
  M64: '黒眼銀河',
  M76: '小あれい状星雲',
  M81: 'ボーデの銀河',
  M82: '葉巻銀河',
  M83: '南の回転花火銀河',
  M87: 'おとめ座A',
  M97: 'ふくろう星雲',
  M101: '回転花火銀河',
  M104: 'ソンブレロ銀河',
}

const DEG = Math.PI / 180

let cache: MessierObject[] | null = null

/** The 110 Messier objects, brightest first. */
export async function loadMessier(): Promise<MessierObject[]> {
  if (cache) return cache
  const res = await fetch(`${import.meta.env.BASE_URL}data/messier.json`)
  if (!res.ok) throw new Error('Failed to load Messier catalogue')
  const raw = (await res.json()) as RawMessier[]
  cache = raw
    .map((o) => ({ ...o, nameJa: NAMES_JA[o.id] ?? null, ra: o.ra * DEG, dec: o.dec * DEG }))
    .sort((a, b) => a.mag - b.mag)
  return cache
}
