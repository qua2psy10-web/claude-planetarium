import * as THREE from 'three'
import { equatorialToHorizontal, horizontalToCartesian } from '@/engine/astronomy/coordinates'
import { computePlanetTrails, dayIndex, type PlanetTrail, type TrailPoint } from '@/engine/astronomy/planetTrails'
import type { PlanetData } from '@/types/planet'

type Vec3 = [number, number, number]

export interface TrailLabel {
  text: string
  /** Unit vector in scene (horizontal) coordinates. */
  dir: Vec3
  color: string
}

/**
 * Each planet's path among the stars: a solid line for where it has been and a dashed
 * one for where it is going, with a dot and date at the start of some months. The
 * loops of retrograde motion show up as the planet doubles back.
 *
 * The paths are fixed to the stars (right ascension and declination), so they turn with
 * the sky; they are drawn on a 2D canvas over the WebGL canvas.
 */
export class TrailLayer {
  private overlay: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private host: HTMLCanvasElement
  private camera: THREE.PerspectiveCamera
  private v = new THREE.Vector3()

  private enabled = true
  private date = new Date()
  private planets: PlanetData[] = []
  private lst = 0
  private latRad = 0

  private trails: PlanetTrail[] = []
  private trailDay = NaN
  private labels: TrailLabel[] = []

  private width = 0
  private height = 0
  private dpr = 1

  constructor(host: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
    this.host = host
    this.camera = camera
    this.overlay = document.createElement('canvas')
    // Just above the sky, below the Moon (8), meteors (9) and the name labels (10).
    Object.assign(this.overlay.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '7',
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

  setView(lst: number, latRad: number) {
    this.lst = lst
    this.latRad = latRad
  }

  setPlanets(planets: PlanetData[]) {
    this.planets = planets
  }

  /** `date` is the simulated time. The paths are recomputed when it moves to another day. */
  setState(enabled: boolean, date: Date) {
    this.enabled = enabled
    this.date = date
    if (enabled && dayIndex(date) !== this.trailDay) {
      this.trails = computePlanetTrails(date)
      this.trailDay = dayIndex(date)
    }
  }

  /** Date labels for the dots drawn in the last frame, for the label layer to place. */
  tickLabels(): TrailLabel[] {
    return this.labels
  }

  /** Call after the WebGL frame has rendered so the camera matrices are current. */
  draw() {
    const { ctx } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    this.labels = []
    if (!this.enabled) return

    const now = this.date.getTime()
    for (const trail of this.trails) {
      const planet = this.planets.find((p) => p.name === trail.name)
      if (!planet) continue

      // The planet's own position is the join between past and future, so the line passes through it.
      const here: TrailPoint = { time: now, ra: planet.ra, dec: planet.dec, label: null }
      const past = [...trail.points.filter((p) => p.time <= now), here]
      const future = [here, ...trail.points.filter((p) => p.time > now)]
      this.drawPath(past, trail.color, false)
      this.drawPath(future, trail.color, true)
    }
  }

  dispose() {
    this.overlay.remove()
  }

  /** Screen position of a sky position, or null if it is below the horizon or behind the camera. */
  private place(ra: number, dec: number): { x: number; y: number; dir: Vec3 } | null {
    const hor = equatorialToHorizontal(ra, dec, this.lst, this.latRad)
    if (hor.altitude < 0) return null
    const dir = horizontalToCartesian(hor.altitude, hor.azimuth, 1) as Vec3
    this.v.set(dir[0], dir[1], dir[2]).project(this.camera)
    if (this.v.z >= 1) return null
    return { x: ((this.v.x + 1) / 2) * this.width, y: ((1 - this.v.y) / 2) * this.height, dir }
  }

  private drawPath(points: TrailPoint[], color: string, dashed: boolean) {
    const { ctx } = this
    ctx.strokeStyle = color
    ctx.lineWidth = 1.6
    ctx.globalAlpha = dashed ? 0.5 : 0.65
    ctx.lineCap = 'round'
    ctx.setLineDash(dashed ? [5, 4] : [])

    // One stroke per run of visible points: the path is cut where it dips below the horizon.
    let open = false
    ctx.beginPath()
    for (const p of points) {
      const s = this.place(p.ra, p.dec)
      if (!s) {
        open = false
        continue
      }
      if (open) ctx.lineTo(s.x, s.y)
      else ctx.moveTo(s.x, s.y)
      open = true
    }
    ctx.stroke()

    // Dots and dates, on top of the line.
    ctx.setLineDash([])
    ctx.fillStyle = color
    ctx.globalAlpha = 0.9
    for (const p of points) {
      if (!p.label) continue
      const s = this.place(p.ra, p.dec)
      if (!s) continue
      ctx.beginPath()
      ctx.arc(s.x, s.y, 2.4, 0, Math.PI * 2)
      ctx.fill()
      this.labels.push({ text: p.label, dir: s.dir, color })
    }
    ctx.globalAlpha = 1
  }
}
