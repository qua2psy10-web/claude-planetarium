import * as THREE from 'three'
import { equatorialToHorizontal, horizontalToCartesian } from '@/engine/astronomy/coordinates'
import { cometState, tailLengthAU, tailSkyPoints, type CometElements } from '@/engine/astronomy/comets'

type Vec3 = [number, number, number]

export interface CometLabel {
  text: string
  /** Unit vector in scene (horizontal) coordinates. */
  dir: Vec3
  color: string
  below?: boolean
}

/** Comets fainter than this are not drawn: they cannot be seen in binoculars or a small telescope. */
export const DRAW_LIMIT = 10
/** ...and only those brighter than this get a name on the sky. */
const LABEL_LIMIT = 9
const TAIL_SEGMENTS = 8
const RECHECK_HOURS = 6

const HEAD_COLOR = '#d8fff0'
const TAIL_COLOR = '168, 200, 255'
const LABEL_COLOR = '#b8f0d8'

/**
 * Comets: a fuzzy head and, when bright enough, a tail pointing away from the Sun. Their paths come
 * from orbital elements, and what is drawn is every comet predicted to be brighter than magnitude 10.
 *
 * Positions are in right ascension and declination of date, so the layer turns with the sky.
 * Drawn on a 2D canvas over the WebGL canvas.
 */
export class CometLayer {
  private overlay: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private host: HTMLCanvasElement
  private camera: THREE.PerspectiveCamera
  private v = new THREE.Vector3()

  private comets: CometElements[] = []
  private enabled = true
  private date = new Date()
  private lst = 0
  private latRad = 0

  // Comets worth drawing near the current date, found every few simulated hours.
  private candidates: CometElements[] = []
  private checkedAt = NaN
  private labels: CometLabel[] = []

  private width = 0
  private height = 0
  private dpr = 1

  constructor(host: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
    this.host = host
    this.camera = camera
    this.overlay = document.createElement('canvas')
    // Beneath the planet paths (7), the Moon (8), meteors (9) and the name labels (10).
    Object.assign(this.overlay.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '5',
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

  setData(comets: CometElements[]) {
    this.comets = comets
    this.checkedAt = NaN
  }

  setView(lst: number, latRad: number) {
    this.lst = lst
    this.latRad = latRad
  }

  /** `date` is the simulated time. */
  setState(enabled: boolean, date: Date) {
    this.enabled = enabled
    this.date = date
    if (!enabled || this.comets.length === 0) return
    const t = date.getTime()
    if (Number.isNaN(this.checkedAt) || Math.abs(t - this.checkedAt) > RECHECK_HOURS * 3_600_000) {
      // A one-magnitude margin, because the brightness changes while the list is kept.
      this.candidates = this.comets.filter((c) => cometState(c, date).magnitude < DRAW_LIMIT + 1)
      this.checkedAt = t
    }
  }

  /** Names for the comets drawn in the last frame, for the label layer to place. */
  tickLabels(): CometLabel[] {
    return this.labels
  }

  /** Call after the WebGL frame has rendered so the camera matrices are current. */
  draw() {
    const { ctx } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    this.labels = []
    if (!this.enabled) return

    for (const el of this.candidates) {
      const state = cometState(el, this.date)
      if (state.magnitude >= DRAW_LIMIT) continue

      const head = this.place(state.ra, state.dec)
      // Draw the tail even when the head is below the horizon: it can reach up into the sky.
      const tail = tailSkyPoints(state, tailLengthAU(state.magnitude, state.sunDistance), TAIL_SEGMENTS, this.date).map((p) => this.place(p.ra, p.dec))
      this.drawTail(head, tail, state.magnitude)
      if (!head) continue

      const radius = Math.max(2.5, Math.min(12, 2.5 + (DRAW_LIMIT + 0.5 - state.magnitude) * 0.9))
      const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, radius * 2.4)
      glow.addColorStop(0, 'rgba(216, 255, 240, 0.9)')
      glow.addColorStop(0.35, 'rgba(160, 235, 210, 0.35)')
      glow.addColorStop(1, 'rgba(160, 235, 210, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(head.x, head.y, radius * 2.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = HEAD_COLOR
      ctx.beginPath()
      ctx.arc(head.x, head.y, Math.max(1.4, radius * 0.35), 0, Math.PI * 2)
      ctx.fill()

      if (state.magnitude < LABEL_LIMIT) {
        this.labels.push({ text: `${el.nameJa ?? el.name} ${state.magnitude.toFixed(1)}等`, dir: head.dir, color: LABEL_COLOR, below: true })
      }
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

  /** The tail as a run of strokes that thin and fade with distance from the head. */
  private drawTail(
    head: { x: number; y: number } | null,
    tail: ({ x: number; y: number } | null)[],
    magnitude: number,
  ) {
    const { ctx } = this
    const strength = Math.max(0.25, Math.min(1, (DRAW_LIMIT - magnitude) / 6)) // fainter comets, fainter tails
    ctx.lineCap = 'round'
    let from = head
    tail.forEach((p, k) => {
      if (from && p) {
        const t = k / tail.length
        ctx.strokeStyle = `rgba(${TAIL_COLOR}, ${0.7 * strength * (1 - t) ** 1.5})`
        ctx.lineWidth = 1 + 4 * (1 - t) * strength
        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
      from = p
    })
  }
}
