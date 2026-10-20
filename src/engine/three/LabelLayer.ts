import * as THREE from 'three'
import type { HygStar } from '@/types/star'
import type { ConstellationMeta } from '@/types/constellation'
import type { PlanetData } from '@/types/planet'
import { equatorialToHorizontal, horizontalToCartesian, degToRad } from '@/engine/astronomy/coordinates'

const DEG = Math.PI / 180

const FONT_FAMILY = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic','Noto Sans JP',sans-serif"

const PLANET_STYLE = { font: `bold 14px ${FONT_FAMILY}`, color: '#ffd54a' }
const STAR_STYLE = { font: `12px ${FONT_FAMILY}`, color: '#ffe9a8' }
const CONSTELLATION_STYLE = { font: `13px ${FONT_FAMILY}`, color: '#9fd0ff' }
const RADIANT_STYLE = { font: `12px ${FONT_FAMILY}`, color: '#ffae6b' }
const GRID_STYLE = { font: `11px ${FONT_FAMILY}`, color: '#7fe0c0' }
const ALTAZ_STYLE = { font: `11px ${FONT_FAMILY}`, color: '#f0b878' }
const CARDINAL_STYLE = { font: `bold 15px ${FONT_FAMILY}`, color: '#ffb347' }

// Indexed by azimuth / 90 degrees.
const CARDINALS = ['北', '東', '南', '西']

// Japanese names for the best-known stars; others fall back to the IAU name.
const STAR_NAMES_JA: Record<string, string> = {
  Sirius: 'シリウス', Canopus: 'カノープス', Arcturus: 'アークトゥルス', Vega: 'ベガ',
  Capella: 'カペラ', Rigel: 'リゲル', Procyon: 'プロキオン', Achernar: 'アケルナル',
  Betelgeuse: 'ベテルギウス', Altair: 'アルタイル', Aldebaran: 'アルデバラン',
  Antares: 'アンタレス', Spica: 'スピカ', Pollux: 'ポルックス', Fomalhaut: 'フォーマルハウト',
  Deneb: 'デネブ', Regulus: 'レグルス', Castor: 'カストル', Polaris: 'ポラリス',
  Bellatrix: 'ベラトリックス', Alnilam: 'アルニラム', Alnitak: 'アルニタク', Mintaka: 'ミンタカ',
  Saiph: 'サイフ', Dubhe: 'ドゥーベ', Mizar: 'ミザール', Alioth: 'アリオト', Algol: 'アルゴル',
  Mirfak: 'ミルファク', Hamal: 'ハマル', Markab: 'マルカブ', Alphard: 'アルファルド',
  Rasalhague: 'ラスアルハゲ', Albireo: 'アルビレオ', Sadr: 'サドル', Shaula: 'シャウラ',
  Acrux: 'アクルックス', Mimosa: 'ミモザ', Hadar: 'ハダル', 'Rigil Kentaurus': 'リギル・ケンタウルス',
  Alpheratz: 'アルフェラッツ', Caph: 'カフ', Denebola: 'デネボラ', Elnath: 'エルナト',
  Kochab: 'コカブ', Enif: 'エニフ', Nunki: 'ヌンキ', Sargas: 'サルガス', Alphecca: 'アルフェッカ',
  Menkalinan: 'メンカリナン', Menkar: 'メンカル', Ankaa: 'アンカア', Diphda: 'ディフダ', Alnair: 'アルナイル', Eltanin: 'エルタニン',
}

interface Rect { x0: number; y0: number; x1: number; y1: number }

/**
 * Draws names (planets, bright stars, constellations) on a 2D canvas laid over
 * the WebGL canvas. Text is drawn here rather than in WebGL so it stays crisp on
 * Retina screens, can use system CJK fonts, and can avoid overlapping itself.
 */
export class LabelLayer {
  private overlay: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private host: HTMLCanvasElement
  private camera: THREE.PerspectiveCamera
  private v = new THREE.Vector3()
  private widths = new Map<string, number>()

  private namedStars: HygStar[] = []
  private constellations: ConstellationMeta[] = []
  private planets: PlanetData[] = []
  private radiants: { text: string; dir: [number, number, number] }[] = []
  private lst = 0
  private latRad = 0
  private fov = 75
  private showStars = false
  private showConstellations = false
  private showPlanets = false
  private showGrid = false
  private showAltaz = false
  // Constellation labels drawn in the last frame, so clicks on them can be resolved.
  private constellationHits: { rect: Rect; meta: ConstellationMeta }[] = []

  private width = 0
  private height = 0
  private dpr = 1

  constructor(host: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
    this.host = host
    this.camera = camera
    this.overlay = document.createElement('canvas')
    // Below the React UI (z-20+) but above the WebGL canvas; never intercepts input.
    Object.assign(this.overlay.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '10',
    })
    host.parentElement?.insertBefore(this.overlay, host.nextSibling)
    this.ctx = this.overlay.getContext('2d')!
    this.resize()
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.width = this.host.clientWidth || window.innerWidth
    this.height = this.host.clientHeight || window.innerHeight
    this.overlay.width = Math.round(this.width * this.dpr)
    this.overlay.height = Math.round(this.height * this.dpr)
  }

  setStars(stars: HygStar[]) {
    // The catalog is sorted by magnitude, so this stays brightest-first.
    this.namedStars = stars.filter((s) => s.proper)
  }

  setConstellations(meta: ConstellationMeta[]) {
    this.constellations = meta
  }

  setPlanets(planets: PlanetData[], show: boolean) {
    this.planets = planets
    this.showPlanets = show
  }

  /** Meteor shower radiants to name, as unit vectors in scene (horizontal) coordinates. */
  setRadiants(radiants: { text: string; dir: [number, number, number] }[]) {
    this.radiants = radiants
  }

  setView(lst: number, latRad: number, fov: number) {
    this.lst = lst
    this.latRad = latRad
    this.fov = fov
  }

  setVisibility(constellations: boolean, stars: boolean) {
    this.showConstellations = constellations
    this.showStars = stars
  }

  setGridVisible(show: boolean) {
    this.showGrid = show
  }

  setAltazVisible(show: boolean) {
    this.showAltaz = show
  }

  /** Call after the WebGL frame has rendered so the camera matrices are current. */
  draw() {
    const { ctx } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    this.constellationHits = []
    const any = this.showStars || this.showConstellations || this.showPlanets || this.showGrid || this.showAltaz || this.radiants.length > 0
    if (!any) return

    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'

    // Keep labels out from under UI panels: they mark themselves with data-no-labels.
    const placed = this.uiRects()

    // Priority order: whatever is placed first wins any overlap.
    if (this.showPlanets) {
      for (const p of this.planets) {
        if (p.altitude < 0) continue
        const pt = this.project(degToRad(p.altitude), degToRad(p.azimuth))
        if (pt) this.label(placed, p.nameJa || p.name, pt.x, pt.y + 18, 'center', PLANET_STYLE)
      }
    }

    // A shower's radiant is the point of the whole display while it is active: name it before stars.
    for (const r of this.radiants) {
      const altitude = Math.asin(Math.max(-1, Math.min(1, r.dir[1])))
      const azimuth = Math.atan2(r.dir[0], -r.dir[2])
      const pt = this.project(altitude, azimuth)
      if (pt) this.label(placed, r.text, pt.x, pt.y + 18, 'center', RADIANT_STYLE)
    }

    if (this.showStars) {
      // Show fainter stars as the view zooms in.
      const maxMag = Math.max(1.8, Math.min(5.5, 2.6 + 2 * Math.log2(75 / this.fov)))
      for (const s of this.namedStars) {
        if (s.mag > maxMag) break
        const hor = equatorialToHorizontal(s.ra, s.dec, this.lst, this.latRad)
        if (hor.altitude < degToRad(1)) continue
        const pt = this.project(hor.altitude, hor.azimuth)
        if (pt) this.label(placed, STAR_NAMES_JA[s.proper] ?? s.proper, pt.x + 8, pt.y - 2, 'left', STAR_STYLE)
      }
    }

    if (this.showConstellations) {
      for (const c of this.constellations) {
        const hor = equatorialToHorizontal(c.centroidRa, c.centroidDec, this.lst, this.latRad)
        if (hor.altitude < degToRad(3)) continue
        const pt = this.project(hor.altitude, hor.azimuth)
        if (!pt) continue
        const rect = this.label(placed, c.nameJa, pt.x, pt.y, 'center', CONSTELLATION_STYLE)
        if (rect) this.constellationHits.push({ rect, meta: c })
      }
    }

    if (this.showAltaz) this.altazLabels(placed)
    if (this.showGrid) this.gridLabels(placed)
  }

  /**
   * Tick labels for the equatorial grid. They sit on the RA meridian and the
   * declination circle nearest the centre of the view, so scale marks are always
   * on screen wherever you look.
   */
  private gridLabels(placed: Rect[]) {
    const step = 15 * DEG
    const { latRad, lst } = this

    // View centre as RA/Dec: camera direction -> alt/az -> hour angle/dec.
    const { alt, az } = this.viewDirection()
    const sinDec = Math.sin(latRad) * Math.sin(alt) + Math.cos(latRad) * Math.cos(alt) * Math.cos(az)
    const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)))
    const cosDec = Math.max(Math.cos(dec), 1e-6)
    const sinH = (-Math.sin(az) * Math.cos(alt)) / cosDec
    const cosH = (Math.sin(alt) - Math.sin(latRad) * sinDec) / (Math.max(Math.cos(latRad), 1e-6) * cosDec)
    const ra = lst - Math.atan2(sinH, cosH)

    const meridian = Math.round(ra / step) * step
    // step is 15 degrees in radians, so this rounds dec to the nearest 15-degree circle.
    const circleDec = Math.max(-75, Math.min(75, Math.round(dec / step) * 15)) * DEG

    const at = (raRad: number, decRad: number, text: string) => {
      const hor = equatorialToHorizontal(raRad, decRad, lst, latRad)
      if (hor.altitude < 0) return
      const pt = this.project(hor.altitude, hor.azimuth)
      if (pt) this.label(placed, text, pt.x, pt.y, 'center', GRID_STYLE)
    }

    for (let d = -75; d <= 75; d += 15) {
      const sign = d > 0 ? '+' : d < 0 ? '−' : ''
      at(meridian, d * DEG, `${sign}${Math.abs(d)}°`)
    }
    for (let h = 0; h < 24; h++) at(h * step, circleDec, `${h}h`)
  }

  /** Where the camera is looking: altitude, and azimuth from north towards east (radians). */
  private viewDirection(): { alt: number; az: number } {
    this.camera.getWorldDirection(this.v)
    return {
      alt: Math.asin(Math.max(-1, Math.min(1, this.v.y))),
      az: Math.atan2(this.v.x, -this.v.z),
    }
  }

  /**
   * Labels for the alt/az grid: cardinal directions on the horizon, plus tick
   * labels on the azimuth line and altitude circle nearest the view centre.
   */
  private altazLabels(placed: Rect[]) {
    const { alt, az } = this.viewDirection()
    const azNear = Math.round((((az / DEG) % 360) + 360) % 360 / 15) * 15
    const altNear = Math.max(0, Math.min(75, Math.round(alt / DEG / 15) * 15))

    const at = (altDeg: number, azDeg: number, text: string, style: { font: string; color: string }) => {
      const pt = this.project(altDeg * DEG, azDeg * DEG)
      if (pt) this.label(placed, text, pt.x, pt.y, 'center', style)
    }

    // Marks just above the horizon so you can always tell which way you face.
    CARDINALS.forEach((name, i) => at(3, i * 90, name, CARDINAL_STYLE))

    for (let a = 15; a <= 75; a += 15) at(a, azNear, `${a}°`, ALTAZ_STYLE)
    for (let d = 0; d < 360; d += 15) {
      if (d % 90 !== 0) at(altNear, d, `${d}°`, ALTAZ_STYLE)
    }
  }

  /** The constellation whose name label is under this screen position, if any. */
  constellationAt(clientX: number, clientY: number): ConstellationMeta | null {
    const origin = this.host.getBoundingClientRect()
    const x = clientX - origin.left
    const y = clientY - origin.top
    const slop = 8 // labels are small; make them easier to hit, especially by touch
    for (const { rect, meta } of this.constellationHits) {
      if (x >= rect.x0 - slop && x <= rect.x1 + slop && y >= rect.y0 - slop && y <= rect.y1 + slop) return meta
    }
    return null
  }

  dispose() {
    this.overlay.remove()
  }

  /** Bounding boxes (overlay CSS px) of UI elements that labels must not cover. */
  private uiRects(): Rect[] {
    const origin = this.host.getBoundingClientRect()
    const pad = 6
    const rects: Rect[] = []
    this.host.parentElement?.querySelectorAll('[data-no-labels]').forEach((el) => {
      const r = el.getBoundingClientRect()
      rects.push({
        x0: r.left - origin.left - pad,
        y0: r.top - origin.top - pad,
        x1: r.right - origin.left + pad,
        y1: r.bottom - origin.top + pad,
      })
    })
    return rects
  }

  /** Screen position (CSS px) of a direction, or null if behind the camera / off screen. */
  private project(altitude: number, azimuth: number): { x: number; y: number } | null {
    const [x, y, z] = horizontalToCartesian(altitude, azimuth, 100)
    this.v.set(x, y, z).project(this.camera)
    if (this.v.z >= 1) return null
    if (Math.abs(this.v.x) > 1.02 || Math.abs(this.v.y) > 1.02) return null
    return {
      x: ((this.v.x + 1) / 2) * this.width,
      y: ((1 - this.v.y) / 2) * this.height,
    }
  }

  private label(
    placed: Rect[],
    text: string,
    x: number,
    y: number,
    align: 'left' | 'center',
    style: { font: string; color: string },
  ): Rect | null {
    const { ctx } = this
    ctx.font = style.font
    const key = style.font + text
    let w = this.widths.get(key)
    if (w === undefined) {
      w = ctx.measureText(text).width
      this.widths.set(key, w)
    }
    const h = 16
    const x0 = align === 'center' ? x - w / 2 : x
    const rect: Rect = { x0: x0 - 3, y0: y - h / 2 - 1, x1: x0 + w + 3, y1: y + h / 2 + 1 }
    // Never draw a label that would be cut off by the screen edge.
    if (rect.x0 < 0 || rect.y0 < 0 || rect.x1 > this.width || rect.y1 > this.height) return null
    for (const r of placed) {
      if (rect.x0 < r.x1 && rect.x1 > r.x0 && rect.y0 < r.y1 && rect.y1 > r.y0) return null
    }
    placed.push(rect)

    ctx.textAlign = align
    ctx.strokeText(text, x, y)
    ctx.fillStyle = style.color
    ctx.fillText(text, x, y)
    return rect
  }
}
