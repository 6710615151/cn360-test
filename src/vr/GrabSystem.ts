import * as THREE from 'three'
import { ControllerManager } from './ControllerManager'
import { InteractionSystem, Interactable } from '../three/Interaction'

// ─── Grab System — attaches grabbed objects to controller transform ───────────

interface GrabbedObject {
  interactable: Interactable
  hand: 'left' | 'right'
  // Offset from controller origin when grabbed
  localOffset: THREE.Vector3
  localRotOffset: THREE.Quaternion
}

export class GrabSystem {
  private controllers: ControllerManager
  private interaction: InteractionSystem
  private grabbed: Map<'left' | 'right', GrabbedObject> = new Map()

  private tmpMatrix = new THREE.Matrix4()
  private tmpInverse = new THREE.Matrix4()
  private tmpVec = new THREE.Vector3()
  private tmpQuat = new THREE.Quaternion()

  constructor(controllers: ControllerManager, interaction: InteractionSystem) {
    this.controllers = controllers
    this.interaction = interaction
  }

  /** Call every frame — handles grab attach/detach and object following */
  update() {
    const hands: Array<'left' | 'right'> = ['left', 'right']

    for (const hand of hands) {
      const state = this.controllers.getState(hand)
      const ctrl = this.controllers.getThreeController(hand)
      const gripSpace = this.controllers.getGrip(hand)

      if (!state.connected) {
        this.release(hand)
        continue
      }

      const isGripping = state.gripPressed

      if (isGripping && !this.grabbed.has(hand)) {
        // Try to grab nearby interactable
        const grabTarget = this.findNearbyGrabbable(
          state.position,
          hand
        )
        if (grabTarget) {
          this.grab(hand, grabTarget, state.position, state.quaternion)
        }
      }

      if (!isGripping && this.grabbed.has(hand)) {
        this.release(hand)
      }

      // Update grabbed object position
      const grabbed = this.grabbed.get(hand)
      if (grabbed && ctrl) {
        const ctrlWorldPos = new THREE.Vector3()
        const ctrlWorldQuat = new THREE.Quaternion()
        ctrl.getWorldPosition(ctrlWorldPos)
        ctrl.getWorldQuaternion(ctrlWorldQuat)

        // Apply local offset rotated by controller orientation
        this.tmpVec.copy(grabbed.localOffset).applyQuaternion(ctrlWorldQuat)
        const newPos = ctrlWorldPos.clone().add(this.tmpVec)
        const newQuat = ctrlWorldQuat.clone().multiply(grabbed.localRotOffset)

        const obj = grabbed.interactable.mesh
        obj.position.copy(newPos)
        obj.quaternion.copy(newQuat)
      }
    }
  }

  private findNearbyGrabbable(
    controllerPos: THREE.Vector3,
    hand: 'left' | 'right'
  ): Interactable | null {
    const GRAB_RADIUS = 0.25
    let closest: Interactable | null = null
    let closestDist = GRAB_RADIUS

    for (const interactable of this.interaction.getAll()) {
      if (interactable.type !== 'grab-object' && interactable.type !== 'weapon') continue
      if (interactable.isGrabbed) continue

      const objPos = new THREE.Vector3()
      interactable.mesh.getWorldPosition(objPos)
      const dist = controllerPos.distanceTo(objPos)
      if (dist < closestDist) {
        closestDist = dist
        closest = interactable
      }
    }
    return closest
  }

  private grab(
    hand: 'left' | 'right',
    interactable: Interactable,
    controllerPos: THREE.Vector3,
    controllerQuat: THREE.Quaternion
  ) {
    const objPos = new THREE.Vector3()
    interactable.mesh.getWorldPosition(objPos)

    // Compute local offset = obj world pos - ctrl world pos, inverse-rotated
    const invQuat = controllerQuat.clone().invert()
    const localOffset = objPos.clone().sub(controllerPos).applyQuaternion(invQuat)

    const objQuat = new THREE.Quaternion()
    interactable.mesh.getWorldQuaternion(objQuat)
    const localRotOffset = invQuat.clone().multiply(objQuat)

    this.grabbed.set(hand, {
      interactable,
      hand,
      localOffset,
      localRotOffset,
    })

    interactable.grab()
  }

  release(hand: 'left' | 'right') {
    const grabbed = this.grabbed.get(hand)
    if (grabbed) {
      grabbed.interactable.drop()
      this.grabbed.delete(hand)
    }
  }

  isGrabbing(hand: 'left' | 'right'): boolean {
    return this.grabbed.has(hand)
  }

  getGrabbed(hand: 'left' | 'right'): Interactable | null {
    return this.grabbed.get(hand)?.interactable ?? null
  }

  releaseAll() {
    for (const hand of ['left', 'right'] as const) {
      this.release(hand)
    }
  }
}
