import * as THREE from 'three'
import { useAppStore } from '../app/store'

export type XRSessionEventType = 'sessionstart' | 'sessionend' | 'inputsourceadd' | 'inputsourceremove'

export interface XRManagerOptions {
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  onSessionStart?: () => void
  onSessionEnd?: () => void
  onInputSourcesChange?: (sources: XRInputSource[]) => void
}

export class XRManager {
  private renderer: THREE.WebGLRenderer
  private camera: THREE.PerspectiveCamera
  private session: XRSession | null = null
  private referenceSpace: XRReferenceSpace | null = null
  private onSessionStart?: () => void
  private onSessionEnd?: () => void
  private onInputSourcesChange?: (sources: XRInputSource[]) => void
  private inputSources: XRInputSource[] = []

  // Player origin (locomotion). In WebXR the headset owns the camera pose, so we
  // move the player by offsetting the reference space instead of the camera.
  private baseReferenceSpace: XRReferenceSpace | null = null
  private originPosition = new THREE.Vector3()
  private originYaw = 0

  constructor(opts: XRManagerOptions) {
    this.renderer = opts.renderer
    this.camera = opts.camera
    this.onSessionStart = opts.onSessionStart
    this.onSessionEnd = opts.onSessionEnd
    this.onInputSourcesChange = opts.onInputSourcesChange
    this.checkSupport()
  }

  private async checkSupport() {
    if (!navigator.xr) {
      useAppStore.getState().updateXR({
        isSupported: false,
        errorMessage: 'WebXR not available in this browser.',
      })
      return
    }
    try {
      const supported = await navigator.xr.isSessionSupported('immersive-vr')
      useAppStore.getState().updateXR({
        isSupported: supported,
        errorMessage: supported ? null : 'Immersive VR not supported on this device.',
      })
    } catch (e) {
      useAppStore.getState().updateXR({
        isSupported: false,
        errorMessage: String(e),
      })
    }
  }

  async requestSession(): Promise<boolean> {
    if (!navigator.xr) return false
    try {
      // Request immersive-vr with optional features for Pico 4
      const session = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
        // No 'layers': when granted, three.js renders through XRProjectionLayer +
        // a multisampled render target, which shows a blank view on Pico Browser.
        // The plain XRWebGLLayer path works on every headset.
        optionalFeatures: [
          'bounded-floor',
          'hand-tracking',
        ],
      })

      await this.setupSession(session)
      return true
    } catch (e) {
      console.error('[XRManager] requestSession failed:', e)
      useAppStore.getState().updateXR({
        errorMessage: `Failed to start VR session: ${String(e)}`,
      })
      return false
    }
  }

  private async setupSession(session: XRSession) {
    this.session = session

    // Attach listeners BEFORE awaiting anything: Pico fires 'inputsourceschange'
    // for already-connected controllers during setSession(), and we'd miss it.
    session.addEventListener('inputsourceschange', this.handleInputSourcesChange)
    session.addEventListener('end', this.handleSessionEnd)

    // Three.js WebXR integration
    this.renderer.xr.enabled = true
    await this.renderer.xr.setSession(session)
    this.baseReferenceSpace = this.renderer.xr.getReferenceSpace()
    this.originPosition.set(0, 0, 0)
    this.originYaw = 0

    // Attempt local-floor reference space, fall back to local
    try {
      this.referenceSpace = await session.requestReferenceSpace('local-floor')
      useAppStore.getState().updateXR({ referenceSpaceType: 'local-floor' })
    } catch {
      try {
        this.referenceSpace = await session.requestReferenceSpace('local')
        useAppStore.getState().updateXR({ referenceSpaceType: 'local' })
      } catch (e2) {
        console.error('[XRManager] Could not get reference space:', e2)
      }
    }

    // Listen for input source changes
    session.addEventListener('inputsourceschange', this.handleInputSourcesChange)
    session.addEventListener('end', this.handleSessionEnd)
    this.syncInputSources()

    useAppStore.getState().updateXR({
      isSessionActive: true,
      sessionType: 'immersive-vr',
    })

    this.onSessionStart?.()
  }

  private handleInputSourcesChange = () => {
    this.syncInputSources()
  }

  private syncInputSources() {
    this.inputSources = this.session ? Array.from(this.session.inputSources) : []

    let hasLeft = false, hasRight = false
    for (const s of this.inputSources) {
      if (s.handedness === 'left') hasLeft = true
      if (s.handedness === 'right') hasRight = true
    }
    useAppStore.getState().updateXR({ hasLeft, hasRight })
    this.onInputSourcesChange?.(this.inputSources)
  }

  private handleSessionEnd = () => {
    this.session = null
    this.referenceSpace = null
    this.baseReferenceSpace = null
    this.inputSources = []
    this.renderer.xr.enabled = false
    useAppStore.getState().updateXR({
      isSessionActive: false,
      sessionType: 'none',
      hasLeft: false,
      hasRight: false,
      referenceSpaceType: '',
    })
    this.onSessionEnd?.()
  }

  async endSession() {
    if (this.session) {
      await this.session.end()
    }
  }

  getSession() { return this.session }
  getReferenceSpace() { return this.referenceSpace }
  getInputSources() {
    return this.session ? Array.from(this.session.inputSources) : this.inputSources
  }
  isActive() { return this.session !== null }

  // ─── Locomotion ─────────────────────────────────────────────────────────────

  /** Move the player origin by a world-space delta */
  moveOrigin(delta: THREE.Vector3) {
    this.originPosition.add(delta)
    this.applyOrigin()
  }

  /** Teleport so the player's head (x/z) lands on `point`, feet at point.y */
  teleportTo(point: THREE.Vector3, headWorld: THREE.Vector3) {
    this.originPosition.x += point.x - headWorld.x
    this.originPosition.z += point.z - headWorld.z
    this.originPosition.y = point.y
    this.applyOrigin()
  }

  /** Rotate the player around the head position (snap turn) */
  rotateOrigin(angle: number, headWorld: THREE.Vector3) {
    const offset = new THREE.Vector3().subVectors(this.originPosition, headWorld)
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
    this.originPosition.copy(headWorld).add(offset)
    this.originYaw += angle
    this.applyOrigin()
  }

  private applyOrigin() {
    if (!this.baseReferenceSpace) return
    // Poses in the offset space = inverse(T) * base pose, so T is the inverse of the origin transform
    const origin = new THREE.Matrix4().compose(
      this.originPosition,
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.originYaw),
      new THREE.Vector3(1, 1, 1),
    )
    const inv = origin.invert()
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3()
    inv.decompose(p, q, sc)
    const transform = new XRRigidTransform({ x: p.x, y: p.y, z: p.z }, { x: q.x, y: q.y, z: q.z, w: q.w })
    this.renderer.xr.setReferenceSpace(this.baseReferenceSpace.getOffsetReferenceSpace(transform))
  }

  // Called each frame — read pose from XRFrame via Three.js xr manager
  getViewerPose(frame?: XRFrame): XRViewerPose | null {
    const space = this.getReferenceSpace()
    if (!frame || !space) return null
    try {
      return frame.getViewerPose(space) ?? null
    } catch {
      return null
    }
  }

  getPose(space: XRSpace, frame?: XRFrame): XRPose | null {
    const refSpace = this.getReferenceSpace()
    if (!frame || !refSpace) return null
    try {
      return frame.getPose(space, refSpace) ?? null
    } catch {
      return null
    }
  }

  dispose() {
    if (this.session) {
      this.session.removeEventListener('inputsourceschange', this.handleInputSourcesChange)
      this.session.removeEventListener('end', this.handleSessionEnd)
    }
  }
}
