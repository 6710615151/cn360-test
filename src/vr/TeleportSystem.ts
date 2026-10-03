import * as THREE from 'three'
import { InputManager } from './InputManager'

// ─── Teleport locomotion with arc preview ────────────────────────────────────

export class TeleportSystem {
  private scene: THREE.Scene
  private input: InputManager
  private camera: THREE.PerspectiveCamera

  private arcLine: THREE.Line | null = null
  private landingMarker: THREE.Mesh | null = null
  private arcPoints: THREE.Vector3[] = []

  private isAiming = false
  private targetPoint: THREE.Vector3 | null = null
  private floorY = 0

  // Valid landing area meshes
  private validFloors: THREE.Object3D[] = []

  private readonly GRAVITY = -9.8
  private readonly ARC_SEGMENTS = 30
  private readonly THROW_SPEED = 8
  private readonly MAX_DIST = 12

  constructor(scene: THREE.Scene, input: InputManager, camera: THREE.PerspectiveCamera) {
    this.scene = scene
    this.input = input
    this.camera = camera
    this.buildVisuals()
  }

  setValidFloors(floors: THREE.Object3D[]) {
    this.validFloors = floors
  }

  setFloorY(y: number) {
    this.floorY = y
  }

  private buildVisuals() {
    // Arc line
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(this.ARC_SEGMENTS * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.LineBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.7,
    })
    this.arcLine = new THREE.Line(geo, mat)
    this.arcLine.visible = false
    this.arcLine.frustumCulled = false
    this.scene.add(this.arcLine)

    // Landing marker — a ring on the floor
    const markerGeo = new THREE.RingGeometry(0.25, 0.35, 16)
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    })
    this.landingMarker = new THREE.Mesh(markerGeo, markerMat)
    this.landingMarker.rotation.x = -Math.PI / 2
    this.landingMarker.visible = false
    this.scene.add(this.landingMarker)
  }

  /** Call every frame */
  update(delta: number): THREE.Vector3 | null {
    // Trigger teleport aim with left primary button (A/X) or right thumbstick down
    const aimTrigger = this.input.getButton('primary', 'left') ||
      this.input.getAxis('leftY') < -0.8

    // Confirm teleport on release
    const wasAiming = this.isAiming
    this.isAiming = aimTrigger

    if (this.isAiming) {
      this.updateArc()
    } else {
      this.hideVisuals()
      // On release — execute teleport
      if (wasAiming && this.targetPoint) {
        const dest = this.targetPoint.clone()
        this.targetPoint = null
        return dest
      }
    }

    return null
  }

  private updateArc() {
    // Origin: left controller or camera slightly offset left
    const origin = new THREE.Vector3()
    const direction = new THREE.Vector3()

    const leftCtrl = this.input.getController('left')
    if (leftCtrl.connected) {
      origin.copy(leftCtrl.position)
      // Point forward-down from controller
      direction.set(0, 0.4, -1).normalize()
      direction.applyQuaternion(leftCtrl.quaternion)
    } else {
      this.camera.getWorldPosition(origin)
      this.camera.getWorldDirection(direction)
      direction.y -= 0.3
      direction.normalize()
    }

    // Compute parabolic arc
    const points: THREE.Vector3[] = []
    const velocity = direction.clone().multiplyScalar(this.THROW_SPEED)
    const pos = origin.clone()
    const dt = 0.05
    let landed = false
    this.targetPoint = null

    for (let i = 0; i < this.ARC_SEGMENTS; i++) {
      points.push(pos.clone())
      velocity.y += this.GRAVITY * dt
      pos.addScaledVector(velocity, dt)

      // Check if arc hits the floor plane
      if (pos.y <= this.floorY + 0.05) {
        pos.y = this.floorY + 0.01
        points.push(pos.clone())
        this.targetPoint = pos.clone()
        landed = true
        break
      }

      // Exceeded max distance
      if (pos.distanceTo(origin) > this.MAX_DIST) break
    }

    this.arcPoints = points

    // Update line geometry
    if (this.arcLine) {
      const posAttr = this.arcLine.geometry.attributes.position as THREE.BufferAttribute
      const count = Math.min(points.length, this.ARC_SEGMENTS)
      for (let i = 0; i < this.ARC_SEGMENTS; i++) {
        const p = i < count ? points[i] : points[count - 1]
        posAttr.setXYZ(i, p.x, p.y, p.z)
      }
      posAttr.needsUpdate = true
      this.arcLine.geometry.setDrawRange(0, count)
      this.arcLine.visible = true

      // Color: green if valid landing, red if not
      const mat = this.arcLine.material as THREE.LineBasicMaterial
      mat.color.setHex(landed ? 0x00f5ff : 0xff2200)
    }

    // Update landing marker
    if (this.landingMarker) {
      if (landed && this.targetPoint) {
        this.landingMarker.position.copy(this.targetPoint)
        this.landingMarker.position.y = this.floorY + 0.02
        this.landingMarker.visible = true
      } else {
        this.landingMarker.visible = false
      }
    }
  }

  private hideVisuals() {
    if (this.arcLine) this.arcLine.visible = false
    if (this.landingMarker) this.landingMarker.visible = false
  }

  dispose() {
    if (this.arcLine) {
      this.scene.remove(this.arcLine)
      this.arcLine.geometry.dispose()
      ;(this.arcLine.material as THREE.Material).dispose()
    }
    if (this.landingMarker) {
      this.scene.remove(this.landingMarker)
      this.landingMarker.geometry.dispose()
      ;(this.landingMarker.material as THREE.Material).dispose()
    }
  }
}
