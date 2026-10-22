import * as THREE from 'three'
import type { SkyColors } from '@/engine/astronomy/skyBrightness'

// The colours come from skyBrightness.ts (by the Sun's altitude). At night the zenith/horizon
// pair and band width reproduce the original thin blue haze at the horizon.
const vertexShader = `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform float uGlowAmt;
uniform float uBand;
uniform vec3 uSunDir;
varying vec3 vPos;
void main() {
  vec3 d = normalize(vPos);
  float y = d.y;
  float t = clamp((y + 0.08) / (uBand + 0.08), 0.0, 1.0);
  vec3 color = mix(uHorizon, uZenith, t * t);

  // Brighter and warmer on the Sun's side, strongest low down; plus a tight halo around the Sun.
  float cosS = max(dot(d, uSunDir), 0.0);
  float low = 1.0 - t * t;
  color += uGlow * uGlowAmt * (pow(cosS, 6.0) * (0.25 + 0.75 * low) + 0.5 * pow(cosS, 48.0));

  // slight glow below horizon
  if (y < 0.0) {
    float below = clamp(-y / 0.05, 0.0, 1.0);
    color = mix(color, vec3(0.0, 0.0, 0.0), below);
  }
  gl_FragColor = vec4(min(color, vec3(1.0)), 1.0);
}
`

const OFF: SkyColors = {
  zenith: [0, 0, 0.02],
  horizon: [0.01, 0.01, 0.03],
  glow: [0, 0, 0],
  glowAmt: 0,
  band: 0.1,
}

export class SkyDome {
  mesh: THREE.Mesh
  material: THREE.ShaderMaterial

  constructor() {
    const geo = new THREE.SphereGeometry(500, 32, 16)
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uZenith: { value: new THREE.Vector3(0, 0, 0.02) },
        uHorizon: { value: new THREE.Vector3(0.05, 0.08, 0.2) },
        uGlow: { value: new THREE.Vector3() },
        uGlowAmt: { value: 0 },
        uBand: { value: 0.1 },
        uSunDir: { value: new THREE.Vector3(0, -1, 0) },
      },
      side: THREE.BackSide,
      depthWrite: false,
    })
    this.mesh = new THREE.Mesh(geo, this.material)
  }

  /** `colors` null draws a plain dark sky (atmosphere off). `sunDir` is a unit vector in scene coordinates. */
  setSky(colors: SkyColors | null, sunDir: [number, number, number]) {
    const c = colors ?? OFF
    const u = this.material.uniforms
    u.uZenith.value.set(...c.zenith)
    u.uHorizon.value.set(...c.horizon)
    u.uGlow.value.set(...c.glow)
    u.uGlowAmt.value = c.glowAmt
    u.uBand.value = c.band
    u.uSunDir.value.set(...sunDir)
  }
}
