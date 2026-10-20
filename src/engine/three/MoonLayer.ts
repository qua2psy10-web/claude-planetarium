import * as THREE from 'three'
import { horizontalToCartesian, degToRad } from '@/engine/astronomy/coordinates'
import { moveAlong, tangentAwayFrom, type Vec3 } from '@/engine/astronomy/meteors'
import { moonDiskRadiusPx } from '@/engine/astronomy/moonPhase'
import type { PlanetData } from '@/types/planet'

// Dark maria on the Moon's face, as seen by the naked eye from the northern hemisphere with
// north up: [x, y, radius] in units of the Moon's radius, x to the right, y down.
const MARIA: [number, number, number][] = [
  [-0.62, -0.05, 0.3], // Oceanus Procellarum
  [-0.3, -0.38, 0.26], // Mare Imbrium
  [0.1, -0.4, 0.17], // Mare Serenitatis
  [0.3, -0.1, 0.2], // Mare Tranquillitatis
  [0.6, -0.22, 0.11], // Mare Crisium
  [0.62, 0.12, 0.14], // Mare Fecunditatis
  [0.28, 0.2, 0.08], // Mare Nectaris
  [-0.22, 0.38, 0.17], // Mare Nubium
  [-0.58, 0.35, 0.1], // Mare Humorum
]

const NEARBY = 0.02 // radians: how far along a direction to look when working out its on-screen angle

/**
 * Draws the Moon with its current phase on a 2D canvas over the WebGL canvas.
 * The bright side faces the Sun and the face is turned to match celestial north, both
 * taken from the real directions on the sky, so the phase looks as it does outside.
 */
export class MoonLayer {
  private overlay: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private host: HTMLCanvasElement
  private camera: THREE.PerspectiveCamera
  private v = new THREE.Vector3()

  private planets: PlanetData[] = []
  private phaseAngle = 180 // degrees; 0 = full, 180 = new
  private latRad = 0

  private width = 0
  private height = 0
  private dpr = 1

  constructor(host: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
    this.host = host
    this.camera = camera
    this.overlay = document.createElement('canvas')
    // Above the sky, below the meteors (9) and the name labels (10).
    Object.assign(this.overlay.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '8',
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

  setPlanets(planets: PlanetData[]) {
    this.planets = planets
  }

  setLatitude(latRad: number) {
    this.latRad = latRad
  }

  /** Phase angle in degrees: 0 at full moon, 180 at new moon. */
  setPhaseAngle(deg: number) {
    this.phaseAngle = deg
  }

  /** Call after the WebGL frame has rendered so the camera matrices are current. */
  draw() {
    const { ctx } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)

    const moon = this.planets.find((p) => p.name === 'Moon')
    if (!moon || moon.altitude < 0) return

    const m = this.direction(moon)
    const centre = this.project(m)
    if (!centre) return
    const radius = moonDiskRadiusPx(this.camera.fov, this.height)
    if (centre.x < -radius || centre.x > this.width + radius || centre.y < -radius || centre.y > this.height + radius) return

    // Which way the Sun lies from the Moon, and which way celestial north does, on screen.
    const sun = this.planets.find((p) => p.name === 'Sun')
    const sunAngle = sun ? this.screenAngleToward(m, centre, this.direction(sun)) : null
    const northPole = horizontalToCartesian(this.latRad, 0, 1) as Vec3
    const northAngle = this.screenAngleToward(m, centre, northPole) ?? -Math.PI / 2

    this.drawMoon(centre.x, centre.y, radius, sunAngle ?? 0, northAngle)
  }

  dispose() {
    this.overlay.remove()
  }

  private direction(p: PlanetData): Vec3 {
    return horizontalToCartesian(degToRad(p.altitude), degToRad(p.azimuth), 1) as Vec3
  }

  private project(dir: Vec3): { x: number; y: number } | null {
    this.v.set(dir[0], dir[1], dir[2]).project(this.camera)
    if (this.v.z >= 1) return null
    return { x: ((this.v.x + 1) / 2) * this.width, y: ((1 - this.v.y) / 2) * this.height }
  }

  /**
   * Screen angle (radians, y down) of the direction from the Moon towards `target`,
   * found by stepping a little way along the great circle between them. Null if the
   * two coincide.
   */
  private screenAngleToward(moon: Vec3, moonScreen: { x: number; y: number }, target: Vec3): number | null {
    const away = tangentAwayFrom(target, moon)
    if (!away) return null
    const towards: Vec3 = [-away[0], -away[1], -away[2]]
    const next = this.project(moveAlong(moon, towards, NEARBY))
    if (!next) return null
    return Math.atan2(next.y - moonScreen.y, next.x - moonScreen.x)
  }

  private drawMoon(x: number, y: number, r: number, sunAngle: number, northAngle: number) {
    const { ctx } = this
    const phase = degToRad(this.phaseAngle)
    const lit = (1 + Math.cos(phase)) / 2 // lit fraction of the disk

    ctx.save()
    ctx.translate(x, y)

    // Halo, stronger the fuller the Moon is.
    const halo = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 2.6)
    halo.addColorStop(0, `rgba(230, 235, 255, ${0.16 * lit})`)
    halo.addColorStop(1, 'rgba(230, 235, 255, 0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2)
    ctx.fill()

    // The unlit part of the disk, dimly visible against the sky (earthshine).
    ctx.fillStyle = 'rgb(30, 35, 48)'
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(140, 150, 175, 0.25)'
    ctx.lineWidth = 1
    ctx.stroke()

    // The lit part. In a frame where +x points at the Sun, it is the half disk on the +x side
    // plus (gibbous) or minus (crescent) half an ellipse whose width follows cos(phase angle).
    ctx.save()
    ctx.rotate(sunAngle)
    const k = Math.cos(phase)
    ctx.beginPath()
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false)
    if (k >= 0) ctx.ellipse(0, 0, k * r, r, 0, Math.PI / 2, (3 * Math.PI) / 2, false)
    else ctx.ellipse(0, 0, -k * r, r, 0, Math.PI / 2, -Math.PI / 2, true)
    ctx.closePath()
    ctx.restore()
    ctx.clip()

    const surface = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r)
    surface.addColorStop(0, '#f7f2e2')
    surface.addColorStop(1, '#d9d2bc')
    ctx.fillStyle = surface
    ctx.fillRect(-r, -r, 2 * r, 2 * r)

    // Maria, turned so the face's "up" points towards celestial north on screen.
    ctx.rotate(northAngle + Math.PI / 2)
    for (const [mx, my, mr] of MARIA) {
      const g = ctx.createRadialGradient(mx * r, my * r, 0, mx * r, my * r, mr * r)
      g.addColorStop(0, 'rgba(110, 112, 122, 0.5)')
      g.addColorStop(1, 'rgba(110, 112, 122, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(mx * r, my * r, mr * r, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }
}
