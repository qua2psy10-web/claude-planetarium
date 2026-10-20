import * as THREE from 'three'

const DEG = Math.PI / 180

// Stay just short of the poles: the az formula below uses tan(dec), which blows
// up at exactly +-90 degrees and would misplace the vertex.
const MAX_DEC = 89.9

// Same RA/Dec -> Alt/Az transform as StarField.ts and ConstellationLines.ts, run on
// the GPU so the grid follows the sky when time or location changes.
// Azimuth from the atan form is measured from south; the scene uses azimuth from
// north (+180 degrees), hence the negated x and z. Keep in sync with those files.
const vertexShader = `
uniform float uLST;
uniform float uLat;

attribute float aRa;
attribute float aDec;
attribute float aKind;

varying float vKind;

void main() {
  float ha = uLST - aRa;
  float sinAlt = sin(aDec) * sin(uLat) + cos(aDec) * cos(uLat) * cos(ha);
  float alt = asin(clamp(sinAlt, -1.0, 1.0));
  float az = atan(sin(ha), cos(ha) * sin(uLat) - tan(aDec) * cos(uLat));
  float cosAlt = cos(alt);
  vec3 pos = vec3(-cosAlt * sin(az), sin(alt), cosAlt * cos(az)) * 97.0;
  vKind = aKind;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const fragmentShader = `
varying float vKind;
void main() {
  // The celestial equator (kind 1) is drawn brighter than the other grid lines.
  gl_FragColor = vKind > 0.5
    ? vec4(0.35, 0.85, 0.65, 0.75)
    : vec4(0.25, 0.65, 0.55, 0.38);
}
`

/**
 * Equatorial coordinate grid: declination circles every 15 degrees and right
 * ascension meridians every hour (15 degrees).
 */
export class EquatorialGrid {
  lineSegments: THREE.LineSegments
  private material: THREE.ShaderMaterial

  constructor() {
    const ra: number[] = []
    const dec: number[] = []
    const kind: number[] = []

    const segment = (r1: number, d1: number, r2: number, d2: number, k: number) => {
      ra.push(r1, r2)
      dec.push(d1, d2)
      kind.push(k, k)
    }

    // Declination circles, sampled every 2 degrees of RA so they look round.
    for (let d = -75; d <= 75; d += 15) {
      const k = d === 0 ? 1 : 0
      for (let r = 0; r < 360; r += 2) segment(r * DEG, d * DEG, (r + 2) * DEG, d * DEG, k)
    }

    // RA meridians from pole to pole, sampled every 3 degrees of declination.
    for (let h = 0; h < 24; h++) {
      const r = h * 15 * DEG
      for (let d = -MAX_DEC; d < MAX_DEC; d += 3) {
        segment(r, d * DEG, r, Math.min(d + 3, MAX_DEC) * DEG, 0)
      }
    }

    const geo = new THREE.BufferGeometry()
    // Positions are computed in the shader; this attribute only sets the vertex count.
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ra.length * 3), 3))
    geo.setAttribute('aRa', new THREE.BufferAttribute(new Float32Array(ra), 1))
    geo.setAttribute('aDec', new THREE.BufferAttribute(new Float32Array(dec), 1))
    geo.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(kind), 1))

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uLST: { value: 0 },
        uLat: { value: 0.623 },
      },
      transparent: true,
      depthWrite: false,
    })

    this.lineSegments = new THREE.LineSegments(geo, this.material)
    // All positions are (0,0,0) on the CPU, so the bounding sphere is empty and
    // Three.js would cull the whole object.
    this.lineSegments.frustumCulled = false
    this.lineSegments.visible = false
  }

  updateUniforms(lst: number, latRad: number) {
    this.material.uniforms.uLST.value = lst
    this.material.uniforms.uLat.value = latRad
  }

  setVisible(v: boolean) {
    this.lineSegments.visible = v
  }
}
