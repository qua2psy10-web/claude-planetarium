import { useState, useCallback } from 'react'
import PlanetariumCanvas from './components/PlanetariumCanvas'
import SearchBar from './components/ui/SearchBar'
import TimeControls from './components/ui/TimeControls'
import InfoPanel from './components/ui/InfoPanel'
import LocationPanel from './components/ui/LocationPanel'
import SettingsPanel from './components/ui/SettingsPanel'
import EclipsePanel from './components/ui/EclipsePanel'
import CometPanel from './components/ui/CometPanel'
import SatellitePanel from './components/ui/SatellitePanel'
import SharePanel from './components/ui/SharePanel'
import StatusBar from './components/ui/StatusBar'
import CompassRose from './components/ui/CompassRose'

export default function App() {
  const [loaded, setLoaded] = useState(false)
  const handleLoaded = useCallback(() => setLoaded(true), [])

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <PlanetariumCanvas onLoaded={handleLoaded} />

      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black">
          <div className="text-white/60 text-sm mb-4">星空を読み込み中...</div>
          <div className="w-32 h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {loaded && (
        <>
          <SearchBar />
          <LocationPanel />
          {/* One row of round buttons; each opens a panel (a sheet under the header on phones). */}
          <div data-no-labels className="absolute top-2 right-2 sm:top-4 sm:right-4 z-30 flex flex-row-reverse items-start gap-1 min-[400px]:gap-1.5 sm:gap-3.5">
            <SettingsPanel />
            <EclipsePanel />
            <CometPanel />
            <SatellitePanel />
            <SharePanel />
          </div>
          <InfoPanel />
          <TimeControls />
          <StatusBar />
          <CompassRose />
        </>
      )}
    </div>
  )
}
