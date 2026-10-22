import * as THREE from 'three'

export class HorizonMask {
  mesh: THREE.Mesh
  private material: THREE.MeshBasicMaterial

  constructor() {
    // Large disc below the horizon plane
    const geo = new THREE.CircleGeometry(490, 64)
    const mat = (this.material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.DoubleSide,
      depthWrite: true,
    }))
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.rotation.x = Math.PI / 2
    this.mesh.position.y = -0.5
    this.mesh.renderOrder = 1
  }

  /** Ground colour: black at night, a dark version of the horizon sky by day. */
  setGround(rgb: readonly [number, number, number]) {
    this.material.color.setRGB(rgb[0], rgb[1], rgb[2])
  }
}
