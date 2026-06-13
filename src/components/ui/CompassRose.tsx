export default function CompassRose() {
  return (
    <div className="absolute bottom-4 right-4 z-20 select-none">
      <div className="relative w-20 h-20 bg-black/50 backdrop-blur-sm rounded-full border border-white/20">
        {/* Cardinal directions */}
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-xs font-bold text-amber-300">N</span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs font-bold text-yellow-300/80">S</span>
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs font-bold text-yellow-300/80">W</span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs font-bold text-yellow-300/80">E</span>
        {/* Inner ring */}
        <div className="absolute inset-3 rounded-full border border-white/20" />
        {/* North tick */}
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-px h-2 bg-amber-300/80" />
      </div>
    </div>
  )
}
