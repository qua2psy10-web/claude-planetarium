import { useState } from 'react'
import { Settings } from 'lucide-react'
import usePlanetariumStore from '@/store/usePlanetariumStore'
import type { DisplayToggle } from '@/types/store'

const TOGGLES: { key: DisplayToggle; label: string }[] = [
  { key: 'showConstellationLines', label: '星座線' },
  { key: 'showConstellationNames', label: '星座名' },
  { key: 'showPlanetLabels', label: '惑星' },
  { key: 'showStarNames', label: '星の名前' },
  { key: 'showAtmosphere', label: '大気効果' },
  { key: 'showEquatorialGrid', label: '赤道グリッド' },
]

export default function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const store = usePlanetariumStore()

  return (
    <div className="absolute top-4 right-4 z-30">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 bg-black/70 backdrop-blur border border-white/20 rounded-full text-white/60 hover:text-white transition"
      >
        <Settings size={16} />
      </button>

      {open && (
        <div className="mt-2 bg-black/80 backdrop-blur border border-white/20 rounded-xl p-4 w-48 text-white shadow-xl">
          <div className="text-xs font-semibold text-white/60 mb-3 uppercase tracking-wider">表示設定</div>
          <div className="space-y-2">
            {TOGGLES.map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-white/80">{label}</span>
                <button
                  onClick={() => store.toggleSetting(key)}
                  className={`w-9 h-5 rounded-full transition relative ${
                    store[key] ? 'bg-blue-500' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                      store[key] ? 'left-4' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
