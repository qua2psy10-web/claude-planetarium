import { useMemo, useState } from 'react'
import { Eclipse, X } from 'lucide-react'
import * as Astronomy from 'astronomy-engine'
import dayjs from 'dayjs'
import usePlanetariumStore from '@/store/usePlanetariumStore'
import {
  horizontalPosition,
  nextLunarEclipses,
  nextSolarEclipsesHere,
  type LunarEclipse,
  type SolarEclipseHere,
} from '@/engine/astronomy/eclipses'

const SOLAR_NAMES = { partial: '部分日食', annular: '金環日食', total: '皆既日食' }
const LUNAR_NAMES = { penumbral: '半影月食', partial: '部分月食', total: '皆既月食' }

const when = (d: Date) => dayjs(d).format('YYYY/M/D HH:mm')

/** A button that opens the list of coming eclipses, with a jump to each one. */
export default function EclipsePanel() {
  const [open, setOpen] = useState(false)
  const { simulatedTime, latitude, longitude, setTime, setViewDirection, isPlaying, togglePlay } = usePlanetariumStore()

  // Recompute only when the panel is opened, or the place or the day changes: the search takes a moment.
  const day = Math.floor(simulatedTime.getTime() / 86_400_000)
  const { solar, lunar } = useMemo(() => {
    if (!open) return { solar: [] as SolarEclipseHere[], lunar: [] as LunarEclipse[] }
    const observer = new Astronomy.Observer(latitude, longitude, 0)
    const from = new Date(day * 86_400_000)
    return { solar: nextSolarEclipsesHere(from, observer, 3), lunar: nextLunarEclipses(from, observer, 5) }
  }, [open, day, latitude, longitude])

  // Go to the greatest moment of an eclipse and turn to face the Sun or Moon, then hold still.
  const jump = (peak: Date, body: 'sun' | 'moon') => {
    setTime(peak)
    const pos = horizontalPosition(body, peak, latitude, longitude)
    setViewDirection(pos.azimuth, Math.max(pos.altitude, 8))
    if (isPlaying) togglePlay()
  }

  return (
    <div data-no-labels className="absolute top-4 right-16 z-30">
      <button
        onClick={() => setOpen(!open)}
        title="日食・月食"
        className="p-2 bg-black/70 backdrop-blur border border-white/20 rounded-full text-white/60 hover:text-white transition"
      >
        <Eclipse size={16} />
      </button>

      {open && (
        <div data-no-labels className="absolute top-12 right-0 w-80 max-h-[calc(100vh-7rem)] overflow-y-auto bg-black/85 backdrop-blur border border-white/20 rounded-xl p-4 text-white shadow-xl">
          <button onClick={() => setOpen(false)} className="absolute top-3 right-3 text-white/40 hover:text-white">
            <X size={14} />
          </button>

          <div className="text-xs font-semibold text-white/60 mb-2 tracking-wider">ここで見える日食</div>
          <div className="space-y-2 mb-4">
            {solar.map((e) => (
              <Row
                key={e.peak.getTime()}
                title={SOLAR_NAMES[e.kind]}
                when={when(e.peak)}
                detail={`太陽の ${(e.obscuration * 100).toFixed(e.obscuration > 0.99 ? 1 : 0)}% が隠れる`}
                seen={e.peakAltitude > 0 ? `見えます（太陽の高度 ${e.peakAltitude.toFixed(0)}°）` : '最大のとき太陽は地平線の下'}
                visible={e.peakAltitude > 0}
                onJump={() => jump(e.peak, 'sun')}
              />
            ))}
          </div>

          <div className="text-xs font-semibold text-white/60 mb-2 tracking-wider">月食（世界のどこかで起きるもの）</div>
          <div className="space-y-2">
            {lunar.map((e) => (
              <Row
                key={e.peak.getTime()}
                title={LUNAR_NAMES[e.kind]}
                when={when(e.peak)}
                detail={
                  e.kind === 'penumbral'
                    ? `半影食分 ${e.penumbralMagnitude.toFixed(2)}`
                    : `本影食分 ${e.umbralMagnitude.toFixed(2)}`
                }
                seen={e.peakAltitude > 0 ? `見えます（月の高度 ${e.peakAltitude.toFixed(0)}°）` : '最大のとき月は地平線の下'}
                visible={e.peakAltitude > 0}
                onJump={() => jump(e.peak, 'moon')}
              />
            ))}
          </div>
          <div className="mt-3 text-[11px] text-white/40 leading-relaxed">
            時刻はこのブラウザの時刻（最大のとき）。「この時刻へ」で、その時刻に移って太陽や月のほうを向き、時計を止めます。
          </div>
        </div>
      )}
    </div>
  )
}

function Row(props: { title: string; when: string; detail: string; seen: string; visible: boolean; onJump: () => void }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-yellow-300">{props.title}</span>
        <span className="font-mono text-xs text-white/80">{props.when}</span>
      </div>
      <div className="text-xs text-white/70 mt-0.5">{props.detail}</div>
      <div className="flex items-center justify-between mt-1.5">
        <span className={`text-xs ${props.visible ? 'text-emerald-300' : 'text-white/40'}`}>{props.seen}</span>
        <button
          onClick={props.onJump}
          className="text-xs px-2 py-0.5 rounded bg-blue-500/80 hover:bg-blue-500 transition"
        >
          この時刻へ
        </button>
      </div>
    </div>
  )
}
