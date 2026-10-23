import usePlanetariumStore from '@/store/usePlanetariumStore'
import dayjs from 'dayjs'
import { getMoonInfoCached } from '@/engine/astronomy/moonPhase'
import { eclipseSummary } from '@/engine/astronomy/eclipses'
import { getSunAltitude } from '@/engine/astronomy/planets'
import { twilightName } from '@/engine/astronomy/skyBrightness'

export default function StatusBar() {
  const { simulatedTime, fov, latitude, longitude } = usePlanetariumStore()
  const moon = getMoonInfoCached(simulatedTime)
  const eclipse = eclipseSummary(simulatedTime, latitude, longitude, moon.phaseAngle)
  const sunAlt = getSunAltitude(simulatedTime, latitude, longitude)

  return (
    <div
      data-no-labels
      className="absolute bottom-[9.5rem] min-[360px]:bottom-[6.25rem] left-3 sm:bottom-16 sm:left-4 z-20 text-yellow-300/90 text-[11px] sm:text-xs font-mono space-y-0.5 pointer-events-none"
      style={{ textShadow: '0 0 3px #000, 0 0 6px #000' }}
    >
      <div>{dayjs(simulatedTime).format('YYYY-MM-DD HH:mm:ss')}</div>
      <div>
        {latitude >= 0 ? 'N' : 'S'}{Math.abs(latitude).toFixed(2)}° {longitude >= 0 ? 'E' : 'W'}{Math.abs(longitude).toFixed(2)}°
      </div>
      <div>FOV {fov.toFixed(0)}°</div>
      <div>太陽高度 {sunAlt.toFixed(1)}° · {twilightName(sunAlt)}</div>
      <div>月齢 {moon.ageDays.toFixed(1)} · {moon.nameJa} ({Math.round(moon.illumination * 100)}%)</div>
      {eclipse && <div className="text-orange-300">{eclipse}</div>}
    </div>
  )
}
