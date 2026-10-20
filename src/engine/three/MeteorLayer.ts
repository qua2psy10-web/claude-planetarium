import * as THREE from 'three'
import { equatorialToHorizontal, horizontalToCartesian, degToRad } from '@/engine/astronomy/coordinates'
import {
  activeShowers,
  angleBetween,
  moveAlong,
  randomTangent,
  tangentAwayFrom,
  type MeteorShower,
  type Vec3,
} from '@/engine/astronomy/meteors'

// Meteors per second when watching. Real rates are far lower (a good shower gives
// one every minute or so); this is a display, so it is exaggerated to be seen.
const SPORADIC_RATE = 0.08
const SHOWER_RATE = 0.25 // for a shower with ZHR 100 and its radiant at the zenith
const MAX_METEORS = 12

// Radiant marks are only drawn for showers at least this active.
const RADIANT_MARK_STRENGTH = 0.3

interface Meteor {
  point: Vec3 // where the meteor appears
  heading: Vec3 // unit tangent at `point`: the way it travels
  length: number // radians of sky it crosses
  start: number // ms
  life: number // ms
  width: number // px
  brightness: number // 0..1
}

interface Radiant {
  shower: MeteorShower
  strength: number
  dir: Vec3 // unit vector in scene (horizontal) coordinates
}

/**
 * Shooting stars: short streaks across the sky, drawn on a 2D canvas over the
 * WebGL canvas. While a meteor shower is active (by the simulated date) the
 * meteors fly away from its radiant; otherwise they go in random directions.
 */
export class MeteorLayer {
  private overlay: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private host: HTMLCanvasElement
  private camera: THREE.PerspectiveCamera
  private v = new THREE.Vector3()
  private meteors: Meteor[] = []
  private lastTime = 0
  private marked: { text: string; dir: Vec3 }[] = []

  private enabled = true
  private date = new Date()
  private lst = 0
  private latRad = 0

  private width = 0
  private height = 0
  private dpr = 1

  constructor(host: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
    this.host = host
    this.camera = camera
    this.overlay = document.createElement('canvas')
    // Above the sky, below the name labels (z-index 10) and the React UI.
    Object.assign(this.overlay.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '9',
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

  /** `date` is the simulated time, which decides which showers are active. */
  setState(enabled: boolean, date: Date) {
    this.enabled = enabled
    this.date = date
    if (!enabled) {
      this.meteors = []
      this.marked = []
    }
  }

  /** Call once per frame with a millisecond clock (e.g. performance.now()). */
  draw(now: number) {
    const { ctx } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)

    // Real time, not simulated time: a fast-forwarded clock must not make meteors
    // flicker by. Cap the step so a background tab does not spawn a burst on return.
    const dt = Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000))
    this.lastTime = now
    if (!this.enabled) return

    const radiants = this.radiants()
    this.marked = radiants
      .filter((r) => r.strength >= RADIANT_MARK_STRENGTH && r.dir[1] >= 0.02)
      .map((r) => ({ text: `${r.shower.nameJa}の放射点`, dir: r.dir }))
    this.spawn(dt, now, radiants)
    this.meteors = this.meteors.filter((m) => now - m.start < m.life)

    ctx.globalCompositeOperation = 'lighter'
    for (const m of this.meteors) this.drawMeteor(m, now)
    ctx.globalCompositeOperation = 'source-over'

    for (const r of radiants) this.drawRadiant(r)
  }

  /**
   * Radiants worth naming on screen. The ring is drawn here, but the text is left
   * to the label layer so it can avoid overlapping star and constellation names.
   */
  markedRadiants(): { text: string; dir: Vec3 }[] {
    return this.marked
  }

  dispose() {
    this.overlay.remove()
  }

  /** Active showers with their radiants placed in the current sky. */
  private radiants(): Radiant[] {
    return activeShowers(this.date).map(({ shower, strength }) => {
      const hor = equatorialToHorizontal(degToRad(shower.raDeg), degToRad(shower.decDeg), this.lst, this.latRad)
      const [x, y, z] = horizontalToCartesian(hor.altitude, hor.azimuth, 1)
      return { shower, strength, dir: [x, y, z] as Vec3 }
    })
  }

  private spawn(dt: number, now: number, radiants: Radiant[]) {
    if (this.meteors.length >= MAX_METEORS) return

    // A shower only produces meteors while its radiant is above the horizon.
    const weights = radiants.map((r) => (SHOWER_RATE * r.shower.zhr * r.strength * Math.max(0, r.dir[1])) / 100)
    const total = SPORADIC_RATE + weights.reduce((a, b) => a + b, 0)
    if (Math.random() >= total * dt) return

    // Pick which source this meteor comes from, in proportion to its rate.
    let pick = Math.random() * total
    let source: Radiant | null = null
    if (pick >= SPORADIC_RATE) {
      pick -= SPORADIC_RATE
      for (let i = 0; i < weights.length; i++) {
        if (pick < weights[i]) { source = radiants[i]; break }
        pick -= weights[i]
      }
    }

    // Start somewhere inside the view, so the meteor is actually seen.
    for (let attempt = 0; attempt < 10; attempt++) {
      const ndcX = (Math.random() * 2 - 1) * 0.9
      const ndcY = (Math.random() * 2 - 1) * 0.9
      this.v.set(ndcX, ndcY, 0.5).unproject(this.camera).normalize()
      const point: Vec3 = [this.v.x, this.v.y, this.v.z]
      if (point[1] < 0.08) continue // keep it clear of the horizon

      let heading: Vec3 | null
      let length: number
      if (source) {
        // Meteors near the radiant are foreshortened and short; they lengthen away from it.
        const away = angleBetween(source.dir, point)
        if (away < degToRad(10) || away > degToRad(85)) continue
        heading = tangentAwayFrom(source.dir, point)
        length = degToRad(5 + Math.random() * 9) * (0.4 + 0.6 * Math.sin(away))
      } else {
        heading = randomTangent(point)
        length = degToRad(6 + Math.random() * 10)
      }
      if (!heading) continue

      this.meteors.push({
        point,
        heading,
        length,
        start: now,
        life: 500 + Math.random() * 600,
        width: 1.2 + Math.random() * 1.2,
        brightness: 0.55 + Math.random() * 0.45,
      })
      return
    }
  }

  /** Screen position of a direction in scene coordinates, or null if behind the camera. */
  private project(dir: Vec3): { x: number; y: number } | null {
    this.v.set(dir[0], dir[1], dir[2]).project(this.camera)
    if (this.v.z >= 1) return null
    return { x: ((this.v.x + 1) / 2) * this.width, y: ((1 - this.v.y) / 2) * this.height }
  }

  private drawMeteor(m: Meteor, now: number) {
    const { ctx } = this
    const t = (now - m.start) / m.life // 0..1
    const headAngle = m.length * t
    const tailAngle = Math.max(0, headAngle - m.length * 0.55)
    const head = moveAlong(m.point, m.heading, headAngle)
    const tail = moveAlong(m.point, m.heading, tailAngle)
    if (head[1] < 0) return // below the horizon

    const h = this.project(head)
    const tl = this.project(tail)
    if (!h || !tl) return

    // Fade in quickly, then out; the streak is brightest at the head.
    const fade = Math.sin(Math.PI * Math.min(1, t)) ** 0.6 * m.brightness
    const grad = ctx.createLinearGradient(tl.x, tl.y, h.x, h.y)
    grad.addColorStop(0, 'rgba(255, 240, 200, 0)')
    grad.addColorStop(1, `rgba(255, 250, 230, ${fade})`)
    ctx.strokeStyle = grad
    ctx.lineWidth = m.width
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(tl.x, tl.y)
    ctx.lineTo(h.x, h.y)
    ctx.stroke()

    ctx.fillStyle = `rgba(255, 255, 240, ${fade})`
    ctx.beginPath()
    ctx.arc(h.x, h.y, m.width * 0.9, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawRadiant(r: Radiant) {
    if (r.strength < RADIANT_MARK_STRENGTH || r.dir[1] < 0.02) return
    const pt = this.project(r.dir)
    if (!pt || pt.x < 0 || pt.x > this.width || pt.y < 0 || pt.y > this.height) return

    const { ctx } = this
    ctx.strokeStyle = 'rgba(255, 159, 90, 0.9)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
}
