import * as THREE from 'three'
import { XRManager } from './XRManager'

// Pico 4 button indices (standard XR gamepad layout)
const BUTTON = {
  TRIGGER: 0,    // index trigger
  GRIP: 1,       // grip / squeeze
  TOUCHPAD: 2,   // touchpad (if present)
  THUMBSTICK: 3, // thumbstick click
  PRIMARY: 4,    // A (right) / X (left)
  SECONDARY: 5,  // B (right) / Y (left)
} as const

const AXIS = {
  THUMBSTICK_X: 2, // standard mapping: axes[2] = thumbstick X
  THUMBSTICK_Y: 3, // axes[3] = thumbstick Y
} as const

export interface ControllerState {
  connected: boolean
  handedness: 'left' | 'right' | 'none'
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  rotation: THREE.Euler
  // Buttons
  trigger: number        // 0–1 analog
  grip: number           // 0–1 analog
  triggerPressed: boolean
  gripPressed: boolean
  primaryPressed: boolean   // A or X
  secondaryPressed: boolean // B or Y
  thumbstickPressed: boolean
  thumbstickX: number    // -1 to 1
  thumbstickY: number    // -1 to 1
  // Raw gamepad ref
  gamepad: Gamepad | null
}

const makeDefaultState = (handedness: 'left' | 'right'): ControllerState => ({
  connected: false,
  handedness,
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  rotation: new THREE.Euler(),
  trigger: 0,
  grip: 0,
  triggerPressed: false,
  gripPressed: false,
  primaryPressed: false,
  secondaryPressed: false,
  thumbstickPressed: false,
  thumbstickX: 0,
  thumbstickY: 0,
  gamepad: null,
})

export class ControllerManager {
  private xrManager: XRManager
  readonly left: ControllerState = makeDefaultState('left')
  readonly right: ControllerState = makeDefaultState('right')

  // Three.js controller groups (used for rendering controller meshes)
  private threeControllerLeft: THREE.XRTargetRaySpace | null = null
  private threeControllerRight: THREE.XRTargetRaySpace | null = null
  private gripLeft: THREE.XRGripSpace | null = null
  private gripRight: THREE.XRGripSpace | null = null

  private scene: THREE.Scene | null = null
  private leftMesh: THREE.Group | null = null
  private rightMesh: THREE.Group | null = null

  constructor(xrManager: XRManager) {
    this.xrManager = xrManager
  }

  setupWithRenderer(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.scene = scene

    // Three.js provides XRTargetRaySpace via renderer.xr.getController(index)
    this.threeControllerLeft = renderer.xr.getController(0)
    this.threeControllerRight = renderer.xr.getController(1)
    this.gripLeft = renderer.xr.getControllerGrip(0)
    this.gripRight = renderer.xr.getControllerGrip(1)

    // Add to scene
    scene.add(this.threeControllerLeft)
    scene.add(this.threeControllerRight)
    scene.add(this.gripLeft)
    scene.add(this.gripRight)

    // Build simple controller meshes
    this.leftMesh = this.buildControllerMesh(0x00f5ff)
    this.rightMesh = this.buildControllerMesh(0xff006e)
    this.threeControllerLeft.add(this.leftMesh)
    this.threeControllerRight.add(this.rightMesh)
  }

  private buildControllerMesh(color: number): THREE.Group {
    const group = new THREE.Group()
    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.12, 8)
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.6 })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.rotation.x = Math.PI / 2
    body.castShadow = true
    group.add(body)
    // Tip indicator (ray origin)
    const tipGeo = new THREE.SphereGeometry(0.008, 6, 6)
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const tip = new THREE.Mesh(tipGeo, tipMat)
    tip.position.z = -0.07
    group.add(tip)
    return group
  }

  /** Call every XRFrame to read latest input */
  update(frame?: XRFrame) {
    if (!this.xrManager.isActive() || !frame) {
      this.left.connected = false
      this.right.connected = false
      return
    }

    const sources = this.xrManager.getInputSources()
    let leftFound = false, rightFound = false

    for (const source of sources) {
      if (source.handedness === 'left') {
        this.readSource(source, this.left, frame)
        leftFound = true
      } else if (source.handedness === 'right') {
        this.readSource(source, this.right, frame)
        rightFound = true
      }
    }

    if (!leftFound) this.left.connected = false
    if (!rightFound) this.right.connected = false
  }

  private readSource(source: XRInputSource, state: ControllerState, frame: XRFrame) {
    state.connected = true
    state.gamepad = source.gamepad ?? null

    // Pose
    const refSpace = this.xrManager.getReferenceSpace()
    if (source.gripSpace && refSpace) {
      try {
        const pose = frame.getPose(source.gripSpace, refSpace)
        if (pose) {
          const t = pose.transform.position
          const r = pose.transform.orientation
          state.position.set(t.x, t.y, t.z)
          state.quaternion.set(r.x, r.y, r.z, r.w)
          state.rotation.setFromQuaternion(state.quaternion)
        }
      } catch {/* ignore */}
    }

    // Gamepad input
    const gp = source.gamepad
    if (!gp) return

    const btn = (i: number) => gp.buttons[i]
    const axis = (i: number) => gp.axes[i] ?? 0

    state.trigger = btn(BUTTON.TRIGGER)?.value ?? 0
    state.grip = btn(BUTTON.GRIP)?.value ?? 0
    state.triggerPressed = btn(BUTTON.TRIGGER)?.pressed ?? false
    state.gripPressed = btn(BUTTON.GRIP)?.pressed ?? false
    state.primaryPressed = btn(BUTTON.PRIMARY)?.pressed ?? false
    state.secondaryPressed = btn(BUTTON.SECONDARY)?.pressed ?? false
    state.thumbstickPressed = btn(BUTTON.THUMBSTICK)?.pressed ?? false
    state.thumbstickX = axis(AXIS.THUMBSTICK_X)
    state.thumbstickY = axis(AXIS.THUMBSTICK_Y)
  }

  getState(hand: 'left' | 'right'): ControllerState {
    return hand === 'left' ? this.left : this.right
  }

  getThreeController(hand: 'left' | 'right') {
    return hand === 'left' ? this.threeControllerLeft : this.threeControllerRight
  }

  getGrip(hand: 'left' | 'right') {
    return hand === 'left' ? this.gripLeft : this.gripRight
  }

  dispose() {
    if (this.scene) {
      if (this.threeControllerLeft) this.scene.remove(this.threeControllerLeft)
      if (this.threeControllerRight) this.scene.remove(this.threeControllerRight)
      if (this.gripLeft) this.scene.remove(this.gripLeft)
      if (this.gripRight) this.scene.remove(this.gripRight)
    }
  }
}
