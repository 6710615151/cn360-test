import * as THREE from 'three'
import { XRManager } from './XRManager'

// Mutable runtime state — NOT in React/Zustand to avoid per-frame re-renders
export const headsetRuntime = {
  position: new THREE.Vector3(),
  rotation: new THREE.Euler(),
  quaternion: new THREE.Quaternion(),
  direction: new THREE.Vector3(0, 0, -1),
  matrix: new THREE.Matrix4(),
  connected: false,
}

export class HeadsetManager {
  private xrManager: XRManager
  private camera: THREE.PerspectiveCamera
  // Desktop simulation euler
  private desktopYaw = 0
  private desktopPitch = 0

  constructor(xrManager: XRManager, camera: THREE.PerspectiveCamera) {
    this.xrManager = xrManager
    this.camera = camera
  }

  /** Called every frame from the game loop */
  update(frame?: XRFrame) {
    if (this.xrManager.isActive() && frame) {
      this.updateFromXR(frame)
    } else {
      this.updateFromCamera()
    }
  }

  private updateFromXR(frame: XRFrame) {
    const pose = this.xrManager.getViewerPose(frame)
    if (!pose) return

    const t = pose.transform.position
    const r = pose.transform.orientation

    headsetRuntime.position.set(t.x, t.y, t.z)
    headsetRuntime.quaternion.set(r.x, r.y, r.z, r.w)
    headsetRuntime.rotation.setFromQuaternion(headsetRuntime.quaternion)
    headsetRuntime.direction.set(0, 0, -1).applyQuaternion(headsetRuntime.quaternion)
    headsetRuntime.connected = true
  }

  private updateFromCamera() {
    headsetRuntime.position.copy(this.camera.position)
    headsetRuntime.quaternion.copy(this.camera.quaternion)
    headsetRuntime.rotation.copy(this.camera.rotation)
    headsetRuntime.direction.set(0, 0, -1).applyQuaternion(this.camera.quaternion)
    headsetRuntime.connected = false
  }

  applyDesktopRotation(deltaYaw: number, deltaPitch: number) {
    this.desktopYaw += deltaYaw
    this.desktopPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.desktopPitch + deltaPitch))
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.y = this.desktopYaw
    this.camera.rotation.x = this.desktopPitch
  }

  getPosition() { return headsetRuntime.position }
  getRotation() { return headsetRuntime.rotation }
  getDirection() { return headsetRuntime.direction }
  isConnected() { return headsetRuntime.connected }

  getDebugInfo() {
    const p = headsetRuntime.position
    const r = headsetRuntime.rotation
    return {
      position: { x: p.x.toFixed(3), y: p.y.toFixed(3), z: p.z.toFixed(3) },
      rotation: {
        x: (r.x * 180 / Math.PI).toFixed(1),
        y: (r.y * 180 / Math.PI).toFixed(1),
        z: (r.z * 180 / Math.PI).toFixed(1),
      },
      connected: headsetRuntime.connected,
    }
  }
}
