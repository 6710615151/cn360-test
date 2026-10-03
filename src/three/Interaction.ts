import * as THREE from 'three'

export type InteractableType = 'button' | 'lever' | 'switch' | 'grab-object' | 'target' | 'weapon'

export interface InteractableCallbacks {
  onHover?: (obj: Interactable) => void
  onUnhover?: (obj: Interactable) => void
  onSelect?: (obj: Interactable) => void
  onRelease?: (obj: Interactable) => void
  onGrab?: (obj: Interactable) => void
  onDrop?: (obj: Interactable) => void
}

export class Interactable {
  readonly mesh: THREE.Object3D
  readonly type: InteractableType
  readonly callbacks: InteractableCallbacks
  isHovered = false
  isSelected = false
  isGrabbed = false
  userData: Record<string, unknown> = {}

  constructor(mesh: THREE.Object3D, type: InteractableType, callbacks: InteractableCallbacks = {}) {
    this.mesh = mesh
    this.type = type
    this.callbacks = callbacks
    mesh.userData['interactable'] = this
  }

  hover() {
    if (this.isHovered) return
    this.isHovered = true
    this.callbacks.onHover?.(this)
  }

  unhover() {
    if (!this.isHovered) return
    this.isHovered = false
    this.callbacks.onUnhover?.(this)
  }

  select() {
    this.isSelected = true
    this.callbacks.onSelect?.(this)
  }

  release() {
    this.isSelected = false
    this.callbacks.onRelease?.(this)
  }

  grab() {
    this.isGrabbed = true
    this.callbacks.onGrab?.(this)
  }

  drop() {
    this.isGrabbed = false
    this.callbacks.onDrop?.(this)
  }
}

export class InteractionSystem {
  private interactables: Map<string, Interactable> = new Map()

  register(id: string, interactable: Interactable) {
    this.interactables.set(id, interactable)
  }

  unregister(id: string) {
    this.interactables.delete(id)
  }

  getAll(): Interactable[] {
    return Array.from(this.interactables.values())
  }

  getMeshes(): THREE.Object3D[] {
    return this.getAll().map(i => i.mesh)
  }

  findByMesh(mesh: THREE.Object3D): Interactable | undefined {
    for (const i of this.interactables.values()) {
      if (i.mesh === mesh || i.mesh.getObjectById(mesh.id)) return i
    }
    return undefined
  }

  clear() {
    this.interactables.clear()
  }
}
