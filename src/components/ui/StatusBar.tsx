import usePlanetariumStore from '@/store/usePlanetariumStore'
import dayjs from 'dayjs'

export default function StatusBar() {
  const { simulatedTime, fov, latitude, longitude } = usePlanetariumStore()

  return (
    <div className="absolute bottom-16 left-4 z-20 text-white/40 text-xs font-mono space-y-0.5">
      <div>{dayjs(simulatedTime).format('YYYY-MM-DD HH:mm:ss')}</div>
      <div>
        {latitude >= 0 ? 'N' : 'S'}{Math.abs(latitude).toFixed(2)}° {longitude >= 0 ? 'E' : 'W'}{Math.abs(longitude).toFixed(2)}°
      </div>
      <div>FOV {fov.toFixed(0)}°</div>
    </div>
  )
}
