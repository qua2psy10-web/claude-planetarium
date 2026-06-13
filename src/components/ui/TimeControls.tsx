import { Play, Pause, SkipBack } from 'lucide-react'
import usePlanetariumStore from '@/store/usePlanetariumStore'
import dayjs from 'dayjs'

const SPEEDS = [
  { label: '×1', value: 1 },
  { label: '×60', value: 60 },
  { label: '×1h', value: 3600 },
  { label: '×1d', value: 86400 },
]

export default function TimeControls() {
  const { simulatedTime, isPlaying, playbackSpeed, togglePlay, setPlayback, setTime } = usePlanetariumStore()

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [y, m, d] = e.target.value.split('-').map(Number)
    const next = new Date(simulatedTime)
    next.setFullYear(y, m - 1, d)
    setTime(next)
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, min] = e.target.value.split(':').map(Number)
    const next = new Date(simulatedTime)
    next.setHours(h, min, 0, 0)
    setTime(next)
  }

  const resetToNow = () => setTime(new Date())

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 bg-black/70 backdrop-blur border border-white/20 rounded-xl px-4 py-2">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className="text-white hover:text-blue-300 transition p-1"
          title={isPlaying ? '一時停止' : '再生'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        {/* Playback speed */}
        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              onClick={() => setPlayback(s.value)}
              className={`text-xs px-2 py-0.5 rounded transition ${
                playbackSpeed === s.value
                  ? 'bg-blue-500 text-white'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-white/20" />

        {/* Date/time picker */}
        <input
          type="date"
          value={dayjs(simulatedTime).format('YYYY-MM-DD')}
          onChange={handleDateChange}
          className="bg-transparent text-white/80 text-xs outline-none w-30"
        />
        <input
          type="time"
          value={dayjs(simulatedTime).format('HH:mm')}
          onChange={handleTimeChange}
          className="bg-transparent text-white/80 text-xs outline-none w-16"
        />

        {/* Reset to now */}
        <button
          onClick={resetToNow}
          className="text-white/40 hover:text-white text-xs transition"
          title="現在時刻に戻す"
        >
          <SkipBack size={14} />
        </button>

        {/* 1 year forward/backward */}
        <button
          onClick={() => setTime(new Date(simulatedTime.getTime() - 86400000 * 365))}
          className="text-white/40 hover:text-white text-xs transition"
          title="1年前"
        >
          -1y
        </button>
        <button
          onClick={() => setTime(new Date(simulatedTime.getTime() + 86400000 * 365))}
          className="text-white/40 hover:text-white text-xs transition"
          title="1年後"
        >
          +1y
        </button>
      </div>
    </div>
  )
}
