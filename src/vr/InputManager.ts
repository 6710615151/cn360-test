import * as THREE from 'three'
import { ControllerManager, ControllerState } from './ControllerManager'
import { HeadsetManager } from './HeadsetManager'

// ─── Abstracted Input API used by all games ───────────────────────────────────
// Games never read WebXR Gamepad API directly — they use InputManager.

export type ButtonName =
  | 'trigger' | 'grip'
  | 'primary' | 'secondary'
  | 'thumbstick'

export type AxisName =
  | 'leftX' | 'leftY'
  | 'rightX' | 'rightY'

export type HandName = 'left' | 'right'

export interface HeadsetPoseInfo {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  direction: THREE.Vector3
}

export class InputManager {
  private controllers: ControllerManager
  private headset: HeadsetManager

  // Desktop simulation state
  private desktopKeys: Set<string> = new Set()
  private desktopMouseDelta = new THREE.Vector2()
  private desktopMouseButtons = { left: false, right: false, middle: false }
  private isDesktop = false

  // Prev-frame button states for edge detection
  private prevLeft: Record<ButtonName, boolean> = this.emptyButtons()
  private prevRight: Record<ButtonName, boolean> = this.emptyButtons()

  constructor(controllers: ControllerManager, headset: HeadsetManager) {
    this.controllers = controllers
    this.headset = headset
  }

  setDesktopMode(enabled: boolean) {
    this.isDesktop = enabled
  }

  // ─── Button queries ─────────────────────────────────────────────────────────

  getButton(name: ButtonName, hand: HandName = 'right'): boolean {
    if (this.isDesktop) return this.getDesktopButton(name)
    const s = this.controllers.getState(hand)
    return this.readButton(s, name)
  }

  getButtonDown(name: ButtonName, hand: HandName = 'right'): boolean {
    const cur = this.getButton(name, hand)
    const prev = hand === 'left' ? this.prevLeft[name] : this.prevRight[name]
    return cur && !prev
  }

  getButtonUp(name: ButtonName, hand: HandName = 'right'): boolean {
    const cur = this.getButton(name, hand)
    const prev = hand === 'left' ? this.prevLeft[name] : this.prevRight[name]
    return !cur && prev
  }

  getButtonAnalog(name: ButtonName, hand: HandName = 'right'): number {
    if (this.isDesktop) return this.getButton(name, hand) ? 1 : 0
    const s = this.controllers.getState(hand)
    if (name === 'trigger') return s.trigger
    if (name === 'grip') return s.grip
    return this.readButton(s, name) ? 1 : 0
  }

  private readButton(s: ControllerState, name: ButtonName): boolean {
    switch (name) {
      case 'trigger': return s.triggerPressed
      case 'grip': return s.gripPressed
      case 'primary': return s.primaryPressed
      case 'secondary': return s.secondaryPressed
      case 'thumbstick': return s.thumbstickPressed
    }
  }

  // ─── Axis queries ────────────────────────────────────────────────────────────

  getAxis(name: AxisName): number {
    if (this.isDesktop) return this.getDesktopAxis(name)
    switch (name) {
      case 'leftX': return this.controllers.left.thumbstickX
      case 'leftY': return this.controllers.left.thumbstickY
      case 'rightX': return this.controllers.right.thumbstickX
      case 'rightY': return this.controllers.right.thumbstickY
    }
  }

  // ─── Controller / headset ────────────────────────────────────────────────────

  getController(hand: HandName): ControllerState {
    return this.controllers.getState(hand)
  }

  getHeadsetPose(): HeadsetPoseInfo {
    return {
      position: this.headset.getPosition(),
      quaternion: new THREE.Quaternion().setFromEuler(this.headset.getRotation()),
      direction: this.headset.getDirection(),
    }
  }

  isVRActive(): boolean {
    return !this.isDesktop && (this.controllers.left.connected || this.controllers.right.connected)
  }

  // ─── Desktop simulation ──────────────────────────────────────────────────────

  private getDesktopButton(name: ButtonName): boolean {
    switch (name) {
      case 'trigger': return this.desktopMouseButtons.left
      case 'grip': return this.desktopMouseButtons.right
      case 'primary': return this.desktopKeys.has('KeyF')
      case 'secondary': return this.desktopKeys.has('KeyG')
      case 'thumbstick': return this.desktopKeys.has('Space')
    }
  }

  private getDesktopAxis(name: AxisName): number {
    switch (name) {
      case 'leftX':
        return (this.desktopKeys.has('KeyD') ? 1 : 0) - (this.desktopKeys.has('KeyA') ? 1 : 0)
      case 'leftY':
        return (this.desktopKeys.has('KeyS') ? 1 : 0) - (this.desktopKeys.has('KeyW') ? 1 : 0)
      case 'rightX':
        return (this.desktopKeys.has('ArrowRight') ? 1 : 0) - (this.desktopKeys.has('ArrowLeft') ? 1 : 0)
      case 'rightY':
        return (this.desktopKeys.has('ArrowDown') ? 1 : 0) - (this.desktopKeys.has('ArrowUp') ? 1 : 0)
    }
  }

  /** Call at end of each frame to track edge detection */
  flushFrame() {
    const storeButtonState = (s: ControllerState, prev: Record<ButtonName, boolean>) => {
      prev.trigger = s.triggerPressed
      prev.grip = s.gripPressed
      prev.primary = s.primaryPressed
      prev.secondary = s.secondaryPressed
      prev.thumbstick = s.thumbstickPressed
    }
    if (this.isDesktop) {
      const l = this.desktopKeys
      this.prevLeft.trigger = l.has('MouseLeft')
      this.prevLeft.grip = l.has('MouseRight')
      this.prevRight.trigger = this.desktopMouseButtons.left
      this.prevRight.grip = this.desktopMouseButtons.right
    } else {
      storeButtonState(this.controllers.left, this.prevLeft)
      storeButtonState(this.controllers.right, this.prevRight)
    }
    this.desktopMouseDelta.set(0, 0)
  }

  // ─── Event handlers (register externally) ───────────────────────────────────

  onKeyDown(e: KeyboardEvent) { this.desktopKeys.add(e.code) }
  onKeyUp(e: KeyboardEvent) { this.desktopKeys.delete(e.code) }
  onMouseDown(e: MouseEvent) {
    if (e.button === 0) this.desktopMouseButtons.left = true
    if (e.button === 2) this.desktopMouseButtons.right = true
  }
  onMouseUp(e: MouseEvent) {
    if (e.button === 0) this.desktopMouseButtons.left = false
    if (e.button === 2) this.desktopMouseButtons.right = false
  }
  onMouseMove(e: MouseEvent) {
    this.desktopMouseDelta.set(e.movementX, e.movementY)
  }
  getMouseDelta() { return this.desktopMouseDelta }
  isKeyDown(code: string) { return this.desktopKeys.has(code) }

  private emptyButtons(): Record<ButtonName, boolean> {
    return { trigger: false, grip: false, primary: false, secondary: false, thumbstick: false }
  }
}
