import * as THREE from 'three'

const vertexShader = `
varying float vY;
void main() {
  vY = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
varying float vY;
uniform bool uAtmosphere;
void main() {
  float t = clamp((vY + 0.08) / 0.18, 0.0, 1.0);
  vec3 zenith = vec3(0.0, 0.0, 0.0);
  vec3 horizon = uAtmosphere ? vec3(0.03, 0.05, 0.12) : vec3(0.01, 0.01, 0.02);
  vec3 color = mix(horizon, zenith, t * t);
  // slight glow below horizon
  if (vY < 0.0) {
    float below = clamp(-vY / 0.05, 0.0, 1.0);
    color = mix(color, vec3(0.0, 0.0, 0.0), below);
  }
  gl_FragColor = vec4(color, 1.0);
}
`

export class SkyDome {
  mesh: THREE.Mesh
  material: THREE.ShaderMaterial

  constructor() {
    const geo = new THREE.SphereGeometry(500, 32, 16)
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uAtmosphere: { value: true } },
      side: THREE.BackSide,
      depthWrite: false,
    })
    this.mesh = new THREE.Mesh(geo, this.material)
  }

  setAtmosphere(on: boolean) {
    this.material.uniforms.uAtmosphere.value = on
  }
}
