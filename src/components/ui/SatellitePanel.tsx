import { useEffect, useMemo, useState } from 'react'
import { Satellite, X } from 'lucide-react'
import dayjs from 'dayjs'
import usePlanetariumStore from '@/store/usePlanetariumStore'
import { loadIss, type IssData } from '@/engine/data/satelliteLoader'
import { MAX_AGE_DAYS, GOOD_AGE_DAYS } from '@/engine/three/SatelliteLayer'

const DAYS_AHEAD = 7
const MAX_ROWS = 10
const DIRECTIONS = ['北', '北東', '東', '南東', '南', '南西', '西', '北西']
const direction = (az: number) => DIRECTIONS[Math.round((((az % 360) + 360) % 360) / 45) % 8]

const SOURCE_TEXT: Record<IssData['source'], string> = {
  live: 'CelesTrak から取得',
  cache: 'CelesTrak から取得（2時間以内に保存したもの）',
  bundled: 'サイトに同梱のデータ',
}

/** A button that opens the ISS panel: where it is now, and its passes over the next week. */
export default function SatellitePanel() {
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [iss, setIss] = useState<IssData | null | undefined>(undefined)
  const { simulatedTime, latitude, longitude, setTime, setViewDirection, isPlaying, togglePlay } = usePlanetariumStore()

  useEffect(() => {
    loadIss().then(setIss).catch(() => setIss(null))
  }, [])

  const observer = useMemo(() => ({ latDeg: latitude, lonDeg: longitude }), [latitude, longitude])
  const age = iss ? iss.track.ageDays(simulatedTime) : 0
  const usable = !!iss && Math.abs(age) <= MAX_AGE_DAYS
  const now = usable ? iss.track.state(simulatedTime, observer) : null

  // The pass list is searched from a quarter-hour boundary, so it is not redone every frame.
  const bucket = Math.floor(simulatedTime.getTime() / 900_000)
  const passes = useMemo(() => {
    if (!open || !iss || Math.abs(iss.track.ageDays(new Date(bucket * 900_000))) > MAX_AGE_DAYS) return []
    return iss.track.findPasses(new Date(bucket * 900_000), DAYS_AHEAD, observer)
  }, [open, iss, bucket, observer])
  const rows = (showAll ? passes : passes.filter((p) => p.visible)).slice(0, MAX_ROWS)

  const goTo = (max: Date) => {
    if (!iss) return
    const s = iss.track.state(max, observer)
    setTime(max)
    if (isPlaying) togglePlay()
    if (s) setViewDirection(s.azimuth, Math.max(s.altitude, 10))
  }

  return (
    <div data-no-labels className="absolute top-4 right-40 z-30">
      <button
        onClick={() => setOpen(!open)}
        title="国際宇宙ステーション (ISS)"
        className="p-2 bg-black/70 backdrop-blur border border-white/20 rounded-full text-white/60 hover:text-white transition"
      >
        <Satellite size={16} />
      </button>

      {open && (
        <div data-no-labels className="absolute top-12 right-0 w-80 max-h-[calc(100vh-7rem)] overflow-y-auto bg-black/85 backdrop-blur border border-white/20 rounded-xl p-4 text-white shadow-xl">
          <button onClick={() => setOpen(false)} className="absolute top-3 right-3 text-white/40 hover:text-white">
            <X size={14} />
          </button>

          <div className="text-xs font-semibold text-white/60 mb-2 tracking-wider">国際宇宙ステーション (ISS)</div>

          {iss === undefined && <div className="text-sm text-white/60">軌道データを読み込み中…</div>}
          {iss === null && <div className="text-sm text-red-300">軌道データを取得できませんでした。</div>}

          {iss && (
            <>
              <div className="text-[11px] text-white/45 leading-relaxed mb-2">
                軌道データ: {SOURCE_TEXT[iss.source]}（{dayjs(iss.track.tle.epoch).format('YYYY-MM-DD HH:mm')} 時点）
              </div>
              {!usable && (
                <div className="text-xs text-red-300 mb-2">
                  表示中の日時は軌道データから {Math.abs(age).toFixed(0)} 日離れていて、ISS の位置は計算できません。
                  {iss.source === 'bundled' && '最新のデータを取得できていません。'}
                </div>
              )}
              {usable && Math.abs(age) > GOOD_AGE_DAYS && (
                <div className="text-xs text-amber-300 mb-2">
                  軌道データから {Math.abs(age).toFixed(0)} 日離れているため、位置は数度以上ずれることがあります（目安）。
                </div>
              )}

              {now && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className={now.altitude > 0 ? 'text-emerald-300' : 'text-white/50'}>
                      {now.altitude > 0 ? '空に出ています' : '地平線の下'}
                    </span>
                    <span className="font-mono text-white/80">
                      高度 {now.altitude.toFixed(0)}° 方位 {direction(now.azimuth)} {now.azimuth.toFixed(0)}°
                    </span>
                  </div>
                  <div className="text-xs text-white/60 mt-1 space-y-0.5">
                    <div>距離 {now.rangeKm.toFixed(0)} km ・ 軌道高度 {now.heightKm.toFixed(0)} km ・ 秒速 {now.speedKmS.toFixed(2)} km</div>
                    <div>
                      {now.sunlit > 0.5
                        ? `太陽の光を受けている${now.magnitude !== null ? `（${now.magnitude.toFixed(1)}等）` : ''}`
                        : '地球の影の中（見えない）'}
                    </div>
                  </div>
                  {now.altitude > 0 && (
                    <button
                      onClick={() => setViewDirection(now.azimuth, Math.max(now.altitude, 8))}
                      className="mt-1.5 text-xs px-2 py-0.5 rounded bg-blue-500/80 hover:bg-blue-500 transition"
                    >
                      見る
                    </button>
                  )}
                </div>
              )}

              {usable && (
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-xs font-semibold text-white/60 tracking-wider">これから{DAYS_AHEAD}日間のパス</div>
                    <label className="flex items-center gap-1 text-[11px] text-white/50 cursor-pointer">
                      <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
                      見えないパスも
                    </label>
                  </div>
                  {rows.length === 0 && (
                    <div className="text-sm text-white/60">
                      {showAll ? '高度10°以上に上がるパスはありません。' : '肉眼で見えるパスはありません（夜で、ISS が日光を受けているパスだけを表示します）。'}
                    </div>
                  )}
                  <div className="space-y-2">
                    {rows.map((p) => (
                      <div key={p.start.getTime()} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-bold text-amber-200">
                            {dayjs(p.start).format('M/D HH:mm')} → {dayjs(p.end).format('HH:mm')}
                          </span>
                          <span className={`text-xs ${p.visible ? 'text-emerald-300' : 'text-white/40'}`}>
                            {p.visible ? '見える' : p.reason === 'day' ? '昼間' : '影の中'}
                          </span>
                        </div>
                        <div className="text-xs text-white/70 mt-0.5">
                          最大高度 {p.maxAltitude.toFixed(0)}° ・ {direction(p.startAzimuth)} → {direction(p.endAzimuth)}
                          {p.magnitude !== null && ` ・ 最大 ${p.magnitude.toFixed(1)}等`}
                        </div>
                        <button
                          onClick={() => goTo(p.max)}
                          className="mt-1.5 text-xs px-2 py-0.5 rounded bg-blue-500/80 hover:bg-blue-500 transition"
                        >
                          この時刻へ
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          <div className="mt-3 text-[11px] text-white/40 leading-relaxed">
            位置は SGP4 で、公開されている軌道要素（TLE）から計算しています。要素は数日で古くなり、
            ISS は高度の調整もするため、先の予測ほど誤差が大きくなります。「見える」は、観測地の太陽が地平線の6°以下で、
            ISS が日光を受けていて、高度10°以上になる場合です。
          </div>
        </div>
      )}
    </div>
  )
}
