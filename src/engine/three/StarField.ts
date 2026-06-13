import * as THREE from 'three'
import type { HygStar } from '@/types/star'

const vertexShader = `
uniform float uLST;
uniform float uLat;
uniform float uFovScale;

attribute float aRa;
attribute float aDec;
attribute float aMag;
attribute float aBV;

varying vec3 vColor;
varying float vMag;

// B-V color index to RGB (approximate blackbody)
vec3 bvToRgb(float bv) {
  bv = clamp(bv, -0.4, 2.0);
  vec3 c;
  if (bv < 0.0) {
    c = mix(vec3(0.6, 0.7, 1.0), vec3(0.75, 0.85, 1.0), (bv + 0.4) / 0.4);
  } else if (bv < 0.5) {
    c = mix(vec3(0.9, 0.95, 1.0), vec3(1.0, 1.0, 0.9), bv / 0.5);
  } else if (bv < 1.0) {
    c = mix(vec3(1.0, 1.0, 0.8), vec3(1.0, 0.85, 0.5), (bv - 0.5) / 0.5);
  } else {
    c = mix(vec3(1.0, 0.7, 0.3), vec3(1.0, 0.4, 0.2), (bv - 1.0) / 1.0);
  }
  return c;
}

void main() {
  float ha = uLST - aRa;
  float sinAlt = sin(aDec) * sin(uLat) + cos(aDec) * cos(uLat) * cos(ha);
  float alt = asin(clamp(sinAlt, -1.0, 1.0));

  if (alt < -0.017) {  // ~-1 degree
    gl_PointSize = 0.0;
    vColor = vec3(0.0);
    vMag = aMag;
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0); // clip away
    return;
  }

  float az = atan(sin(ha), cos(ha) * sin(uLat) - tan(aDec) * cos(uLat));

  float cosAlt = cos(alt);
  vec3 pos = vec3(cosAlt * sin(az), sin(alt), -cosAlt * cos(az)) * 100.0;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

  // Magnitude to point size: smaller mag = bigger/brighter
  float size = uFovScale * pow(10.0, (-aMag + 6.5) * 0.2);
  gl_PointSize = clamp(size, 0.5, 16.0);

  // Dim stars near horizon for realism
  float fade = smoothstep(0.0, 0.05, alt);
  vColor = bvToRgb(aBV) * fade;
  vMag = aMag;
}
`

const fragmentShader = `
varying vec3 vColor;
varying float vMag;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  // Soft disc with bright center
  float alpha = smoothstep(0.5, 0.0, d);
  float core = smoothstep(0.3, 0.0, d);
  vec3 color = mix(vColor * 0.6, vColor, core);
  gl_FragColor = vec4(color, alpha * alpha);
}
`

export class StarField {
  points: THREE.Points
  private material: THREE.ShaderMaterial
  private stars: HygStar[]

  constructor(stars: HygStar[]) {
    this.stars = stars
    const geo = new THREE.BufferGeometry()

    const ra = new Float32Array(stars.length)
    const dec = new Float32Array(stars.length)
    const mag = new Float32Array(stars.length)
    const bv = new Float32Array(stars.length)
    // dummy positions (shader computes actual positions)
    const positions = new Float32Array(stars.length * 3)

    for (let i = 0; i < stars.length; i++) {
      ra[i] = stars[i].ra
      dec[i] = stars[i].dec
      mag[i] = stars[i].mag
      bv[i] = stars[i].ci
      positions[i * 3] = 0
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = 0
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aRa', new THREE.BufferAttribute(ra, 1))
    geo.setAttribute('aDec', new THREE.BufferAttribute(dec, 1))
    geo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1))
    geo.setAttribute('aBV', new THREE.BufferAttribute(bv, 1))

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uLST: { value: 0 },
        uLat: { value: 0.623 }, // ~35.7 deg (Tokyo)
        uFovScale: { value: 1.5 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this.points = new THREE.Points(geo, this.material)
  }

  updateUniforms(lst: number, latRad: number, fovScale: number) {
    this.material.uniforms.uLST.value = lst
    this.material.uniforms.uLat.value = latRad
    this.material.uniforms.uFovScale.value = fovScale
  }

  getStars(): HygStar[] {
    return this.stars
  }
}
