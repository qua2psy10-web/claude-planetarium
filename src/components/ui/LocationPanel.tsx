import { useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import usePlanetariumStore from '@/store/usePlanetariumStore'
import { useGeolocation } from '@/hooks/useGeolocation'

export default function LocationPanel() {
  const [open, setOpen] = useState(false)
  const { latitude, longitude, locationName } = usePlanetariumStore()
  const setLocation = usePlanetariumStore((s) => s.setLocation)
  const { requestGPS, loading } = useGeolocation()
  const [lat, setLat] = useState(latitude.toString())
  const [lon, setLon] = useState(longitude.toString())

  const apply = () => {
    const la = parseFloat(lat)
    const lo = parseFloat(lon)
    if (!isNaN(la) && !isNaN(lo)) {
      setLocation(la, lo, `${la.toFixed(2)}, ${lo.toFixed(2)}`, 'manual')
      setOpen(false)
    }
  }

  return (
    <div className="absolute top-4 left-4 z-30">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-black/70 backdrop-blur border border-white/20 rounded-full px-3 py-1.5 text-white/70 hover:text-white text-sm transition"
      >
        <MapPin size={14} />
        <span>{locationName || `${latitude.toFixed(1)}, ${longitude.toFixed(1)}`}</span>
      </button>

      {open && (
        <div className="mt-2 bg-black/80 backdrop-blur border border-white/20 rounded-xl p-4 w-56 text-white shadow-xl">
          <div className="text-xs font-semibold text-white/60 mb-3 uppercase tracking-wider">観測地点</div>

          <button
            onClick={() => { requestGPS(); setOpen(false) }}
            disabled={loading}
            className="w-full flex items-center gap-2 bg-blue-600/30 hover:bg-blue-600/50 rounded-lg px-3 py-2 text-sm mb-3 transition"
          >
            <Navigation size={14} />
            {loading ? '取得中...' : 'GPS で取得'}
          </button>

          <div className="space-y-2">
            <div>
              <label className="text-xs text-white/40 mb-1 block">緯度</label>
              <input
                className="w-full bg-white/10 rounded px-2 py-1 text-sm outline-none"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="35.6895"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">経度</label>
              <input
                className="w-full bg-white/10 rounded px-2 py-1 text-sm outline-none"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder="139.6917"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <button onClick={() => setOpen(false)} className="flex-1 text-xs text-white/40 hover:text-white py-1">
              キャンセル
            </button>
            <button
              onClick={apply}
              className="flex-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs py-1 transition"
            >
              適用
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
