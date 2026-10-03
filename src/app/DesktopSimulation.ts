import * as THREE from 'three'
import { InputManager } from '../vr/InputManager'
import { HeadsetManager } from '../vr/HeadsetManager'
import { useAppStore } from './store'

// ─── Desktop simulation: WASD + mouse look + pointer lock ─────────────────────
// This is clearly labelled DESKTOP SIMULATION — not real WebXR.
// When real Pico 4 WebXR session starts, this is bypassed automatically.

export class DesktopSimulation {
  private camera: THREE.PerspectiveCamera
  private input: InputManager
  private headset: HeadsetManager
  private canvas: HTMLCanvasElement

  private moveSpeed = 4.0
  private lookSensitivity = 0.002

  private pointerLocked = false
  private isEnabled = false

  // Bound event handlers
  private _onKeyDown: (e: KeyboardEvent) => void
  private _onKeyUp: (e: KeyboardEvent) => void
  private _onMouseDown: (e: MouseEvent) => void
  private _onMouseUp: (e: MouseEvent) => void
  private _onMouseMove: (e: MouseEvent) => void
  private _onPointerLockChange: () => void
  private _onContextMenu: (e: Event) => void

  constructor(
    camera: THREE.PerspectiveCamera,
    input: InputManager,
    headset: HeadsetManager,
    canvas: HTMLCanvasElement
  ) {
    this.camera = camera
    this.input = input
    this.headset = headset
    this.canvas = canvas

    this._onKeyDown = (e) => this.handleKeyDown(e)
    this._onKeyUp = (e) => this.handleKeyUp(e)
    this._onMouseDown = (e) => this.handleMouseDown(e)
    this._onMouseUp = (e) => this.handleMouseUp(e)
    this._onMouseMove = (e) => this.handleMouseMove(e)
    this._onPointerLockChange = () => this.handlePointerLockChange()
    this._onContextMenu = (e) => e.preventDefault()
  }

  enable() {
    if (this.isEnabled) return
    this.isEnabled = true

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    this.canvas.addEventListener('mousedown', this._onMouseDown)
    this.canvas.addEventListener('mouseup', this._onMouseUp)
    this.canvas.addEventListener('mousemove', this._onMouseMove)
    document.addEventListener('pointerlockchange', this._onPointerLockChange)
    this.canvas.addEventListener('contextmenu', this._onContextMenu)

    // Click canvas to lock pointer
    this.canvas.addEventListener('click', this._requestPointerLock, { once: false })
  }

  disable() {
    if (!this.isEnabled) return
    this.isEnabled = false

    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    this.canvas.removeEventListener('mousedown', this._onMouseDown)
    this.canvas.removeEventListener('mouseup', this._onMouseUp)
    this.canvas.removeEventListener('mousemove', this._onMouseMove)
    document.removeEventListener('pointerlockchange', this._onPointerLockChange)
    this.canvas.removeEventListener('contextmenu', this._onContextMenu)
    this.canvas.removeEventListener('click', this._requestPointerLock)

    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock()
    }
  }

  private _requestPointerLock = () => {
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock()
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    this.input.onKeyDown(e)

    // Number keys for quick game select
    if (e.code >= 'Digit1' && e.code <= 'Digit5') {
      const games = ['target-shooter', 'block-breaker', 'space-arena', 'sword-arena', 'obstacle-course']
      const idx = parseInt(e.code.replace('Digit', '')) - 1
      if (games[idx]) {
        useAppStore.getState().navigateTo('game-selector')
      }
    }

    // Escape = pause / back to menu
    if (e.code === 'Escape') {
      const view = useAppStore.getState().view
      if (view === 'playing') {
        const isPaused = useAppStore.getState().isPaused
        useAppStore.getState().setPaused(!isPaused)
      } else if (view !== 'main-menu') {
        useAppStore.getState().navigateTo('main-menu')
      }
      // Exit pointer lock
      document.exitPointerLock()
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.input.onKeyUp(e)
  }

  private handleMouseDown(e: MouseEvent) {
    this.input.onMouseDown(e)
  }

  private handleMouseUp(e: MouseEvent) {
    this.input.onMouseUp(e)
  }

  private handleMouseMove(e: MouseEvent) {
    this.input.onMouseMove(e)

    if (this.pointerLocked) {
      const dx = e.movementX * this.lookSensitivity
      const dy = e.movementY * this.lookSensitivity
      this.headset.applyDesktopRotation(-dx, -dy)
    }
  }

  private handlePointerLockChange() {
    this.pointerLocked = document.pointerLockElement === this.canvas
  }

  /** Call every frame to apply WASD movement */
  update(delta: number) {
    if (!this.isEnabled) return

    // Only move if pointer is locked (player is focused on canvas)
    if (!this.pointerLocked) return

    const moveX = this.input.getAxis('leftX')
    const moveZ = this.input.getAxis('leftY')

    if (Math.abs(moveX) < 0.01 && Math.abs(moveZ) < 0.01) return

    const direction = new THREE.Vector3()
    const forward = new THREE.Vector3()
    const right = new THREE.Vector3()

    this.camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    right.crossVectors(forward, new THREE.Vector3(0, 1, 0))

    direction.addScaledVector(right, moveX)
    direction.addScaledVector(forward, -moveZ)

    if (direction.length() > 0) {
      direction.normalize().multiplyScalar(this.moveSpeed * delta)
      this.camera.position.add(direction)
    }
  }

  isPointerLocked() { return this.pointerLocked }

  dispose() {
    this.disable()
  }
}
