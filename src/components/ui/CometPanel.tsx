import { useEffect, useMemo, useState } from 'react'
import { Orbit, X } from 'lucide-react'
import usePlanetariumStore from '@/store/usePlanetariumStore'
import { loadComets } from '@/engine/data/cometLoader'
import { cometState, type CometElements } from '@/engine/astronomy/comets'
import { degToRad, equatorialToHorizontal, radToDeg } from '@/engine/astronomy/coordinates'
import { computeLST } from '@/engine/astronomy/time'

/** Comets listed here are brighter than this (predicted total magnitude): a little fainter than the sky shows. */
const LIST_LIMIT = 11
const MAX_ROWS = 12

/** A button that opens the list of comets that should be bright now, with a button to turn to each. */
export default function CometPanel() {
  const [open, setOpen] = useState(false)
  const [comets, setComets] = useState<CometElements[]>([])
  const { simulatedTime, latitude, longitude, setViewDirection } = usePlanetariumStore()

  useEffect(() => {
    if (open && comets.length === 0) loadComets().then(setComets).catch(() => {})
  }, [open, comets.length])

  // The brightness and place of each comet barely change within an hour, so work them out once an hour.
  const hour = Math.floor(simulatedTime.getTime() / 3_600_000)
  const rows = useMemo(() => {
    if (!open) return []
    const date = new Date(hour * 3_600_000)
    return comets
      .map((el) => ({ el, state: cometState(el, date) }))
      .filter((c) => c.state.magnitude < LIST_LIMIT)
      .sort((a, b) => a.state.magnitude - b.state.magnitude)
      .slice(0, MAX_ROWS)
  }, [open, comets, hour])

  const lst = computeLST(simulatedTime, longitude)
  const sky = (ra: number, dec: number) => {
    const h = equatorialToHorizontal(ra, dec, lst, degToRad(latitude))
    return { altitude: radToDeg(h.altitude), azimuth: radToDeg(h.azimuth) }
  }

  return (
    <div data-no-labels className="relative">
      <button
        onClick={() => setOpen(!open)}
        title="彗星"
        className="p-2.5 min-[400px]:p-3 sm:p-2 bg-black/70 backdrop-blur border border-white/20 rounded-full text-white/60 hover:text-white transition"
      >
        <Orbit size={16} />
      </button>

      {open && (
        <div data-no-labels className="fixed left-2 right-2 top-[6.25rem] max-h-[calc(100dvh-14rem)] sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-80 sm:max-h-[calc(100dvh-9rem)] overflow-y-auto bg-black/85 backdrop-blur border border-white/20 rounded-xl p-4 text-white shadow-xl">
          <button onClick={() => setOpen(false)} className="absolute top-3 right-3 text-white/40 hover:text-white">
            <X size={14} />
          </button>

          <div className="text-xs font-semibold text-white/60 mb-2 tracking-wider">いま明るい彗星（予想）</div>
          {comets.length > 0 && rows.length === 0 && (
            <div className="text-sm text-white/60 mb-2">この日付に、予想 {LIST_LIMIT} 等より明るい彗星はありません。日付を動かして探してください。</div>
          )}
          <div className="space-y-2">
            {rows.map(({ el, state }) => {
              const pos = sky(state.ra, state.dec)
              const up = pos.altitude > 0
              return (
                <div key={el.name} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold text-emerald-200">{el.nameJa ?? el.name}</span>
                    <span className="font-mono text-xs text-white/80">{state.magnitude.toFixed(1)}等</span>
                  </div>
                  <div className="text-[11px] text-white/50">{el.designation}</div>
                  <div className="text-xs text-white/70 mt-0.5">
                    地球から {state.earthDistance.toFixed(2)} AU ・ 太陽から {state.sunDistance.toFixed(2)} AU
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className={`text-xs ${up ? 'text-emerald-300' : 'text-white/40'}`}>
                      {up ? `空に出ています（高度 ${pos.altitude.toFixed(0)}°）` : '地平線の下'}
                    </span>
                    <button
                      onClick={() => setViewDirection(pos.azimuth, Math.max(pos.altitude, 8))}
                      className="text-xs px-2 py-0.5 rounded bg-blue-500/80 hover:bg-blue-500 transition"
                    >
                      見る
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 text-[11px] text-white/40 leading-relaxed">
            明るさは、軌道要素と明るさのパラメータから計算した全光度の近似です。実際の観測とは数等ずれることがあり、
            予想より暗いことも明るいこともあります。軌道要素は MPC（Stellarium 経由）です。
          </div>
        </div>
      )}
    </div>
  )
}
