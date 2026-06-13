import { useState } from 'react'
import usePlanetariumStore from '@/store/usePlanetariumStore'

export function useGeolocation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setLocation = usePlanetariumStore((s) => s.setLocation)

  const requestGPS = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      return
    }
    setLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation(pos.coords.latitude, pos.coords.longitude, '現在地', 'gps')
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
      { timeout: 10000 },
    )
  }

  return { requestGPS, loading, error }
}
