import * as THREE from 'three'
import { degToRad, horizontalToCartesian } from '@/engine/astronomy/coordinates'

const RADIUS = 96

/**
 * Horizontal (alt/az) coordinate grid: altitude circles every 15 degrees and
 * azimuth lines every 15 degrees up to the zenith. The horizon and the four
 * cardinal directions are drawn brighter.
 *
 * Alt/az is fixed to the observer, so unlike the equatorial grid the geometry
 * never changes with time or location and needs no shader.
 */
export class AltazGrid {
  group: THREE.Group

  constructor() {
    const normal: number[] = []
    const strong: number[] = []

    const segment = (target: number[], alt1: number, az1: number, alt2: number, az2: number) => {
      target.push(
        ...horizontalToCartesian(degToRad(alt1), degToRad(az1), RADIUS),
        ...horizontalToCartesian(degToRad(alt2), degToRad(az2), RADIUS),
      )
    }

    // Altitude circles (0 = horizon), sampled every 2 degrees of azimuth.
    for (let alt = 0; alt <= 75; alt += 15) {
      const target = alt === 0 ? strong : normal
      for (let az = 0; az < 360; az += 2) segment(target, alt, az, alt, az + 2)
    }

    // Azimuth lines from the horizon to the zenith, sampled every 3 degrees of altitude.
    for (let az = 0; az < 360; az += 15) {
      const target = az % 90 === 0 ? strong : normal
      for (let alt = 0; alt < 90; alt += 3) segment(target, alt, az, alt + 3, az)
    }

    this.group = new THREE.Group()
    this.group.add(this.lines(normal, 0.4))
    this.group.add(this.lines(strong, 0.85))
    this.group.visible = false
  }

  setVisible(v: boolean) {
    this.group.visible = v
  }

  private lines(positions: number[], opacity: number): THREE.LineSegments {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
    const mat = new THREE.LineBasicMaterial({
      color: 0xe0a060,
      transparent: true,
      opacity,
      depthWrite: false,
    })
    const lines = new THREE.LineSegments(geo, mat)
    lines.frustumCulled = false
    return lines
  }
}
