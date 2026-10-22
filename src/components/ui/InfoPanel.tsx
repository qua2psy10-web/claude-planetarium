import { X } from 'lucide-react'
import usePlanetariumStore from '@/store/usePlanetariumStore'
import { findConstellation } from '@/engine/data/constellationLoader'
import { DSO_TYPE_JA } from '@/types/dso'
import { getMoonInfoCached } from '@/engine/astronomy/moonPhase'

export default function InfoPanel() {
  const { selectedObject, selectObject, simulatedTime } = usePlanetariumStore()
  if (!selectedObject) return null

  const { type, star, planet, constellation, dso, altitude, azimuth } = selectedObject
  // The constellation a selected star belongs to, for its name and story.
  const starConstellation = star?.con ? findConstellation(star.con) : undefined

  return (
    <div data-no-labels className="absolute top-16 right-4 z-30 w-64 max-h-[calc(100vh-6rem)] overflow-y-auto bg-black/80 backdrop-blur border border-white/20 rounded-xl p-4 text-white shadow-xl">
      <button
        onClick={() => selectObject(null)}
        className="absolute top-3 right-3 text-white/40 hover:text-white"
      >
        <X size={14} />
      </button>

      {type === 'star' && star && (
        <>
          <div className="text-yellow-300 text-lg font-bold mb-1">{star.proper || `HIP ${star.hip}`}</div>
          <div className="text-white/60 text-xs mb-3">
            恒星{star.con && ` · ${starConstellation?.nameJa ?? star.con}`}
          </div>
          <div className="space-y-1 text-sm">
            <Row label="等級" value={star.mag.toFixed(2)} />
            <Row label="B-V" value={star.ci.toFixed(2)} />
            <Row label="高度" value={`${altitude.toFixed(1)}°`} />
            <Row label="方位角" value={`${azimuth.toFixed(1)}°`} />
            <Row label="赤経" value={`${((star.ra * 180) / Math.PI / 15).toFixed(3)}h`} />
            <Row label="赤緯" value={`${((star.dec * 180) / Math.PI).toFixed(2)}°`} />
          </div>
          {starConstellation && (
            <div className="mt-3 pt-3 border-t border-white/15">
              <div className="text-xs font-semibold text-white/50 mb-1">{starConstellation.nameJa}について</div>
              <div className="text-sm text-yellow-100 leading-relaxed">{starConstellation.mythology}</div>
            </div>
          )}
        </>
      )}

      {type === 'planet' && planet && (
        <>
          <div className="text-orange-300 text-lg font-bold mb-1">{planet.nameJa}</div>
          <div className="text-white/60 text-xs mb-3">{planet.name} · 惑星</div>
          <div className="space-y-1 text-sm">
            <Row label="等級" value={planet.magnitude.toFixed(2)} />
            <Row label="高度" value={`${altitude.toFixed(1)}°`} />
            <Row label="方位角" value={`${azimuth.toFixed(1)}°`} />
            {planet.name === 'Moon' && <MoonRows date={simulatedTime} />}
          </div>
        </>
      )}

      {type === 'dso' && dso && (
        <>
          <div className="text-rose-300 text-lg font-bold mb-1">{dso.nameJa ?? dso.id}</div>
          <div className="text-white/60 text-xs mb-3">
            {dso.id}{dso.nameJa && dso.nameEn ? ` · ${dso.nameEn}` : ''} · {DSO_TYPE_JA[dso.type]}
          </div>
          <div className="space-y-1 text-sm">
            <Row label="等級" value={dso.mag.toFixed(1)} />
            {dso.size > 0 && (
              <Row
                label="見かけの大きさ"
                value={dso.sizeMinor && dso.sizeMinor !== dso.size ? `${dso.size}′ × ${dso.sizeMinor}′` : `${dso.size}′`}
              />
            )}
            {dso.ngc && <Row label="NGC/他" value={dso.ngc} />}
            <Row label="高度" value={`${altitude.toFixed(1)}°`} />
            <Row label="方位角" value={`${azimuth.toFixed(1)}°`} />
            <Row label="赤経" value={`${((dso.ra * 180) / Math.PI / 15).toFixed(3)}h`} />
            <Row label="赤緯" value={`${((dso.dec * 180) / Math.PI).toFixed(2)}°`} />
          </div>
        </>
      )}

      {type === 'constellation' && constellation && (
        <>
          <div className="text-blue-300 text-lg font-bold mb-1">{constellation.nameJa}</div>
          <div className="text-white/60 text-xs mb-3">{constellation.name} ({constellation.abbr})</div>
          <div className="text-xs font-semibold text-white/50 mb-1">神話・由来</div>
          <div className="text-sm text-yellow-100 leading-relaxed">{constellation.mythology}</div>
        </>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/50">{label}</span>
      <span className="font-mono text-white/90">{value}</span>
    </div>
  )
}

function MoonRows({ date }: { date: Date }) {
  const moon = getMoonInfoCached(date)
  return (
    <>
      <Row label="月相" value={moon.nameJa} />
      <Row label="月齢" value={moon.ageDays.toFixed(1)} />
      <Row label="輝面比" value={`${(moon.illumination * 100).toFixed(0)}%`} />
    </>
  )
}
