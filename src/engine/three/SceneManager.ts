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
import { MilkyWay } from './MilkyWay'
import { DsoLayer } from './DsoLayer'
import { SatelliteLayer } from './SatelliteLayer'
import type { SatelliteTrack } from '@/engine/astronomy/satellites'
import { MeteorLayer } from './MeteorLayer'
import { MoonLayer } from './MoonLayer'
import { TrailLayer } from './TrailLayer'
import { AnalemmaLayer } from './AnalemmaLayer'
import { CometLayer } from './CometLayer'
import type { HygStar } from '@/types/star'
import type { ConstellationLines as ConLinesData, ConstellationMeta } from '@/types/constellation'
import type { PlanetData } from '@/types/planet'
import type { EclipseNow } from '@/engine/astronomy/eclipses'
import type { CometElements } from '@/engine/astronomy/comets'
import type { MessierObject } from '@/types/dso'
import { precessionMatrix, type Mat3 } from '@/engine/astronomy/precession'
import { limitingMagnitude, skyColors } from '@/engine/astronomy/skyBrightness'
import { degToRad, horizontalToCartesian } from '@/engine/astronomy/coordinates'

export class SceneManager {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  private skyDome: SkyDome
  private starField: StarField | null = null
  private constellationLines: ConstellationLines | null = null
  /** J2000 -> equinox of date; shared by reference with the star and line shaders. */
  private precessionUniform = new THREE.Matrix3()
  private precession: Mat3 = precessionMatrix(new Date())
  private milkyWay: MilkyWay
  private planetLayer: PlanetLayer
  private horizonMask: HorizonMask
  private cameraController: CameraController
  private labels: LabelLayer
  private equatorialGrid: EquatorialGrid
  private altazGrid: AltazGrid
  private meteors: MeteorLayer
  private moon: MoonLayer
  private trails: TrailLayer
  private analemma: AnalemmaLayer
  private comets: CometLayer
  private dso: DsoLayer
  private satellites: SatelliteLayer
  private pickingManager: PickingManager | null = null
  private atmosphere = true
  /** Faintest star the naked eye sees against the current sky (see skyBrightness.ts). */
  private limitMag = 6.5
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

    this.milkyWay = new MilkyWay(this.precessionUniform)
    this.scene.add(this.milkyWay.mesh)

    this.planetLayer = new PlanetLayer()
    this.scene.add(this.planetLayer.group)

    this.equatorialGrid = new EquatorialGrid()
    this.scene.add(this.equatorialGrid.lineSegments)

    this.altazGrid = new AltazGrid()
    this.scene.add(this.altazGrid.group)

    this.horizonMask = new HorizonMask()
    this.scene.add(this.horizonMask.mesh)

    this.cameraController = new CameraController(this.camera, canvas)
    this.dso = new DsoLayer(canvas, this.camera)
    this.satellites = new SatelliteLayer(canvas, this.camera)
    this.comets = new CometLayer(canvas, this.camera)
    this.analemma = new AnalemmaLayer(canvas, this.camera)
    this.trails = new TrailLayer(canvas, this.camera)
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
    this.starField = new StarField(stars, this.precessionUniform)
    this.starField.setPixelRatio(this.renderer.getPixelRatio())
    this.scene.add(this.starField.points)
    this.labels.setStars(stars)

    // Constellation lines
    if (this.constellationLines) this.scene.remove(this.constellationLines.lineSegments)
    this.constellationLines = new ConstellationLines(stars, linesData, this.precessionUniform)
    this.scene.add(this.constellationLines.lineSegments)

    // Picking
    this.pickingManager = new PickingManager(this.camera, this.canvas)
  }

  updateUniforms(lst: number, latRad: number, fov: number, date: Date) {
    this.precession = precessionMatrix(date)
    this.precessionUniform.set(...this.precession)
    this.labels.setPrecession(this.precession)
    this.dso.setPrecession(this.precession)
    this.dso.setView(lst, latRad, fov)
    const fovScale = 75 / fov  // normalize to base FOV of 75
    this.starField?.updateUniforms(lst, latRad, fovScale)
    this.constellationLines?.updateUniforms(lst, latRad)
    this.milkyWay.updateUniforms(lst, latRad)
    this.equatorialGrid.updateUniforms(lst, latRad)
    this.cameraController.updateFov(fov)
    this.labels.setView(lst, latRad, fov)
    this.meteors.setView(lst, latRad)
    this.moon.setLatitude(latRad)
    this.trails.setView(lst, latRad)
    this.comets.setView(lst, latRad)
  }

  updatePlanets(planets: PlanetData[], showLabels: boolean) {
    this.updateSky(planets.find((p) => p.name === 'Sun'))
    this.planetLayer.update(planets, this.limitMag)
    this.labels.setPlanets(planets, showLabels)
    this.moon.setPlanets(planets)
    this.trails.setPlanets(planets)
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

  setSatelliteTrack(track: SatelliteTrack | null) {
    this.satellites.setTrack(track)
  }

  setSatellites(enabled: boolean, date: Date, latDeg: number, lonDeg: number) {
    this.satellites.setState(enabled, date, latDeg, lonDeg)
  }

  setDeepSkyData(objects: MessierObject[]) {
    this.dso.setData(objects)
  }

  setDeepSkyVisible(v: boolean) {
    this.dso.setEnabled(v)
  }

  setMilkyWayVisible(v: boolean) {
    this.milkyWay.setVisible(v)
  }

  setEquatorialGridVisible(v: boolean) {
    this.equatorialGrid.setVisible(v)
    this.labels.setGridVisible(v)
  }

  /** Planet paths on/off; `date` is the simulated time, around which the paths are drawn. */
  setPlanetTrails(enabled: boolean, date: Date) {
    this.trails.setState(enabled, date)
  }

  /** The Sun's yearly figure of eight at local mean noon, for the observer at `latDeg`, `lonDeg`. */
  setAnalemma(enabled: boolean, date: Date, latDeg: number, lonDeg: number) {
    this.analemma.setState(enabled, date, latDeg, lonDeg)
  }

  setCometData(comets: CometElements[]) {
    this.comets.setData(comets)
  }

  /** Comets on/off; `date` is the simulated time. */
  setComets(enabled: boolean, date: Date) {
    this.comets.setState(enabled, date)
  }

  /** Phase angle of the Moon in degrees (0 = full, 180 = new). */
  setMoonPhase(phaseAngleDeg: number) {
    this.moon.setPhaseAngle(phaseAngleDeg)
  }

  /** Eclipse geometry for this moment (empty when no eclipse is near). */
  setEclipse(eclipse: EclipseNow) {
    this.moon.setEclipse(eclipse)
  }

  /** Shooting stars on/off; `date` is the simulated time, which decides which showers are active. */
  setMeteors(enabled: boolean, date: Date) {
    // Meteors need a dark sky: none are drawn until the Sun is well below the horizon.
    this.meteors.setState(enabled && this.limitMag > 3, date)
  }

  setAltazGridVisible(v: boolean) {
    this.altazGrid.setVisible(v)
    this.labels.setAltazVisible(v)
  }

  setConstellationLinesVisible(v: boolean) {
    if (this.constellationLines) this.constellationLines.lineSegments.visible = v
  }

  setAtmosphere(v: boolean) {
    this.atmosphere = v
  }

  /**
   * Sky colour, ground colour and the limiting magnitude follow the Sun's altitude. With the
   * atmosphere switched off the sky stays dark and every star shows, as in space.
   */
  private updateSky(sun: PlanetData | undefined) {
    const alt = sun?.altitude ?? -90
    const colors = this.atmosphere && sun ? skyColors(alt) : null
    const sunDir = sun ? horizontalToCartesian(degToRad(sun.altitude), degToRad(sun.azimuth), 1) : [0, -1, 0]
    this.skyDome.setSky(colors, sunDir as [number, number, number])
    this.horizonMask.setGround(colors ? colors.horizon.map((c) => c * 0.12) as [number, number, number] : [0, 0, 0])

    this.limitMag = this.atmosphere ? limitingMagnitude(alt) : 6.5
    this.starField?.setLimitMag(this.limitMag)
    this.milkyWay.setLimitMag(this.limitMag)
    this.labels.setLimitMag(this.limitMag)
    this.dso.setLimitMag(this.limitMag)
    this.satellites.setLimitMag(this.limitMag)
    this.comets.setLimitMag(this.limitMag)
  }

  lookAt(azDeg: number, altDeg: number) {
    this.cameraController.lookAt(azDeg, altDeg)
  }

  pick(clientX: number, clientY: number, lst: number, latRad: number, planets: PlanetData[]) {
    if (!this.pickingManager || !this.starField) return null
    return this.pickingManager.pick(clientX, clientY, this.starField.getStars(), planets, this.dso.visibleObjects(), lst, latRad, this.precession, this.limitMag)
  }

  setFrameCallback(fn: () => void) {
    this.frameCallback = fn
  }

  private startLoop() {
    const loop = () => {
      this.rafId = requestAnimationFrame(loop)
      this.frameCallback?.()
      this.renderer.render(this.scene, this.camera)
      this.dso.draw()
      this.satellites.draw()
      this.labels.setSatelliteLabels(this.satellites.tickLabels())
      this.labels.setDeepSkyLabels(this.dso.tickLabels())
      this.comets.draw()
      this.analemma.draw()
      this.trails.draw()
      this.moon.draw()
      this.meteors.draw(performance.now())
      this.labels.setRadiants(this.meteors.markedRadiants())
      this.labels.setTrailLabels([...this.trails.tickLabels(), ...this.analemma.tickLabels(), ...this.comets.tickLabels()])
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
    this.trails.resize()
    this.analemma.resize()
    this.comets.resize()
    this.dso.resize()
    this.satellites.resize()
  }

  dispose() {
    this.stopRenderLoop()
    this.cameraController.dispose()
    this.labels.dispose()
    this.meteors.dispose()
    this.moon.dispose()
    this.trails.dispose()
    this.analemma.dispose()
    this.comets.dispose()
    this.dso.dispose()
    this.satellites.dispose()
    window.removeEventListener('resize', this.onResize)
    this.renderer.dispose()
  }
}
