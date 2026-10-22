import * as Astronomy from 'astronomy-engine'

/** 3x3 rotation matrix, row-major. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number]

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

let cachedDay = Number.NaN
let cached: Mat3 = IDENTITY

/**
 * Rotation from J2000 equatorial coordinates (the star catalogue frame) to the
 * true equator and equinox of `date` (what planets, the Moon and the sidereal
 * time use). Precession is ~50"/yr, so the matrix is cached per day.
 */
export function precessionMatrix(date: Date): Mat3 {
  const day = Math.round(date.getTime() / 86400000)
  if (day === cachedDay) return cached
  const time = Astronomy.MakeTime(new Date(day * 86400000))
  const rot = Astronomy.Rotation_EQJ_EQD(time)
  // Column j of the matrix is the rotated basis vector e_j.
  const col = [
    Astronomy.RotateVector(rot, new Astronomy.Vector(1, 0, 0, time)),
    Astronomy.RotateVector(rot, new Astronomy.Vector(0, 1, 0, time)),
    Astronomy.RotateVector(rot, new Astronomy.Vector(0, 0, 1, time)),
  ]
  cached = [
    col[0].x, col[1].x, col[2].x,
    col[0].y, col[1].y, col[2].y,
    col[0].z, col[1].z, col[2].z,
  ]
  cachedDay = day
  return cached
}

/** Apply a precession matrix to an RA/Dec pair (radians). */
export function precessRaDec(ra: number, dec: number, m: Mat3): { ra: number; dec: number } {
  const cd = Math.cos(dec)
  const x = cd * Math.cos(ra)
  const y = cd * Math.sin(ra)
  const z = Math.sin(dec)
  const rx = m[0] * x + m[1] * y + m[2] * z
  const ry = m[3] * x + m[4] * y + m[5] * z
  const rz = m[6] * x + m[7] * y + m[8] * z
  const r = Math.atan2(ry, rx)
  return { ra: r < 0 ? r + 2 * Math.PI : r, dec: Math.asin(Math.max(-1, Math.min(1, rz))) }
}

/**
 * GLSL for the vertex shaders: declares `uPrec` and `precess(ra, dec)` returning
 * vec2(ra, dec). Shared so stars and constellation lines cannot drift apart.
 */
export const PRECESS_GLSL = `
uniform mat3 uPrec;

vec2 precess(float ra, float dec) {
  float cd = cos(dec);
  vec3 v = uPrec * vec3(cd * cos(ra), cd * sin(ra), sin(dec));
  return vec2(atan(v.y, v.x), asin(clamp(v.z, -1.0, 1.0)));
}
`
