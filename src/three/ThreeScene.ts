import * as THREE from 'three'
import { CameraManager } from './Camera'
import { World, WorldConfig } from './World'
import { InteractionSystem } from './Interaction'
import { useAppStore } from '../app/store'

export interface ThreeSceneOptions {
  canvas: HTMLCanvasElement
  worldConfig?: WorldConfig
  antialias?: boolean
  pixelRatio?: number
}

export class ThreeScene {
  readonly renderer: THREE.WebGLRenderer
  readonly cameraManager: CameraManager
  readonly world: World
  readonly interactionSystem: InteractionSystem
  readonly clock: THREE.Clock

  private lastTime = 0
  private frameCount = 0
  private fpsTimer = 0
  private onUpdateCallbacks: Array<(delta: number, elapsed: number) => void> = []
  private isRunning = false
  private resizeObserver: ResizeObserver

  constructor(options: ThreeSceneOptions) {
    const { canvas, worldConfig = {}, antialias = true, pixelRatio } = options

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(pixelRatio ?? Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    this.cameraManager = new CameraManager(canvas.clientWidth, canvas.clientHeight)
    this.world = new World(worldConfig)
    this.interactionSystem = new InteractionSystem()
    this.clock = new THREE.Clock()

    // Handle canvas resize
    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(canvas)
  }

  private handleResize() {
    const canvas = this.renderer.domElement
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.cameraManager.resize(w, h)
  }

  onUpdate(cb: (delta: number, elapsed: number) => void) {
    this.onUpdateCallbacks.push(cb)
    return () => { this.onUpdateCallbacks = this.onUpdateCallbacks.filter(f => f !== cb) }
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.clock.start()
    this.loop()
  }

  private loop() {
    this.renderer.setAnimationLoop((time: number) => {
      const delta = Math.min((time - this.lastTime) / 1000, 0.05)
      this.lastTime = time

      // FPS tracking
      this.frameCount++
      this.fpsTimer += delta
      if (this.fpsTimer >= 1) {
        const fps = Math.round(this.frameCount / this.fpsTimer)
        const info = this.renderer.info
        useAppStore.getState().updatePerformance({
          fps,
          frameTime: delta * 1000,
          drawCalls: info.render.calls,
          triangles: info.render.triangles,
        })
        this.frameCount = 0
        this.fpsTimer = 0
      }

      const elapsed = this.clock.getElapsedTime()
      this.onUpdateCallbacks.forEach(cb => cb(delta, elapsed))
      this.renderer.render(this.world.scene, this.cameraManager.camera)
    })
  }

  stop() {
    this.isRunning = false
    this.renderer.setAnimationLoop(null)
  }

  setWorldConfig(config: WorldConfig) {
    this.world.apply(config)
  }

  dispose() {
    this.stop()
    this.resizeObserver.disconnect()
    this.world.dispose()
    this.interactionSystem.clear()
    this.renderer.dispose()
    this.onUpdateCallbacks = []
  }
}
