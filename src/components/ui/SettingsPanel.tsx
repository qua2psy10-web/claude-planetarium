import { useState } from 'react'
import { Settings } from 'lucide-react'
import usePlanetariumStore from '@/store/usePlanetariumStore'
import type { DisplayToggle } from '@/types/store'

const TOGGLES: { key: DisplayToggle; label: string }[] = [
  { key: 'showConstellationLines', label: '星座線' },
  { key: 'showConstellationNames', label: '星座名' },
  { key: 'showPlanetLabels', label: '惑星' },
  { key: 'showStarNames', label: '星の名前' },
  { key: 'showMilkyWay', label: '天の川' },
  { key: 'showDeepSky', label: '星雲・星団 (M天体)' },
  { key: 'showAtmosphere', label: '大気効果' },
  { key: 'showEquatorialGrid', label: '赤道グリッド' },
  { key: 'showAltazGrid', label: '地平グリッド' },
  { key: 'showMeteors', label: '流れ星' },
  { key: 'showPlanetTrails', label: '惑星の軌跡' },
  { key: 'showAnalemma', label: '太陽の軌跡' },
  { key: 'showComets', label: '彗星' },
  { key: 'showSatellites', label: '人工衛星 (ISS)' },
]

export default function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const store = usePlanetariumStore()

  return (
    <div data-no-labels className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2.5 min-[400px]:p-3 sm:p-2 bg-black/70 backdrop-blur border border-white/20 rounded-full text-white/60 hover:text-white transition"
      >
        <Settings size={16} />
      </button>

      {open && (
        // Out of the flow, like the other panels: in the flow it widened the container, which is only as wide as
        // the button, and the button slid left (under the neighbouring buttons) as soon as the panel opened.
        <div className="fixed left-2 right-2 top-[6.25rem] max-h-[calc(100dvh-14rem)] sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-48 sm:max-h-[calc(100dvh-9rem)] overflow-y-auto bg-black/80 backdrop-blur border border-white/20 rounded-xl p-4 text-white shadow-xl">
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
