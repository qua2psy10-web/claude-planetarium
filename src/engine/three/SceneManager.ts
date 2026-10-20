import * as THREE from 'three'
import { SkyDome } from './SkyDome'
import { StarField } from './StarField'
import { ConstellationLines } from './ConstellationLines'
import { PlanetLayer } from './PlanetLayer'
import { HorizonMask } from './HorizonMask'
import { CameraController } from './CameraController'
import { PickingManager } from './PickingManager'
import { LabelLayer } from './LabelLayer'
import { EquatorialGrid } from './EquatorialGrid'
import { AltazGrid } from './AltazGrid'
import { MeteorLayer } from './MeteorLayer'
import { MoonLayer } from './MoonLayer'
import type { HygStar } from '@/types/star'
import type { ConstellationLines as ConLinesData, ConstellationMeta } from '@/types/constellation'
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
  private labels: LabelLayer
  private equatorialGrid: EquatorialGrid
  private altazGrid: AltazGrid
  private meteors: MeteorLayer
  private moon: MoonLayer
  private pickingManager: PickingManager | null = null
  private rafId: number | null = null
  private canvas: HTMLCanvasElement
  private frameCallback: (() => void) | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas

    // Use window dimensions as fallback when canvas hasn't been laid out yet
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.setClearColor(0x000000, 1)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000)
    this.camera.position.set(0, 0, 0)

    this.skyDome = new SkyDome()
    this.scene.add(this.skyDome.mesh)

    this.planetLayer = new PlanetLayer()
    this.scene.add(this.planetLayer.group)

    this.equatorialGrid = new EquatorialGrid()
    this.scene.add(this.equatorialGrid.lineSegments)

    this.altazGrid = new AltazGrid()
    this.scene.add(this.altazGrid.group)

    this.horizonMask = new HorizonMask()
    this.scene.add(this.horizonMask.mesh)

    this.cameraController = new CameraController(this.camera, canvas)
    this.moon = new MoonLayer(canvas, this.camera)
    this.meteors = new MeteorLayer(canvas, this.camera)
    this.labels = new LabelLayer(canvas, this.camera)

    window.addEventListener('resize', this.onResize)

    // Start render loop immediately so the sky dome is visible before star data loads
    this.startLoop()
  }

  loadStarData(stars: HygStar[], linesData: ConLinesData) {
    // StarField
    if (this.starField) this.scene.remove(this.starField.points)
    this.starField = new StarField(stars)
    this.starField.setPixelRatio(this.renderer.getPixelRatio())
    this.scene.add(this.starField.points)
    this.labels.setStars(stars)

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
    this.equatorialGrid.updateUniforms(lst, latRad)
    this.cameraController.updateFov(fov)
    this.labels.setView(lst, latRad, fov)
    this.meteors.setView(lst, latRad)
    this.moon.setLatitude(latRad)
  }

  updatePlanets(planets: PlanetData[], showLabels: boolean) {
    this.planetLayer.update(planets, showLabels)
    this.labels.setPlanets(planets, showLabels)
    this.moon.setPlanets(planets)
  }

  setConstellationMeta(meta: ConstellationMeta[]) {
    this.labels.setConstellations(meta)
  }

  setLabelVisibility(constellationNames: boolean, starNames: boolean) {
    this.labels.setVisibility(constellationNames, starNames)
  }

  /** The constellation whose name label is at this screen position, if any. */
  pickConstellation(clientX: number, clientY: number): ConstellationMeta | null {
    return this.labels.constellationAt(clientX, clientY)
  }

  setEquatorialGridVisible(v: boolean) {
    this.equatorialGrid.setVisible(v)
    this.labels.setGridVisible(v)
  }

  /** Phase angle of the Moon in degrees (0 = full, 180 = new). */
  setMoonPhase(phaseAngleDeg: number) {
    this.moon.setPhaseAngle(phaseAngleDeg)
  }

  /** Shooting stars on/off; `date` is the simulated time, which decides which showers are active. */
  setMeteors(enabled: boolean, date: Date) {
    this.meteors.setState(enabled, date)
  }

  setAltazGridVisible(v: boolean) {
    this.altazGrid.setVisible(v)
    this.labels.setAltazVisible(v)
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

  setFrameCallback(fn: () => void) {
    this.frameCallback = fn
  }

  private startLoop() {
    const loop = () => {
      this.rafId = requestAnimationFrame(loop)
      this.frameCallback?.()
      this.renderer.render(this.scene, this.camera)
      this.moon.draw()
      this.meteors.draw(performance.now())
      this.labels.setRadiants(this.meteors.markedRadiants())
      this.labels.draw()
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
    this.labels.resize()
    this.meteors.resize()
    this.moon.resize()
  }

  dispose() {
    this.stopRenderLoop()
    this.cameraController.dispose()
    this.labels.dispose()
    this.meteors.dispose()
    this.moon.dispose()
    window.removeEventListener('resize', this.onResize)
    this.renderer.dispose()
  }
}
