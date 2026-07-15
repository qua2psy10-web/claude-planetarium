import usePlanetariumStore from '@/store/usePlanetariumStore'

// 8-point compass names (Japanese), indexed by azimuth / 45°
const DIR_NAMES = ['北', '北東', '東', '南東', '南', '南西', '西', '北西']

function headingName(az: number): string {
  return DIR_NAMES[Math.round(az / 45) % 8]
}

export default function CompassRose() {
  const az = usePlanetariumStore((s) => s.viewAzimuth)
  const norm = ((az % 360) + 360) % 360

  return (
    <div className="absolute bottom-4 right-4 z-20 select-none flex flex-col items-center gap-1">
      {/* Heading readout — the direction you are currently facing */}
      <div className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm border border-yellow-300/40 text-yellow-300 text-sm font-bold tabular-nums shadow">
        {headingName(norm)} {Math.round(norm)}°
      </div>

      {/* Compass ring (north-up) */}
      <div className="relative w-20 h-20 bg-black/50 backdrop-blur-sm rounded-full border border-white/20">
        {/* Cardinal directions (fixed, geographic) */}
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-xs font-bold text-yellow-300">N</span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs font-bold text-yellow-300/80">S</span>
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs font-bold text-yellow-300/80">W</span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs font-bold text-yellow-300/80">E</span>

        {/* Inner ring */}
        <div className="absolute inset-3 rounded-full border border-white/15" />

        {/* Heading needle — rotates to point toward the current view azimuth */}
        <div
          className="absolute inset-0 flex items-start justify-center transition-transform duration-100"
          style={{ transform: `rotate(${norm}deg)` }}
        >
          <div className="mt-1.5 w-0 h-0 border-x-[5px] border-x-transparent border-b-[11px] border-b-red-400" />
        </div>

        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/70" />
      </div>
    </div>
  )
}
