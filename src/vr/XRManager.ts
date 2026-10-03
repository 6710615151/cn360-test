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
        optionalFeatures: [
          'bounded-floor',
          'hand-tracking',
          'layers',
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

    // Three.js WebXR integration
    this.renderer.xr.enabled = true
    await this.renderer.xr.setSession(session as unknown as THREE.XRSession)

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

    useAppStore.getState().updateXR({
      isSessionActive: true,
      sessionType: 'immersive-vr',
    })

    this.onSessionStart?.()
  }

  private handleInputSourcesChange = (event: XRInputSourceChangeEvent) => {
    // Build current list
    const sources: XRInputSource[] = []
    if (this.session) {
      for (const source of this.session.inputSources) {
        sources.push(source)
      }
    }
    this.inputSources = sources

    let hasLeft = false, hasRight = false
    for (const s of sources) {
      if (s.handedness === 'left') hasLeft = true
      if (s.handedness === 'right') hasRight = true
    }
    useAppStore.getState().updateXR({ hasLeft, hasRight })
    this.onInputSourcesChange?.(sources)
  }

  private handleSessionEnd = () => {
    this.session = null
    this.referenceSpace = null
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
  getInputSources() { return this.inputSources }
  isActive() { return this.session !== null }

  // Called each frame — read pose from XRFrame via Three.js xr manager
  getViewerPose(frame?: XRFrame): XRViewerPose | null {
    if (!frame || !this.referenceSpace) return null
    try {
      return frame.getViewerPose(this.referenceSpace)
    } catch {
      return null
    }
  }

  getPose(space: XRSpace, frame?: XRFrame): XRPose | null {
    if (!frame || !this.referenceSpace) return null
    try {
      return frame.getPose(space, this.referenceSpace)
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
