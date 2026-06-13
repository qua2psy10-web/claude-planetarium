import { X } from 'lucide-react'
import usePlanetariumStore from '@/store/usePlanetariumStore'

export default function InfoPanel() {
  const { selectedObject, selectObject } = usePlanetariumStore()
  if (!selectedObject) return null

  const { type, star, planet, constellation, altitude, azimuth } = selectedObject

  return (
    <div className="absolute top-16 right-4 z-30 w-64 bg-black/80 backdrop-blur border border-white/20 rounded-xl p-4 text-white shadow-xl">
      <button
        onClick={() => selectObject(null)}
        className="absolute top-3 right-3 text-white/40 hover:text-white"
      >
        <X size={14} />
      </button>

      {type === 'star' && star && (
        <>
          <div className="text-yellow-300 text-lg font-bold mb-1">{star.proper || `HIP ${star.hip}`}</div>
          <div className="text-white/60 text-xs mb-3">恒星 · {star.con && `${star.con}座`}</div>
          <div className="space-y-1 text-sm">
            <Row label="等級" value={star.mag.toFixed(2)} />
            <Row label="B-V" value={star.ci.toFixed(2)} />
            <Row label="高度" value={`${altitude.toFixed(1)}°`} />
            <Row label="方位角" value={`${azimuth.toFixed(1)}°`} />
            <Row label="赤経" value={`${((star.ra * 180) / Math.PI / 15).toFixed(3)}h`} />
            <Row label="赤緯" value={`${((star.dec * 180) / Math.PI).toFixed(2)}°`} />
          </div>
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
          </div>
        </>
      )}

      {type === 'constellation' && constellation && (
        <>
          <div className="text-blue-300 text-lg font-bold mb-1">{constellation.nameJa}</div>
          <div className="text-white/60 text-xs mb-3">{constellation.name} ({constellation.abbr})</div>
          <div className="text-sm text-white/80 leading-relaxed">{constellation.mythology}</div>
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
