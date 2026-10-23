import { create } from 'zustand'
import type { PlanetariumState, SelectedObject, DisplayToggle } from '@/types/store'
import { computeLST } from '@/engine/astronomy/time'

/** What each display switch starts as. Share links record only the switches that differ from this. */
export const DEFAULT_TOGGLES: Record<DisplayToggle, boolean> = {
  showConstellationLines: true,
  showConstellationNames: true,
  showPlanetLabels: true,
  showEquatorialGrid: false,
  showAltazGrid: false,
  showMeteors: true,
  showPlanetTrails: true,
  showAnalemma: true,
  showComets: true,
  showAtmosphere: true,
  showStarNames: true,
  showMilkyWay: true,
  showDeepSky: true,
  showSatellites: true,
}

/**
 * The field of view is the vertical one, so on a phone held upright the width is only about 40% of it:
 * start wider there (100 degrees is about 57 across) or the sky looks like a keyhole.
 */
const initialFov = () =>
  typeof window !== 'undefined' && window.innerWidth < 800 && window.innerWidth < window.innerHeight ? 100 : 75

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
  fov: initialFov(),

  ...DEFAULT_TOGGLES,

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
