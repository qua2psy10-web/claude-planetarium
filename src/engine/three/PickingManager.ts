import * as THREE from 'three'
import type { HygStar } from '@/types/star'
import type { PlanetData } from '@/types/planet'
import { equatorialToHorizontal, horizontalToCartesian, degToRad } from '@/engine/astronomy/coordinates'

interface PickResult {
  type: 'star' | 'planet'
  star?: HygStar
  planet?: PlanetData
  altitude: number
  azimuth: number
}

export class PickingManager {
  private camera: THREE.PerspectiveCamera
  private canvas: HTMLCanvasElement

  constructor(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.camera = camera
    this.canvas = canvas
  }

  pick(
    clientX: number,
    clientY: number,
    stars: HygStar[],
    planets: PlanetData[],
    lst: number,
    latRad: number,
  ): PickResult | null {
    const rect = this.canvas.getBoundingClientRect()
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera)
    const dir = raycaster.ray.direction.clone().normalize()

    const threshold = 0.015  // angular threshold in world space

    let bestDist = Infinity
    let result: PickResult | null = null

    // Check planets first (larger targets)
    for (const planet of planets) {
      if (planet.altitude < -2) continue
      const [x, y, z] = horizontalToCartesian(degToRad(planet.altitude), degToRad(planet.azimuth))
      const pDir = new THREE.Vector3(x, y, z).normalize()
      const dist = dir.distanceTo(pDir)
      if (dist < threshold * 2 && dist < bestDist) {
        bestDist = dist
        result = { type: 'planet', planet, altitude: planet.altitude, azimuth: planet.azimuth }
      }
    }

    // Check stars
    for (const star of stars) {
      const { altitude, azimuth } = equatorialToHorizontal(star.ra, star.dec, lst, latRad)
      if (altitude < -0.02) continue

      const [x, y, z] = horizontalToCartesian(altitude, azimuth)
      const sDir = new THREE.Vector3(x, y, z).normalize()
      const dist = dir.distanceTo(sDir)

      // Larger threshold for brighter stars
      const sizeFactor = Math.max(0.5, 1.0 - star.mag * 0.1)
      const thr = threshold * sizeFactor

      if (dist < thr && dist < bestDist) {
        bestDist = dist
        result = { type: 'star', star, altitude, azimuth }
      }
    }

    return result
  }
}
