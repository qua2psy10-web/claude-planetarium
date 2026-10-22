import * as THREE from 'three'
import { horizontalToCartesian, degToRad } from '@/engine/astronomy/coordinates'
import type { SatelliteTrack, SatState } from '@/engine/astronomy/satellites'

type Vec3 = [number, number, number]

export interface SatelliteLabel {
  text: string
  /** Unit vector in scene (horizontal) coordinates. */
  dir: Vec3
  color: string
}

/** Beyond this many days from the element epoch the position is meaningless, so nothing is drawn. */
export const MAX_AGE_DAYS = 30
/** Past this the elements are noticeably off, and the label says so. */
export const GOOD_AGE_DAYS = 4

const PATH_BEFORE_SEC = 150
const PATH_AFTER_SEC = 900
const PATH_STEP_SEC = 15

const LIT = '255, 236, 170'
const SHADOW = '150, 170, 205'

/**
 * The ISS: a bright point where it is now (when it is sunlit and the sky is dark enough to see
 * it), and its path across the sky for the next quarter of an hour, solid where it is in
 * sunlight and dotted in Earth's shadow. Drawn on a 2D canvas over the WebGL canvas.
 */
export class SatelliteLayer {
  private overlay: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private host: HTMLCanvasElement
  private camera: THREE.PerspectiveCamera
  private v = new THREE.Vector3()

  private track: SatelliteTrack | null = null
  private enabled = true
  private date = new Date()
  private lat = 35.69
  private lon = 139.69
  private skyLimit = 6.5

  // The path is worked out in whole minutes, so it is not recomputed every frame.
  private pathKey = ''
  private path: { time: number; state: SatState }[] = []
  private labels: SatelliteLabel[] = []
  private current: SatState | null = null

  private width = 0
  private height = 0
  private dpr = 1

  constructor(host: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
    this.host = host
    this.camera = camera
    this.overlay = document.createElement('canvas')
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

  setTrack(track: SatelliteTrack | null) {
    this.track = track
    this.pathKey = ''
  }

  setState(enabled: boolean, date: Date, latDeg: number, lonDeg: number) {
    this.enabled = enabled
    this.date = date
    this.lat = latDeg
    this.lon = lonDeg
  }

  /** Faintest star visible against the current sky. */
  setLimitMag(m: number) {
    this.skyLimit = m
  }

  tickLabels(): SatelliteLabel[] {
    return this.labels
  }

  /** The ISS's state in the last frame (null when disabled or without elements). */
  currentState(): SatState | null {
    return this.current
  }

  /** Call after the WebGL frame has rendered so the camera matrices are current. */
  draw() {
    const { ctx } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    this.labels = []
    this.current = null
    const track = this.track
    if (!this.enabled || !track) return
    const age = Math.abs(track.ageDays(this.date))
    if (age > MAX_AGE_DAYS) return

    const observer = { latDeg: this.lat, lonDeg: this.lon }
    const now = this.date.getTime()
    const state = track.state(this.date, observer)
    this.current = state
    if (!state) return

    // Path: samples around "now", in whole minutes so the work is shared between frames.
    const base = Math.floor(now / 60_000)
    const key = `${base}|${this.lat.toFixed(3)}|${this.lon.toFixed(3)}`
    if (key !== this.pathKey) {
      this.pathKey = key
      const from = base * 60_000 - PATH_BEFORE_SEC * 1000
      this.path = track
        .skyTrack(new Date(from), new Date(from + (PATH_BEFORE_SEC + PATH_AFTER_SEC + 60) * 1000), PATH_STEP_SEC, observer)
        .map((p) => ({ time: p.time.getTime(), state: p.state }))
    }
    const dark = this.skyLimit > 3.5
    if (dark) this.drawPath(now)

    if (state.altitude <= 0) return
    const p = this.project(state.altitude, state.azimuth)
    if (!p) return

    const approx = age > GOOD_AGE_DAYS ? '≈' : ''
    const visible = state.sunlit > 0.5 && state.magnitude !== null && state.magnitude < this.skyLimit
    if (visible) {
      const m = state.magnitude as number
      const radius = Math.max(3, Math.min(9, 4 - m * 0.9))
      const glow = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 3)
      glow.addColorStop(0, `rgba(${LIT}, 0.95)`)
      glow.addColorStop(0.3, `rgba(${LIT}, 0.35)`)
      glow.addColorStop(1, `rgba(${LIT}, 0)`)
      this.ctx.fillStyle = glow
      this.ctx.beginPath()
      this.ctx.arc(p.x, p.y, radius * 3, 0, Math.PI * 2)
      this.ctx.fill()
      this.ctx.fillStyle = '#fffbe8'
      this.ctx.beginPath()
      this.ctx.arc(p.x, p.y, Math.max(1.6, radius * 0.45), 0, Math.PI * 2)
      this.ctx.fill()
      this.labels.push({ text: `ISS${approx} ${m.toFixed(1)}等`, dir: p.dir, color: '#ffeaa0' })
    } else if (dark && state.sunlit <= 0.5) {
      // In Earth's shadow: too dim to see, but worth marking where it is passing.
      this.ctx.strokeStyle = `rgba(${SHADOW}, 0.7)`
      this.ctx.lineWidth = 1.2
      this.ctx.beginPath()
      this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
      this.ctx.stroke()
      this.labels.push({ text: `ISS${approx}（地球の影）`, dir: p.dir, color: '#aebbd6' })
    }
  }

  dispose() {
    this.overlay.remove()
  }

  private project(altDeg: number, azDeg: number): { x: number; y: number; dir: Vec3 } | null {
    const dir = horizontalToCartesian(degToRad(altDeg), degToRad(azDeg), 1) as Vec3
    this.v.set(dir[0], dir[1], dir[2]).project(this.camera)
    if (this.v.z >= 1) return null
    return { x: ((this.v.x + 1) / 2) * this.width, y: ((1 - this.v.y) / 2) * this.height, dir }
  }

  private drawPath(now: number) {
    const { ctx } = this
    ctx.lineCap = 'round'
    let prev: { x: number; y: number } | null = null
    let prevLit = false
    for (const { time, state } of this.path) {
      const p = state.altitude > 0 ? this.project(state.altitude, state.azimuth) : null
      const lit = state.sunlit > 0.5
      if (p && prev) {
        const past = time < now
        ctx.strokeStyle = `rgba(${lit && prevLit ? LIT : SHADOW}, ${past ? 0.25 : lit && prevLit ? 0.6 : 0.4})`
        ctx.lineWidth = lit && prevLit ? 1.6 : 1.1
        ctx.setLineDash(lit && prevLit ? [] : [2, 4])
        ctx.beginPath()
        ctx.moveTo(prev.x, prev.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
      prev = p
      prevLit = lit
    }
    ctx.setLineDash([])
  }
}
