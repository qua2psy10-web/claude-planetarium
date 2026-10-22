import usePlanetariumStore, { DEFAULT_TOGGLES } from './usePlanetariumStore'
import { decodeShare, encodeShare, type ShareState } from '@/engine/share'
import { computeLST } from '@/engine/astronomy/time'
import type { DisplayToggle } from '@/types/store'

export interface ShareOptions {
  includeTime: boolean
  includeLocation: boolean
  includeView: boolean
}

/** Opens a shared link: puts whatever the link carries into the store. Call once, before the first render. */
export function applyShareLink(search: string = window.location.search) {
  const share = decodeShare(search)
  const patch: Record<string, unknown> = {}

  if (share.time) {
    // A shared moment stays put: the clock starts stopped.
    patch.simulatedTime = share.time
    patch.isPlaying = false
  }
  if (share.location) {
    patch.latitude = share.location.lat
    patch.longitude = share.location.lon
    patch.locationName = share.location.name || `${share.location.lat.toFixed(2)}, ${share.location.lon.toFixed(2)}`
    patch.locationSource = 'manual'
  }
  if (share.view) {
    patch.viewAzimuth = share.view.az
    patch.viewAltitude = share.view.alt
    patch.fov = share.view.fov
  }
  Object.assign(patch, share.toggles)
  if (Object.keys(patch).length === 0) return

  const s = usePlanetariumStore.getState()
  const time = (patch.simulatedTime as Date | undefined) ?? s.simulatedTime
  const lon = (patch.longitude as number | undefined) ?? s.longitude
  usePlanetariumStore.setState({ ...patch, localSiderealTime: computeLST(time, lon) })
}

/** The link for the planetarium as it is now. */
export function buildShareUrl(options: ShareOptions): string {
  const s = usePlanetariumStore.getState()
  const state: ShareState = {}
  if (options.includeTime) state.time = s.simulatedTime
  if (options.includeLocation) state.location = { lat: s.latitude, lon: s.longitude, name: s.locationName }
  if (options.includeView) state.view = { az: s.viewAzimuth, alt: s.viewAltitude, fov: s.fov }

  const toggles: Partial<Record<DisplayToggle, boolean>> = {}
  for (const key of Object.keys(DEFAULT_TOGGLES) as DisplayToggle[]) {
    if (s[key] !== DEFAULT_TOGGLES[key]) toggles[key] = s[key]
  }
  state.toggles = toggles

  const query = encodeShare(state)
  const base = `${window.location.origin}${window.location.pathname}`
  return query ? `${base}?${query}` : base
}
