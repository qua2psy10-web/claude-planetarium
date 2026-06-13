export default function CompassRose() {
  return (
    <div className="absolute bottom-4 right-4 z-20 text-white/30 text-xs select-none">
      <div className="relative w-16 h-16">
        <span className="absolute top-0 left-1/2 -translate-x-1/2">N</span>
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2">S</span>
        <span className="absolute left-0 top-1/2 -translate-y-1/2">W</span>
        <span className="absolute right-0 top-1/2 -translate-y-1/2">E</span>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border border-white/15" />
        </div>
      </div>
    </div>
  )
}
