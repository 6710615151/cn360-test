import * as THREE from 'three'
import { ControllerManager } from './ControllerManager'
import { InteractionSystem, Interactable } from '../three/Interaction'

export interface PointerHit {
  interactable: Interactable
  point: THREE.Vector3
  distance: number
  object: THREE.Object3D
}

export class PointerManager {
  private controllers: ControllerManager
  private interaction: InteractionSystem
  private scene: THREE.Scene
  private raycaster = new THREE.Raycaster()

  // Laser line meshes
  private laserLeft: THREE.Line | null = null
  private laserRight: THREE.Line | null = null

  // Dot at hit point
  private dotLeft: THREE.Mesh | null = null
  private dotRight: THREE.Mesh | null = null

  // Current hover state
  private hoveredLeft: Interactable | null = null
  private hoveredRight: Interactable | null = null

  // Desktop raycaster
  private desktopRaycaster = new THREE.Raycaster()
  private camera: THREE.PerspectiveCamera | null = null
  private hoveredDesktop: Interactable | null = null

  private maxDistance = 10

  constructor(
    controllers: ControllerManager,
    interaction: InteractionSystem,
    scene: THREE.Scene
  ) {
    this.controllers = controllers
    this.interaction = interaction
    this.scene = scene
    this.buildLasers()
  }

  setCamera(camera: THREE.PerspectiveCamera) {
    this.camera = camera
  }

  private buildLasers() {
    const makeLaser = (color: number): THREE.Line => {
      const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -this.maxDistance)]
      const geo = new THREE.BufferGeometry().setFromPoints(points)
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6,
        linewidth: 1,
      })
      return new THREE.Line(geo, mat)
    }

    const makeDot = (color: number): THREE.Mesh => {
      const geo = new THREE.SphereGeometry(0.015, 8, 8)
      const mat = new THREE.MeshBasicMaterial({ color })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      this.scene.add(mesh)
      return mesh
    }

    this.laserLeft = makeLaser(0x00f5ff)
    this.laserRight = makeLaser(0xff006e)
    this.dotLeft = makeDot(0x00f5ff)
    this.dotRight = makeDot(0xff006e)

    // Lasers are children of controller groups — added in setupWithControllers
  }

  setupWithControllers() {
    const leftCtrl = this.controllers.getThreeController('left')
    const rightCtrl = this.controllers.getThreeController('right')
    if (leftCtrl && this.laserLeft) leftCtrl.add(this.laserLeft)
    if (rightCtrl && this.laserRight) rightCtrl.add(this.laserRight)
  }

  /** Call every frame */
  update(isVR: boolean) {
    const meshes = this.interaction.getMeshes()

    if (isVR) {
      this.updateVRPointer('left', meshes)
      this.updateVRPointer('right', meshes)
    } else {
      this.updateDesktopPointer(meshes)
    }
  }

  private updateVRPointer(hand: 'left' | 'right', meshes: THREE.Object3D[]) {
    const ctrl = this.controllers.getThreeController(hand)
    const laser = hand === 'left' ? this.laserLeft : this.laserRight
    const dot = hand === 'left' ? this.dotLeft : this.dotRight
    let prevHovered = hand === 'left' ? this.hoveredLeft : this.hoveredRight

    if (!ctrl || !laser || !dot) return

    // Build ray from controller world position + direction
    const origin = new THREE.Vector3()
    const direction = new THREE.Vector3(0, 0, -1)
    ctrl.getWorldPosition(origin)
    ctrl.getWorldDirection(direction)
    direction.negate() // Three.js getWorldDirection points away; negate to get forward

    this.raycaster.set(origin, direction)
    this.raycaster.far = this.maxDistance

    const hits = this.raycaster.intersectObjects(meshes, true)

    if (hits.length > 0) {
      const hit = hits[0]
      const interactable = this.interaction.findByMesh(hit.object)

      // Shorten laser to hit point
      this.setLaserLength(laser, hit.distance)
      dot.visible = true
      dot.position.copy(hit.point)

      if (interactable) {
        if (prevHovered && prevHovered !== interactable) prevHovered.unhover()
        interactable.hover()
        if (hand === 'left') this.hoveredLeft = interactable
        else this.hoveredRight = interactable
        prevHovered = interactable
      }
    } else {
      this.setLaserLength(laser, this.maxDistance)
      dot.visible = false
      if (prevHovered) {
        prevHovered.unhover()
        if (hand === 'left') this.hoveredLeft = null
        else this.hoveredRight = null
      }
    }
  }

  private updateDesktopPointer(meshes: THREE.Object3D[]) {
    if (!this.camera) return

    // Gaze ray from camera center
    this.desktopRaycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera)
    this.desktopRaycaster.far = this.maxDistance

    const hits = this.desktopRaycaster.intersectObjects(meshes, true)
    const prev = this.hoveredDesktop

    if (hits.length > 0) {
      const interactable = this.interaction.findByMesh(hits[0].object)
      if (interactable) {
        if (prev && prev !== interactable) prev.unhover()
        interactable.hover()
        this.hoveredDesktop = interactable
      }
    } else {
      if (prev) { prev.unhover(); this.hoveredDesktop = null }
    }
  }

  /** Call when trigger is pressed to select hovered interactable */
  selectHovered(hand: 'left' | 'right' | 'desktop') {
    const hovered =
      hand === 'left' ? this.hoveredLeft :
      hand === 'right' ? this.hoveredRight :
      this.hoveredDesktop
    if (hovered) {
      hovered.select()
      return hovered
    }
    return null
  }

  releaseSelected(hand: 'left' | 'right' | 'desktop') {
    const hovered =
      hand === 'left' ? this.hoveredLeft :
      hand === 'right' ? this.hoveredRight :
      this.hoveredDesktop
    if (hovered) hovered.release()
  }

  getHovered(hand: 'left' | 'right' | 'desktop'): Interactable | null {
    if (hand === 'left') return this.hoveredLeft
    if (hand === 'right') return this.hoveredRight
    return this.hoveredDesktop
  }

  /** Raycast from arbitrary origin/direction (used by games) */
  castRay(origin: THREE.Vector3, direction: THREE.Vector3): THREE.Intersection | null {
    this.raycaster.set(origin, direction.normalize())
    this.raycaster.far = this.maxDistance
    const meshes = this.interaction.getMeshes()
    const hits = this.raycaster.intersectObjects(meshes, true)
    return hits.length > 0 ? hits[0] : null
  }

  setMaxDistance(d: number) { this.maxDistance = d }

  private setLaserLength(laser: THREE.Line, length: number) {
    const pos = laser.geometry.attributes.position
    if (pos) {
      pos.setXYZ(1, 0, 0, -length)
      pos.needsUpdate = true
    }
  }

  showLasers(show: boolean) {
    if (this.laserLeft) this.laserLeft.visible = show
    if (this.laserRight) this.laserRight.visible = show
  }

  dispose() {
    if (this.dotLeft) { this.scene.remove(this.dotLeft); this.dotLeft.geometry.dispose() }
    if (this.dotRight) { this.scene.remove(this.dotRight); this.dotRight.geometry.dispose() }
    if (this.laserLeft) this.laserLeft.geometry.dispose()
    if (this.laserRight) this.laserRight.geometry.dispose()
  }
}
