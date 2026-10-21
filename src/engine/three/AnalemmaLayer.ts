import * as THREE from 'three'
import { horizontalToCartesian, degToRad } from '@/engine/astronomy/coordinates'
import { computeAnalemma, localMeanDay, type AnalemmaPoint } from '@/engine/astronomy/analemma'

type Vec3 = [number, number, number]

export interface AnalemmaLabel {
  text: string
  /** Unit vector in scene (horizontal) coordinates. */
  dir: Vec3
  color: string
  /** Put the text below the point instead of above it. */
  below?: boolean
}

const COLOR = '#ffcf5a'

/**
 * The analemma: where the Sun stands at local mean noon on each day of the year, joined
 * into the stretched figure of eight. Dots with dates mark the 1st of each month and a ring
 * marks today.
 *
 * It is fixed to the observer's horizon rather than to the stars, so it stays put while the
 * sky turns. Drawn on a 2D canvas over the WebGL canvas.
 */
export class AnalemmaLayer {
  private overlay: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private host: HTMLCanvasElement
  private camera: THREE.PerspectiveCamera
  private v = new THREE.Vector3()

  private enabled = true
  private points: AnalemmaPoint[] = []
  private dirs: Vec3[] = []
  private todayIndex = 0
  private key = ''
  private labels: AnalemmaLabel[] = []

  private width = 0
  private height = 0
  private dpr = 1

  constructor(host: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
    this.host = host
    this.camera = camera
    this.overlay = document.createElement('canvas')
    // Beneath the planet paths (7) and everything else, just above the sky.
    Object.assign(this.overlay.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '6',
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

  /**
   * `date` is the simulated time. The figure is recomputed when the year (by local mean
   * time) or the observer's position changes; moving through the year only moves the ring.
   */
  setState(enabled: boolean, date: Date, latDeg: number, lonDeg: number) {
    this.enabled = enabled
    if (!enabled) return
    const { year, dayOfYear } = localMeanDay(date, lonDeg)
    const key = `${year}/${latDeg.toFixed(3)}/${lonDeg.toFixed(3)}`
    if (key !== this.key) {
      this.points = computeAnalemma(year, latDeg, lonDeg)
      this.dirs = this.points.map((p) => horizontalToCartesian(degToRad(p.altitude), degToRad(p.azimuth), 1) as Vec3)
      this.key = key
    }
    this.todayIndex = Math.min(dayOfYear, this.points.length - 1)
  }

  /** Date labels for the dots drawn in the last frame, for the label layer to place. */
  tickLabels(): AnalemmaLabel[] {
    return this.labels
  }

  /** Call after the WebGL frame has rendered so the camera matrices are current. */
  draw() {
    const { ctx } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    this.labels = []
    if (!this.enabled || this.points.length === 0) return

    const screen = this.dirs.map((d) => this.project(d))

    // The figure: one run of points per stretch that is above the horizon and in front of the camera.
    ctx.strokeStyle = COLOR
    ctx.globalAlpha = 0.7
    ctx.lineWidth = 1.6
    ctx.lineCap = 'round'
    ctx.beginPath()
    let open = false
    // Go round once more to the first point so the year closes up.
    for (let i = 0; i <= this.points.length; i++) {
      const k = i % this.points.length
      const s = screen[k]
      if (!s || this.points[k].altitude < 0) {
        open = false
        continue
      }
      if (open) ctx.lineTo(s.x, s.y)
      else ctx.moveTo(s.x, s.y)
      open = true
    }
    ctx.stroke()

    // Month starts: a dot and a date.
    ctx.globalAlpha = 0.95
    ctx.fillStyle = COLOR
    this.points.forEach((p, i) => {
      const s = screen[i]
      if (!p.label || !s || p.altitude < 0) return
      ctx.beginPath()
      ctx.arc(s.x, s.y, 2.4, 0, Math.PI * 2)
      ctx.fill()
      this.labels.push({ text: p.label, dir: this.dirs[i], color: COLOR })
    })

    // Today: a ring around that day's point.
    const today = screen[this.todayIndex]
    if (today && this.points[this.todayIndex].altitude >= 0) {
      ctx.globalAlpha = 1
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(today.x, today.y, 6, 0, Math.PI * 2)
      ctx.stroke()
      this.labels.push({ text: '今日', dir: this.dirs[this.todayIndex], color: '#fff3c4' })
    }
    ctx.globalAlpha = 1

    // A name for the figure, under its lowest point: the top of the figure is often up against
    // the search bar, but there is room below.
    let low = 0
    this.points.forEach((p, i) => { if (p.altitude < this.points[low].altitude) low = i })
    if (screen[low] && this.points[low].altitude >= 0) {
      this.labels.push({ text: 'アナレンマ（正午の太陽）', dir: this.dirs[low], color: COLOR, below: true })
    }
  }

  dispose() {
    this.overlay.remove()
  }

  private project(dir: Vec3): { x: number; y: number } | null {
    this.v.set(dir[0], dir[1], dir[2]).project(this.camera)
    if (this.v.z >= 1) return null
    return { x: ((this.v.x + 1) / 2) * this.width, y: ((1 - this.v.y) / 2) * this.height }
  }
}
