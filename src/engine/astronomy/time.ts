export function dateToJulian(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5
}

export function julianToDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000)
}

// Greenwich Mean Sidereal Time in radians
export function computeGMST(date: Date): number {
  const jd = dateToJulian(date)
  const T = (jd - 2451545.0) / 36525.0
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + T * T * 0.000387933 - T * T * T / 38710000
  gmst = ((gmst % 360) + 360) % 360
  return gmst * (Math.PI / 180)
}

// Local Sidereal Time in radians
export function computeLST(date: Date, longitudeDeg: number): number {
  const gmst = computeGMST(date)
  const lst = gmst + longitudeDeg * (Math.PI / 180)
  return ((lst % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
}
