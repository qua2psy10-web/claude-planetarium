import type { HygStar } from './star'
import type { ConstellationMeta } from './constellation'
import type { PlanetData } from './planet'
import type { MessierObject } from './dso'

export type SelectedObjectType = 'star' | 'planet' | 'constellation' | 'dso'

export interface SelectedObject {
  type: SelectedObjectType
  star?: HygStar
  planet?: PlanetData
  constellation?: ConstellationMeta
  dso?: MessierObject
  altitude: number
  azimuth: number
}

export type DisplayToggle =
  | 'showConstellationLines'
  | 'showConstellationNames'
  | 'showPlanetLabels'
  | 'showEquatorialGrid'
  | 'showAltazGrid'
  | 'showMeteors'
  | 'showPlanetTrails'
  | 'showAnalemma'
  | 'showComets'
  | 'showAtmosphere'
  | 'showStarNames'
  | 'showMilkyWay'
  | 'showDeepSky'

export interface PlanetariumState {
  simulatedTime: Date
  isPlaying: boolean
  playbackSpeed: number

  latitude: number
  longitude: number
  locationName: string
  locationSource: 'gps' | 'manual'

  viewAzimuth: number
  viewAltitude: number
  fov: number

  showConstellationLines: boolean
  showConstellationNames: boolean
  showPlanetLabels: boolean
  showEquatorialGrid: boolean
  showAltazGrid: boolean
  showMeteors: boolean
  showPlanetTrails: boolean
  showAnalemma: boolean
  showComets: boolean
  showAtmosphere: boolean
  showStarNames: boolean
  showMilkyWay: boolean
  showDeepSky: boolean

  selectedObject: SelectedObject | null

  localSiderealTime: number

  setTime: (date: Date) => void
  setPlayback: (speed: number) => void
  togglePlay: () => void
  setLocation: (lat: number, lon: number, name?: string, source?: 'gps' | 'manual') => void
  selectObject: (obj: SelectedObject | null) => void
  toggleSetting: (key: DisplayToggle) => void
  setViewDirection: (az: number, alt: number) => void
  setFov: (fov: number) => void
  setLocalSiderealTime: (lst: number) => void
}
