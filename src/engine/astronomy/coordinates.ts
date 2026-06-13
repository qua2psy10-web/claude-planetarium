// Convert equatorial (RA/Dec in radians) to horizontal (Alt/Az in radians)
export function equatorialToHorizontal(
  ra: number,
  dec: number,
  lst: number,
  latRad: number,
): { altitude: number; azimuth: number } {
  const ha = lst - ra

  const sinAlt = Math.sin(dec) * Math.sin(latRad) + Math.cos(dec) * Math.cos(latRad) * Math.cos(ha)
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt)))

  const cosAz = (Math.sin(dec) - Math.sin(altitude) * Math.sin(latRad)) / (Math.cos(altitude) * Math.cos(latRad))
  const az = Math.acos(Math.max(-1, Math.min(1, cosAz)))
  const azimuth = Math.sin(ha) > 0 ? 2 * Math.PI - az : az

  return { altitude, azimuth }
}

// Convert Alt/Az (radians) to Three.js cartesian (r=100 sphere, Y-up)
export function horizontalToCartesian(altitude: number, azimuth: number, r = 100): [number, number, number] {
  const cosAlt = Math.cos(altitude)
  const x = cosAlt * Math.sin(azimuth)
  const y = Math.sin(altitude)
  const z = -cosAlt * Math.cos(azimuth)
  return [x * r, y * r, z * r]
}

// Convert RA/Dec → Alt/Az → Three.js cartesian
export function raDecToCartesian(
  ra: number,
  dec: number,
  lst: number,
  latRad: number,
  r = 100,
): [number, number, number] {
  const { altitude, azimuth } = equatorialToHorizontal(ra, dec, lst, latRad)
  return horizontalToCartesian(altitude, azimuth, r)
}

export function degToRad(deg: number): number {
  return deg * (Math.PI / 180)
}

export function radToDeg(rad: number): number {
  return rad * (180 / Math.PI)
}
