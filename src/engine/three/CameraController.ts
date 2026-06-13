import * as THREE from 'three'
import usePlanetariumStore from '@/store/usePlanetariumStore'

export class CameraController {
  private camera: THREE.PerspectiveCamera
  private canvas: HTMLCanvasElement
  private isDragging = false
  private lastMouse = { x: 0, y: 0 }
  private lastTouch: { x: number; y: number } | null = null
  private lastTouchDist = 0

  // Current spherical view direction
  private az = Math.PI  // azimuth (radians)
  private alt = Math.PI / 4  // altitude (radians)

  private cleanup: (() => void)[] = []

  constructor(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.camera = camera
    this.canvas = canvas
    this.bindEvents()
    this.applyView()
  }

  private bindEvents() {
    const onMouseDown = (e: MouseEvent) => {
      this.isDragging = true
      this.lastMouse = { x: e.clientX, y: e.clientY }
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return
      const dx = e.clientX - this.lastMouse.x
      const dy = e.clientY - this.lastMouse.y
      this.lastMouse = { x: e.clientX, y: e.clientY }
      this.pan(dx, dy)
    }
    const onMouseUp = () => { this.isDragging = false }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const fov = usePlanetariumStore.getState().fov
      const newFov = Math.max(5, Math.min(120, fov + e.deltaY * 0.05))
      usePlanetariumStore.getState().setFov(newFov)
    }
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        this.lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      } else if (e.touches.length === 2) {
        this.lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1 && this.lastTouch) {
        const dx = e.touches[0].clientX - this.lastTouch.x
        const dy = e.touches[0].clientY - this.lastTouch.y
        this.lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        this.pan(dx, dy)
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
        const fov = usePlanetariumStore.getState().fov
        const newFov = Math.max(5, Math.min(120, fov * (this.lastTouchDist / dist)))
        usePlanetariumStore.getState().setFov(newFov)
        this.lastTouchDist = dist
      }
    }
    const onTouchEnd = () => { this.lastTouch = null }

    this.canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    this.canvas.addEventListener('wheel', onWheel, { passive: false })
    this.canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    this.canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    this.canvas.addEventListener('touchend', onTouchEnd)

    this.cleanup = [
      () => this.canvas.removeEventListener('mousedown', onMouseDown),
      () => window.removeEventListener('mousemove', onMouseMove),
      () => window.removeEventListener('mouseup', onMouseUp),
      () => this.canvas.removeEventListener('wheel', onWheel),
      () => this.canvas.removeEventListener('touchstart', onTouchStart),
      () => this.canvas.removeEventListener('touchmove', onTouchMove),
      () => this.canvas.removeEventListener('touchend', onTouchEnd),
    ]
  }

  private pan(dx: number, dy: number) {
    const fov = usePlanetariumStore.getState().fov
    const sensitivity = (fov / 90) * 0.003
    this.az -= dx * sensitivity
    this.alt += dy * sensitivity
    this.alt = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.alt))
    this.applyView()
    usePlanetariumStore.getState().setViewDirection(
      ((this.az * 180) / Math.PI + 360) % 360,
      (this.alt * 180) / Math.PI,
    )
  }

  private applyView() {
    const cosAlt = Math.cos(this.alt)
    const lookX = cosAlt * Math.sin(this.az)
    const lookY = Math.sin(this.alt)
    const lookZ = -cosAlt * Math.cos(this.az)
    this.camera.lookAt(lookX, lookY, lookZ)
  }

  lookAt(azDeg: number, altDeg: number) {
    this.az = (azDeg * Math.PI) / 180
    this.alt = (altDeg * Math.PI) / 180
    this.applyView()
  }

  updateFov(fov: number) {
    this.camera.fov = fov
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.cleanup.forEach((fn) => fn())
  }
}
