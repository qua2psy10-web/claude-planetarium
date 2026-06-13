import { create } from 'zustand'
import type { PlanetariumState, SelectedObject, DisplayToggle } from '@/types/store'
import { computeLST } from '@/engine/astronomy/time'

const usePlanetariumStore = create<PlanetariumState>((set, get) => ({
  simulatedTime: new Date(),
  isPlaying: true,
  playbackSpeed: 1,

  latitude: 35.6895,
  longitude: 139.6917,
  locationName: '東京',
  locationSource: 'manual',

  viewAzimuth: 180,
  viewAltitude: 45,
  fov: 75,

  showConstellationLines: true,
  showConstellationNames: true,
  showPlanetLabels: true,
  showEquatorialGrid: false,
  showAltazGrid: false,
  showAtmosphere: true,
  showStarNames: false,

  selectedObject: null,

  localSiderealTime: computeLST(new Date(), 139.6917),

  setTime: (date) => {
    const lon = get().longitude
    set({ simulatedTime: date, localSiderealTime: computeLST(date, lon) })
  },

  setPlayback: (speed) => set({ playbackSpeed: speed }),

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  setLocation: (lat, lon, name = '', source = 'manual') => {
    const time = get().simulatedTime
    set({
      latitude: lat,
      longitude: lon,
      locationName: name,
      locationSource: source,
      localSiderealTime: computeLST(time, lon),
    })
  },

  selectObject: (obj: SelectedObject | null) => set({ selectedObject: obj }),

  toggleSetting: (key: DisplayToggle) =>
    set((s) => ({ [key]: !s[key] } as unknown as Partial<PlanetariumState>)),

  setViewDirection: (az, alt) => set({ viewAzimuth: az, viewAltitude: alt }),

  setFov: (fov) => set({ fov }),

  setLocalSiderealTime: (lst) => set({ localSiderealTime: lst }),
}))

export default usePlanetariumStore
