import { useEffect, useRef, useCallback } from 'react'
import { SceneManager } from '@/engine/three/SceneManager'
import { loadStars } from '@/engine/data/starLoader'
import { loadConstellationLines } from '@/engine/data/constellationLoader'
import { getPlanetPositions } from '@/engine/astronomy/planets'
import { computeLST } from '@/engine/astronomy/time'
import { getMoonPhaseAngle } from '@/engine/astronomy/moonPhase'
import { eclipseNow } from '@/engine/astronomy/eclipses'
import { degToRad, radToDeg, equatorialToHorizontal } from '@/engine/astronomy/coordinates'
import { buildSearchIndex } from '@/engine/data/searchIndex'
import { loadConstellationMeta } from '@/engine/data/constellationLoader'
import usePlanetariumStore from '@/store/usePlanetariumStore'
import type { PlanetData } from '@/types/planet'

export default function PlanetariumCanvas({ onLoaded }: { onLoaded?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<SceneManager | null>(null)
  const planetsRef = useRef<PlanetData[]>([])
  const lastFrameRef = useRef<number>(Date.now())
  // Keep onLoaded in a ref so it never needs to be a useEffect dependency
  const onLoadedRef = useRef(onLoaded)
  onLoadedRef.current = onLoaded

  const store = usePlanetariumStore()

  // Stable refs for hot state used in RAF loop
  const storeRef = useRef(store)
  storeRef.current = store

  const onFrame = useCallback(() => {
    const s = storeRef.current
    const now = Date.now()
    const dt = (now - lastFrameRef.current) / 1000
    lastFrameRef.current = now

    let simTime = s.simulatedTime
    if (s.isPlaying && s.playbackSpeed !== 0) {
      simTime = new Date(simTime.getTime() + dt * s.playbackSpeed * 1000)
      s.setTime(simTime)
    }

    const lst = computeLST(simTime, s.longitude)
    const latRad = degToRad(s.latitude)

    // Update scene every frame (uniforms are cheap)
    sceneRef.current?.updateUniforms(lst, latRad, s.fov)

    // Update planet positions (cheap via astronomy-engine)
    const planets = getPlanetPositions(simTime, s.latitude, s.longitude)
    planetsRef.current = planets
    sceneRef.current?.updatePlanets(planets, s.showPlanetLabels)
    const phaseAngle = getMoonPhaseAngle(simTime)
    sceneRef.current?.setMoonPhase(phaseAngle)
    sceneRef.current?.setEclipse(eclipseNow(simTime, s.latitude, s.longitude, phaseAngle))
    sceneRef.current?.setConstellationLinesVisible(s.showConstellationLines)
    sceneRef.current?.setLabelVisibility(s.showConstellationNames, s.showStarNames)
    sceneRef.current?.setEquatorialGridVisible(s.showEquatorialGrid)
    sceneRef.current?.setAltazGridVisible(s.showAltazGrid)
    sceneRef.current?.setMeteors(s.showMeteors, simTime)
    sceneRef.current?.setPlanetTrails(s.showPlanetTrails, simTime)
    sceneRef.current?.setAnalemma(s.showAnalemma, simTime, s.latitude, s.longitude)
    sceneRef.current?.setAtmosphere(s.showAtmosphere)
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return

    const scene = new SceneManager(canvasRef.current)
    sceneRef.current = scene

    // Load data async, then start render loop
    Promise.all([loadStars(), loadConstellationLines(), loadConstellationMeta()]).then(
      ([stars, lines, meta]) => {
        scene.loadStarData(stars, lines)
        scene.setConstellationMeta(meta)
        buildSearchIndex(stars, meta)
        lastFrameRef.current = Date.now()
        scene.setFrameCallback(onFrame)
        onLoadedRef.current?.()
      },
    )

    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [onFrame])

  // Sync FOV changes from store
  useEffect(() => {
    sceneRef.current?.updateUniforms(
      computeLST(store.simulatedTime, store.longitude),
      degToRad(store.latitude),
      store.fov,
    )
  }, [store.fov, store.latitude, store.longitude, store.simulatedTime])

  // Handle click → picking
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // A drag (panning the view) also ends in a click; don't treat it as a selection.
      const down = pointerDownRef.current
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return

      const s = storeRef.current
      const lst = computeLST(s.simulatedTime, s.longitude)
      const result = sceneRef.current?.pick(e.clientX, e.clientY, lst, degToRad(s.latitude), planetsRef.current)
      if (result) {
        if (result.type === 'star' && result.star) {
          s.selectObject({ type: 'star', star: result.star, altitude: result.altitude, azimuth: result.azimuth })
        } else if (result.type === 'planet' && result.planet) {
          s.selectObject({ type: 'planet', planet: result.planet, altitude: result.altitude, azimuth: result.azimuth })
        }
      } else {
        // No star or planet under the pointer: maybe a constellation name label.
        const c = sceneRef.current?.pickConstellation(e.clientX, e.clientY)
        if (c) {
          const hor = equatorialToHorizontal(c.centroidRa, c.centroidDec, lst, degToRad(s.latitude))
          s.selectObject({
            type: 'constellation',
            constellation: c,
            altitude: radToDeg(hor.altitude),
            azimuth: radToDeg(hor.azimuth),
          })
        } else {
          s.selectObject(null)
        }
      }
    },
    [],
  )

  // Sync lookAt when store.viewAzimuth/Altitude changes externally (e.g. search)
  const prevView = useRef({ az: store.viewAzimuth, alt: store.viewAltitude })
  useEffect(() => {
    if (prevView.current.az !== store.viewAzimuth || prevView.current.alt !== store.viewAltitude) {
      sceneRef.current?.lookAt(store.viewAzimuth, store.viewAltitude)
      prevView.current = { az: store.viewAzimuth, alt: store.viewAltitude }
    }
  }, [store.viewAzimuth, store.viewAltitude])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block cursor-grab active:cursor-grabbing"
      onPointerDown={(e) => { pointerDownRef.current = { x: e.clientX, y: e.clientY } }}
      onClick={handleClick}
      style={{ touchAction: 'none' }}
    />
  )
}
