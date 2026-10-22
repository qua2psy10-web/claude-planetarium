#!/usr/bin/env node
/**
 * Refresh public/data/tle.json (the ISS orbital elements bundled with the site) from a TLE text file.
 * The deploy workflow runs this before every build:
 *
 *   curl -fsS "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE" -o iss.tle
 *   node scripts/update_tle.mjs iss.tle
 *
 * The app also fetches CelesTrak directly in the browser; this file is the fallback for when that fails.
 * Exits non-zero (leaving the old file) if the text is not a valid element set for the ISS.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/update_tle.mjs <tle text file>')
  process.exit(2)
}

const checksum = (line) => {
  let sum = 0
  for (let i = 0; i < 68; i++) {
    const c = line[i]
    if (c >= '0' && c <= '9') sum += Number(c)
    else if (c === '-') sum += 1
  }
  return sum % 10 === Number(line[68])
}

const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean)
const i = lines.findIndex((l) => l.startsWith('1 ') && l.length >= 69)
const line1 = lines[i]?.slice(0, 69)
const line2 = lines[i + 1]?.slice(0, 69)
const fail = (msg) => {
  console.error(`not updating tle.json: ${msg}`)
  process.exit(1)
}
if (!line1 || !line2 || !line2.startsWith('2 ')) fail('no element set found')
if (!checksum(line1) || !checksum(line2)) fail('checksum mismatch')
if (line1.slice(2, 7).trim() !== '25544' || line2.slice(2, 7).trim() !== '25544') fail('not the ISS (25544)')

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'tle.json')
const name = i > 0 ? lines[i - 1].replace(/^0 /, '').trim() : 'ISS (ZARYA)'
fs.writeFileSync(out, JSON.stringify({ fetchedAt: new Date().toISOString(), source: 'CelesTrak', iss: `${name}\n${line1}\n${line2}\n` }, null, 2) + '\n')
console.log(`tle.json updated: ${name}, epoch ${line1.slice(18, 32)}`)
