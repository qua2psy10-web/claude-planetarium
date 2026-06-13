import { useEffect, useRef, useCallback } from 'react'
import { SceneManager } from '@/engine/three/SceneManager'
import { loadStars } from '@/engine/data/starLoader'
import { loadConstellationLines } from '@/engine/data/constellationLoader'
import { getPlanetPositions } from '@/engine/astronomy/planets'
import { computeLST } from '@/engine/astronomy/time'
import { degToRad } from '@/engine/astronomy/coordinates'
import { buildSearchIndex } from '@/engine/data/searchIndex'
import { loadConstellationMeta } from '@/engine/data/constellationLoader'
import usePlanetariumStore from '@/store/usePlanetariumStore'
import type { PlanetData } from '@/types/planet'

export default function PlanetariumCanvas({ onLoaded }: { onLoaded?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<SceneManager | null>(null)
  const planetsRef = useRef<PlanetData[]>([])
  const lastFrameRef = useRef<number>(Date.now())

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
    sceneRef.current?.setConstellationLinesVisible(s.showConstellationLines)
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
        buildSearchIndex(stars, meta)
        onLoaded?.()
        lastFrameRef.current = Date.now()
        scene.startRenderLoop(onFrame)
      },
    )

    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [onFrame, onLoaded])

  // Sync FOV changes from store
  useEffect(() => {
    sceneRef.current?.updateUniforms(
      computeLST(store.simulatedTime, store.longitude),
      degToRad(store.latitude),
      store.fov,
    )
  }, [store.fov, store.latitude, store.longitude, store.simulatedTime])

  // Handle click → picking
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
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
        s.selectObject(null)
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
      onClick={handleClick}
      style={{ touchAction: 'none' }}
    />
  )
}
