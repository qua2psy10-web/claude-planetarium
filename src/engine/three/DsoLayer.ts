import * as THREE from 'three'
import type { DsoType, MessierObject } from '@/types/dso'
import { equatorialToHorizontal, horizontalToCartesian } from '@/engine/astronomy/coordinates'
import { precessRaDec, IDENTITY, type Mat3 } from '@/engine/astronomy/precession'

type Vec3 = [number, number, number]

export interface DsoLabel {
  text: string
  /** Unit vector in scene (horizontal) coordinates. */
  dir: Vec3
  /** Radius of the symbol in CSS pixels, so the name can sit just outside it. */
  radiusPx: number
  /** Bright enough to be named before the star names compete for the space. */
  bright: boolean
}

const DEG = Math.PI / 180

const GALAXY = '255, 154, 154'
const CLUSTER = '255, 224, 138'
const NEBULA = '127, 232, 168'
const PLANETARY = '127, 224, 232'

const COLOR: Record<DsoType, string> = {
  s: GALAXY, e: GALAXY, i: GALAXY,
  oc: CLUSTER, gc: CLUSTER, pos: CLUSTER,
  sfr: NEBULA, rn: NEBULA, snr: NEBULA,
  pn: PLANETARY,
}

/** Faintest Messier object drawn at the given field of view: more appear as you zoom in. */
export function dsoMagnitudeLimit(fov: number): number {
  return Math.max(5.5, Math.min(11, 5.5 + 2.2 * Math.log2(75 / fov)))
}

/**
 * Messier objects: a symbol per object (galaxy ellipse, open cluster dashed circle, globular
 * cluster circle with cross, nebula square, planetary nebula circle with ticks), sized by the
 * object's real angular size when zoomed in. Names are handed to the label layer.
 * Drawn on a 2D canvas over the WebGL canvas, under the comets (5).
 */
export class DsoLayer {
  private overlay: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private host: HTMLCanvasElement
  private camera: THREE.PerspectiveCamera
  private v = new THREE.Vector3()

  private objects: MessierObject[] = []
  private enabled = true
  private lst = 0
  private latRad = 0
  private fov = 75
  private skyLimit = 6.5
  private precession: Mat3 = IDENTITY

  private labels: DsoLabel[] = []
  private shown: MessierObject[] = []

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
      zIndex: '4',
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

  setData(objects: MessierObject[]) {
    this.objects = objects
  }

  setPrecession(m: Mat3) {
    this.precession = m
  }

  setView(lst: number, latRad: number, fov: number) {
    this.lst = lst
    this.latRad = latRad
    this.fov = fov
  }

  /** Faintest star visible against the current sky; diffuse objects need about a magnitude more. */
  setLimitMag(m: number) {
    this.skyLimit = m
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  /** Names for the objects drawn in the last frame, brightest first. */
  tickLabels(): DsoLabel[] {
    return this.labels
  }

  /** Objects drawn in the last frame, for picking. */
  visibleObjects(): MessierObject[] {
    return this.shown
  }

  /** Call after the WebGL frame has rendered so the camera matrices are current. */
  draw() {
    const { ctx } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    this.labels = []
    this.shown = []
    if (!this.enabled) return

    const limit = Math.min(dsoMagnitudeLimit(this.fov), this.skyLimit - 1)
    const pxPerArcmin = (this.height / 2 / Math.tan((this.fov * DEG) / 2)) * (DEG / 60)

    for (const o of this.objects) {
      if (o.mag > limit) break // sorted brightest first
      const p = this.place(o)
      if (!p) continue

      const a = Math.max(4.5, (o.size / 2) * pxPerArcmin)
      const b = Math.max(3.2, (o.sizeMinor / 2) * pxPerArcmin)
      this.drawSymbol(o.type, p.x, p.y, a, Math.min(a, b))
      this.shown.push(o)
      this.labels.push({
        text: o.nameJa ? `${o.id} ${o.nameJa}` : o.id,
        dir: p.dir,
        radiusPx: Math.min(a, 90),
        bright: o.mag < 4.5,
      })
    }
  }

  dispose() {
    this.overlay.remove()
  }

  /** Screen position, or null if the object is below the horizon or behind the camera. */
  private place(o: MessierObject): { x: number; y: number; dir: Vec3 } | null {
    const eq = precessRaDec(o.ra, o.dec, this.precession)
    const hor = equatorialToHorizontal(eq.ra, eq.dec, this.lst, this.latRad)
    if (hor.altitude < 0) return null
    const dir = horizontalToCartesian(hor.altitude, hor.azimuth, 1) as Vec3
    this.v.set(dir[0], dir[1], dir[2]).project(this.camera)
    if (this.v.z >= 1) return null
    const x = ((this.v.x + 1) / 2) * this.width
    const y = ((1 - this.v.y) / 2) * this.height
    // Off screen by more than the symbol could reach.
    if (x < -200 || x > this.width + 200 || y < -200 || y > this.height + 200) return null
    return { x, y, dir }
  }

  private drawSymbol(type: DsoType, x: number, y: number, a: number, b: number) {
    const { ctx } = this
    const rgb = COLOR[type]
    ctx.lineWidth = 1.2
    ctx.strokeStyle = `rgba(${rgb}, 0.85)`
    ctx.setLineDash([])

    // A faint glow stands in for the object itself.
    const glow = ctx.createRadialGradient(x, y, 0, x, y, a)
    glow.addColorStop(0, `rgba(${rgb}, 0.22)`)
    glow.addColorStop(1, `rgba(${rgb}, 0)`)
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, a, 0, Math.PI * 2)
    ctx.fill()

    switch (type) {
      case 's':
      case 'e':
      case 'i':
        ctx.beginPath()
        ctx.ellipse(x, y, a, b, -0.4, 0, Math.PI * 2)
        ctx.stroke()
        break
      case 'oc':
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.arc(x, y, a, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
        break
      case 'gc':
        ctx.beginPath()
        ctx.arc(x, y, a, 0, Math.PI * 2)
        ctx.moveTo(x - a, y)
        ctx.lineTo(x + a, y)
        ctx.moveTo(x, y - a)
        ctx.lineTo(x, y + a)
        ctx.stroke()
        break
      case 'pn': {
        const r = Math.max(3, a * 0.7)
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          ctx.moveTo(x + dx * r, y + dy * r)
          ctx.lineTo(x + dx * (r + 4), y + dy * (r + 4))
        }
        ctx.stroke()
        break
      }
      case 'pos':
        ctx.beginPath()
        ctx.moveTo(x, y - a)
        ctx.lineTo(x + a, y)
        ctx.lineTo(x, y + a)
        ctx.lineTo(x - a, y)
        ctx.closePath()
        ctx.stroke()
        break
      default: // diffuse nebulae and supernova remnants
        ctx.strokeRect(x - a, y - a, a * 2, a * 2)
    }
  }
}
