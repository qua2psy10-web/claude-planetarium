import * as THREE from 'three'

// Fragment position on the sphere -> J2000 RA/Dec -> lookup in the equirectangular map
// built by scripts/build_milkyway.mjs (x: right ascension -180..180, y: declination).
// The direction uses the scene's convention (x = east, y = up, -z = north), so with
// d = (cosAlt sin az, sin alt, -cosAlt cos az):
//   sin dec = d.y sin(lat) - d.z cos(lat)
//   cos dec cos H = d.y cos(lat) + d.z sin(lat),  cos dec sin H = -d.x
// and ra = LST - H. The star shaders go the other way and use the same precession matrix.
const vertexShader = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform sampler2D uMap;
uniform mat3 uPrec;
uniform float uLST;
uniform float uLat;
uniform float uStrength;
varying vec3 vDir;

void main() {
  vec3 d = normalize(vDir);
  vec3 h = vec3(d.y * cos(uLat) + d.z * sin(uLat), -d.x, d.y * sin(uLat) - d.z * cos(uLat));
  float cl = cos(uLST);
  float sl = sin(uLST);
  vec3 e = vec3(cl * h.x + sl * h.y, sl * h.x - cl * h.y, h.z);  // equator and equinox of date
  vec3 j = e * uPrec;                                            // M^T e: back to J2000

  vec2 uv = vec2(atan(j.y, j.x) / 6.28318530718 + 0.5, asin(clamp(j.z, -1.0, 1.0)) / 3.14159265359 + 0.5);
  float glow = texture2D(uMap, uv).r;

  // Light from near the horizon crosses more air.
  float extinction = mix(0.2, 1.0, smoothstep(0.0, 0.4, d.y));
  // Faint outer regions are cool and bluish; the dense star clouds of the core are warmer.
  vec3 tint = mix(vec3(0.55, 0.64, 0.9), vec3(1.0, 0.88, 0.7), smoothstep(0.55, 1.0, glow));
  gl_FragColor = vec4(tint * glow * uStrength * extinction, 1.0);
}
`

/** The Milky Way as a glow on the sky sphere, drawn behind the stars. */
export class MilkyWay {
  mesh: THREE.Mesh
  private material: THREE.ShaderMaterial
  private loaded = false
  private wanted = true

  constructor(precession: THREE.Matrix3) {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uMap: { value: null },
        uPrec: { value: precession },
        uLST: { value: 0 },
        uLat: { value: 0.623 },
        uStrength: { value: 0.3 },
      },
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    })
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(450, 64, 32), this.material)
    this.mesh.renderOrder = -1
    this.mesh.visible = false // until the map has loaded

    new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}data/milkyway.png`, (tex) => {
      // No mipmaps: the longitude wraps inside the shader, and mip selection would draw a seam.
      tex.generateMipmaps = false
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.wrapS = THREE.RepeatWrapping
      this.material.uniforms.uMap.value = tex
      this.loaded = true
      this.mesh.visible = this.wanted
    })
  }

  updateUniforms(lst: number, latRad: number) {
    this.material.uniforms.uLST.value = lst
    this.material.uniforms.uLat.value = latRad
  }

  setVisible(v: boolean) {
    this.wanted = v
    this.mesh.visible = v && this.loaded
  }
}
