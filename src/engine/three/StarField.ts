import * as THREE from 'three'
import type { HygStar } from '@/types/star'

const vertexShader = `
uniform float uLST;
uniform float uLat;
uniform float uFovScale;
uniform float uPixelRatio;

attribute float aRa;
attribute float aDec;
attribute float aMag;
attribute float aBV;

varying vec3 vColor;
varying float vBrightness;

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
    vBrightness = 0.0;
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0); // clip away
    return;
  }

  float az = atan(sin(ha), cos(ha) * sin(uLat) - tan(aDec) * cos(uLat));

  float cosAlt = cos(alt);
  vec3 pos = vec3(cosAlt * sin(az), sin(alt), -cosAlt * cos(az)) * 100.0;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

  // Magnitude to point size in CSS pixels (gl_PointSize is in device pixels, so
  // scale by the pixel ratio or Retina screens draw everything at half size).
  // Even the faintest star gets a ~2px core so it stays visible on dark panels.
  float size = (1.8 + (6.5 - aMag) * 0.9) * pow(uFovScale, 0.5);
  gl_PointSize = clamp(size, 2.0, 22.0) * uPixelRatio;

  // Brightness is separate from size: faint stars are dimmer but never vanish.
  vBrightness = clamp(0.45 + (6.5 - aMag) * 0.2, 0.45, 1.0);

  // Dim stars near horizon for realism
  float fade = smoothstep(0.0, 0.05, alt);
  vColor = bvToRgb(aBV) * fade;
}
`

const fragmentShader = `
varying vec3 vColor;
varying float vBrightness;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  // Gaussian-like profile: full intensity at the centre, soft glow at the edge
  float intensity = exp(-d * d * 14.0);
  // Additive blending multiplies colour by alpha, so alpha carries the profile
  gl_FragColor = vec4(vColor * vBrightness, intensity);
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
        uPixelRatio: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this.points = new THREE.Points(geo, this.material)
    // All position attributes are (0,0,0) since the shader computes positions from RA/Dec.
    // Disable frustum culling so Three.js doesn't skip this object.
    this.points.frustumCulled = false
  }

  updateUniforms(lst: number, latRad: number, fovScale: number) {
    this.material.uniforms.uLST.value = lst
    this.material.uniforms.uLat.value = latRad
    this.material.uniforms.uFovScale.value = fovScale
  }

  setPixelRatio(ratio: number) {
    this.material.uniforms.uPixelRatio.value = ratio
  }

  getStars(): HygStar[] {
    return this.stars
  }
}
