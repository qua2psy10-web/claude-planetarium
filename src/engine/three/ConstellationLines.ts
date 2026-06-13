import * as THREE from 'three'
import type { HygStar } from '@/types/star'
import type { ConstellationLines as ConLinesData } from '@/types/constellation'

const vertexShader = `
uniform float uLST;
uniform float uLat;

attribute float aRa;
attribute float aDec;

void main() {
  float ha = uLST - aRa;
  float sinAlt = sin(aDec) * sin(uLat) + cos(aDec) * cos(uLat) * cos(ha);
  float alt = asin(clamp(sinAlt, -1.0, 1.0));
  float az = atan(sin(ha), cos(ha) * sin(uLat) - tan(aDec) * cos(uLat));
  float cosAlt = cos(alt);
  vec3 pos = vec3(cosAlt * sin(az), sin(alt), -cosAlt * cos(az)) * 98.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const fragmentShader = `
void main() {
  gl_FragColor = vec4(0.4, 0.5, 0.8, 0.5);
}
`

export class ConstellationLines {
  lineSegments: THREE.LineSegments
  private material: THREE.ShaderMaterial

  constructor(stars: HygStar[], linesData: ConLinesData) {
    const hipMap = new Map<number, HygStar>()
    for (const s of stars) hipMap.set(s.hip, s)

    const raArr: number[] = []
    const decArr: number[] = []
    const positions: number[] = []

    for (const pairs of Object.values(linesData)) {
      for (const [h1, h2] of pairs) {
        const s1 = hipMap.get(h1)
        const s2 = hipMap.get(h2)
        if (!s1 || !s2) continue
        // Two vertices per line segment
        raArr.push(s1.ra, s2.ra)
        decArr.push(s1.dec, s2.dec)
        positions.push(0, 0, 0, 0, 0, 0)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
    geo.setAttribute('aRa', new THREE.BufferAttribute(new Float32Array(raArr), 1))
    geo.setAttribute('aDec', new THREE.BufferAttribute(new Float32Array(decArr), 1))

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
  }

  updateUniforms(lst: number, latRad: number) {
    this.material.uniforms.uLST.value = lst
    this.material.uniforms.uLat.value = latRad
  }
}
