import * as THREE from 'three'
import { SkyDome } from './SkyDome'
import { StarField } from './StarField'
import { ConstellationLines } from './ConstellationLines'
import { PlanetLayer } from './PlanetLayer'
import { HorizonMask } from './HorizonMask'
import { CameraController } from './CameraController'
import { PickingManager } from './PickingManager'
import type { HygStar } from '@/types/star'
import type { ConstellationLines as ConLinesData } from '@/types/constellation'
import type { PlanetData } from '@/types/planet'

export class SceneManager {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  private skyDome: SkyDome
  private starField: StarField | null = null
  private constellationLines: ConstellationLines | null = null
  private planetLayer: PlanetLayer
  private horizonMask: HorizonMask
  private cameraController: CameraController
  private pickingManager: PickingManager | null = null
  private rafId: number | null = null
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    this.renderer.setClearColor(0x000000, 1)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000)
    this.camera.position.set(0, 0, 0)

    this.skyDome = new SkyDome()
    this.scene.add(this.skyDome.mesh)

    this.planetLayer = new PlanetLayer()
    this.scene.add(this.planetLayer.group)

    this.horizonMask = new HorizonMask()
    this.scene.add(this.horizonMask.mesh)

    this.cameraController = new CameraController(this.camera, canvas)

    window.addEventListener('resize', this.onResize)
  }

  loadStarData(stars: HygStar[], linesData: ConLinesData) {
    // StarField
    if (this.starField) this.scene.remove(this.starField.points)
    this.starField = new StarField(stars)
    this.scene.add(this.starField.points)

    // Constellation lines
    if (this.constellationLines) this.scene.remove(this.constellationLines.lineSegments)
    this.constellationLines = new ConstellationLines(stars, linesData)
    this.scene.add(this.constellationLines.lineSegments)

    // Picking
    this.pickingManager = new PickingManager(this.camera, this.canvas)
  }

  updateUniforms(lst: number, latRad: number, fov: number) {
    const fovScale = 75 / fov  // normalize to base FOV of 75
    this.starField?.updateUniforms(lst, latRad, fovScale)
    this.constellationLines?.updateUniforms(lst, latRad)
    this.cameraController.updateFov(fov)
  }

  updatePlanets(planets: PlanetData[], showLabels: boolean) {
    this.planetLayer.update(planets, showLabels)
  }

  setConstellationLinesVisible(v: boolean) {
    if (this.constellationLines) this.constellationLines.lineSegments.visible = v
  }

  setAtmosphere(v: boolean) {
    this.skyDome.setAtmosphere(v)
  }

  lookAt(azDeg: number, altDeg: number) {
    this.cameraController.lookAt(azDeg, altDeg)
  }

  pick(clientX: number, clientY: number, lst: number, latRad: number, planets: PlanetData[]) {
    if (!this.pickingManager || !this.starField) return null
    return this.pickingManager.pick(clientX, clientY, this.starField.getStars(), planets, lst, latRad)
  }

  startRenderLoop(onFrame: () => void) {
    const loop = () => {
      this.rafId = requestAnimationFrame(loop)
      onFrame()
      this.renderer.render(this.scene, this.camera)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  stopRenderLoop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
  }

  private onResize = () => {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  dispose() {
    this.stopRenderLoop()
    this.cameraController.dispose()
    window.removeEventListener('resize', this.onResize)
    this.renderer.dispose()
  }
}
