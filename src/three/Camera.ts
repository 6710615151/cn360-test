import * as THREE from 'three'

export class CameraManager {
  readonly camera: THREE.PerspectiveCamera
  private aspect: number

  constructor(width: number, height: number) {
    this.aspect = width / height
    this.camera = new THREE.PerspectiveCamera(70, this.aspect, 0.01, 1000)
    this.camera.position.set(0, 1.6, 3) // standing height
  }

  resize(width: number, height: number) {
    this.aspect = width / height
    this.camera.aspect = this.aspect
    this.camera.updateProjectionMatrix()
  }

  setPosition(x: number, y: number, z: number) {
    this.camera.position.set(x, y, z)
  }

  lookAt(target: THREE.Vector3) {
    this.camera.lookAt(target)
  }
}
