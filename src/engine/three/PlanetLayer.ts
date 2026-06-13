import * as THREE from 'three'
import type { PlanetData } from '@/types/planet'
import { degToRad, horizontalToCartesian } from '@/engine/astronomy/coordinates'

const PLANET_COLORS: Record<string, number> = {
  Sun: 0xffffaa,
  Moon: 0xddddcc,
  Mercury: 0xaaaaaa,
  Venus: 0xffe0a0,
  Mars: 0xff6633,
  Jupiter: 0xffddaa,
  Saturn: 0xeecc88,
}

const PLANET_SIZES: Record<string, number> = {
  Sun: 24,
  Moon: 20,
  Mercury: 6,
  Venus: 10,
  Mars: 7,
  Jupiter: 12,
  Saturn: 11,
}

export class PlanetLayer {
  group: THREE.Group
  private sprites: Map<string, THREE.Sprite> = new Map()
  constructor() {
    this.group = new THREE.Group()
  }

  update(planets: PlanetData[], _showLabels: boolean) {

    // Remove old sprites not in current list
    const names = new Set(planets.map((p) => p.name))
    for (const [name, sprite] of this.sprites) {
      if (!names.has(name)) {
        this.group.remove(sprite)
        this.sprites.delete(name)
      }
    }

    for (const planet of planets) {
      if (planet.altitude < -2) {
        const s = this.sprites.get(planet.name)
        if (s) s.visible = false
        continue
      }

      let sprite = this.sprites.get(planet.name)
      if (!sprite) {
        const map = this.createPlanetTexture(planet.name)
        const mat = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
        sprite = new THREE.Sprite(mat)
        this.sprites.set(planet.name, sprite)
        this.group.add(sprite)
      }

      const [x, y, z] = horizontalToCartesian(degToRad(planet.altitude), degToRad(planet.azimuth), 95)
      sprite.position.set(x, y, z)
      sprite.visible = true
      const size = (PLANET_SIZES[planet.name] ?? 8) * 0.1
      sprite.scale.setScalar(size)
    }
  }

  private createPlanetTexture(name: string): THREE.CanvasTexture {
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const color = PLANET_COLORS[name] ?? 0xffffff
    const r = (color >> 16) & 0xff
    const g = (color >> 8) & 0xff
    const b = color & 0xff

    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`)
    grad.addColorStop(0.4, `rgba(${r},${g},${b},0.6)`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`)

    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)

    return new THREE.CanvasTexture(canvas)
  }
}
