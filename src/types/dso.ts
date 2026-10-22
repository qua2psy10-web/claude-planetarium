/** Catalogue codes used by the Messier data (d3-celestial). */
export type DsoType = 'snr' | 'gc' | 'oc' | 'sfr' | 'pos' | 'pn' | 's' | 'e' | 'rn' | 'i'

export interface MessierObject {
  /** "M31". */
  id: string
  ngc: string
  nameEn: string | null
  nameJa: string | null
  type: DsoType
  mag: number
  /** J2000, radians (same frame as the star catalogue). */
  ra: number
  dec: number
  /** Major and minor axis, arc minutes (0 when the catalogue gives none). */
  size: number
  sizeMinor: number
}

export const DSO_TYPE_JA: Record<DsoType, string> = {
  snr: '超新星残骸',
  gc: '球状星団',
  oc: '散開星団',
  sfr: '散光星雲',
  pos: '星の集まり',
  pn: '惑星状星雲',
  s: '渦巻銀河',
  e: '楕円銀河',
  rn: '反射星雲',
  i: '不規則銀河',
}
