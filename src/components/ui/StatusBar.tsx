import usePlanetariumStore from '@/store/usePlanetariumStore'
import dayjs from 'dayjs'

export default function StatusBar() {
  const { simulatedTime, fov, latitude, longitude } = usePlanetariumStore()

  return (
    <div
      data-no-labels
      className="absolute bottom-16 left-4 z-20 text-yellow-300/90 text-xs font-mono space-y-0.5"
      style={{ textShadow: '0 0 3px #000, 0 0 6px #000' }}
    >
      <div>{dayjs(simulatedTime).format('YYYY-MM-DD HH:mm:ss')}</div>
      <div>
        {latitude >= 0 ? 'N' : 'S'}{Math.abs(latitude).toFixed(2)}° {longitude >= 0 ? 'E' : 'W'}{Math.abs(longitude).toFixed(2)}°
      </div>
      <div>FOV {fov.toFixed(0)}°</div>
    </div>
  )
}
