import { useState, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { useSearch } from '@/hooks/useSearch'
import usePlanetariumStore from '@/store/usePlanetariumStore'
import { equatorialToHorizontal, degToRad } from '@/engine/astronomy/coordinates'
import { precessRaDec, precessionMatrix } from '@/engine/astronomy/precession'
import { DSO_TYPE_JA } from '@/types/dso'
import { computeLST } from '@/engine/astronomy/time'
import type { SearchResult } from '@/engine/data/searchIndex'

export default function SearchBar() {
  const { query, results, handleQuery, clear } = useSearch()
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const store = usePlanetariumStore()

  const selectResult = (r: SearchResult) => {
    clear()
    inputRef.current?.blur()
    setFocused(false)

    const lst = computeLST(store.simulatedTime, store.longitude)
    const latRad = degToRad(store.latitude)
    const prec = precessionMatrix(store.simulatedTime)

    if (r.type === 'star') {
      const eq = precessRaDec(r.star.ra, r.star.dec, prec)
      const { altitude, azimuth } = equatorialToHorizontal(eq.ra, eq.dec, lst, latRad)
      const azDeg = (azimuth * 180) / Math.PI
      const altDeg = (altitude * 180) / Math.PI
      store.setViewDirection(azDeg, altDeg)
      store.selectObject({ type: 'star', star: r.star, altitude: altDeg, azimuth: azDeg })
    } else if (r.type === 'dso') {
      const eq = precessRaDec(r.dso.ra, r.dso.dec, prec)
      const { altitude, azimuth } = equatorialToHorizontal(eq.ra, eq.dec, lst, latRad)
      const azDeg = (azimuth * 180) / Math.PI
      const altDeg = (altitude * 180) / Math.PI
      store.setViewDirection(azDeg, Math.max(altDeg, 10))
      store.selectObject({ type: 'dso', dso: r.dso, altitude: altDeg, azimuth: azDeg })
    } else if (r.type === 'constellation') {
      const eq = precessRaDec(r.constellation.centroidRa, r.constellation.centroidDec, prec)
      const { altitude, azimuth } = equatorialToHorizontal(eq.ra, eq.dec, lst, latRad)
      const azDeg = (azimuth * 180) / Math.PI
      const altDeg = (altitude * 180) / Math.PI
      store.setViewDirection(azDeg, Math.max(altDeg, 15))
      store.selectObject({ type: 'constellation', constellation: r.constellation, altitude: altDeg, azimuth: azDeg })
    } else if (r.type === 'planet') {
      // Planet position is dynamic — just select it
      store.selectObject(null)
    }
  }

  const showDropdown = focused && results.length > 0

  return (
    <div data-no-labels className="absolute top-4 left-1/2 -translate-x-1/2 w-72 z-30">
      <div className="relative flex items-center bg-black/70 backdrop-blur border border-white/20 rounded-full px-4 py-2">
        <Search size={14} className="text-white/40 shrink-0" />
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none ml-2"
          placeholder="星・星座・惑星・M天体を検索..."
          value={query}
          onChange={(e) => handleQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
        {query && (
          <button onClick={clear} className="text-white/40 hover:text-white ml-1">
            <X size={12} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="mt-1 bg-black/80 backdrop-blur border border-white/10 rounded-lg overflow-hidden shadow-lg">
          {results.map((r, i) => (
            <button
              key={i}
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition flex items-center gap-3"
              onMouseDown={() => selectResult(r)}
            >
              <span className="text-lg">{r.type === 'star' ? '★' : r.type === 'planet' ? '●' : r.type === 'dso' ? '◎' : '✦'}</span>
              <div>
                <div className="font-medium">
                  {r.type === 'star' ? r.star.proper
                    : r.type === 'constellation' ? r.constellation.nameJa
                    : r.type === 'dso' ? (r.dso.nameJa ? `${r.dso.id} ${r.dso.nameJa}` : r.dso.id)
                    : r.nameJa}
                </div>
                <div className="text-white/40 text-xs">
                  {r.type === 'star' ? `等級 ${r.star.mag.toFixed(1)}`
                    : r.type === 'constellation' ? r.constellation.name
                    : r.type === 'dso' ? `${DSO_TYPE_JA[r.dso.type]}${r.dso.nameEn ? ` · ${r.dso.nameEn}` : ''} · ${r.dso.mag.toFixed(1)}等`
                    : r.name}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
