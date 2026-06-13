import { useEffect, useRef } from 'react'
import { SceneManager } from '@/engine/three/SceneManager'

export function useThreeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<SceneManager | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const scene = new SceneManager(canvasRef.current)
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  return { canvasRef, sceneRef }
}
