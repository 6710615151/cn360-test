import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// ─── Enums ────────────────────────────────────────────────────────────────────

export type AppView =
  | 'main-menu'
  | 'game-selector'
  | 'playing'
  | 'paused'
  | 'controller-test'
  | 'xr-diagnostics'
  | 'settings'

export type GameId =
  | 'target-shooter'
  | 'block-breaker'
  | 'space-arena'
  | 'sword-arena'
  | 'obstacle-course'

export type InputMode = 'vr' | 'desktop'

// ─── Controller State (NOT stored in React state — updated every frame in runtime) ─

export interface ControllerPose {
  position: [number, number, number]
  rotation: [number, number, number]
  connected: boolean
  handedness: 'left' | 'right' | 'none'
  trigger: number      // 0–1
  grip: number         // 0–1
  thumbstickX: number  // -1 to 1
  thumbstickY: number  // -1 to 1
  buttonA: boolean
  buttonB: boolean
  buttonX: boolean
  buttonY: boolean
  thumbstickPressed: boolean
}

export interface HeadsetPose {
  position: [number, number, number]
  rotation: [number, number, number]
  connected: boolean
}

export interface GameScore {
  score: number
  highScore: number
  level: number
  lives: number
  timer: number
  combo: number
}

export interface PerformanceStats {
  fps: number
  frameTime: number
  drawCalls: number
  triangles: number
  memoryMB: number
}

export interface Settings {
  masterVolume: number
  sfxVolume: number
  musicVolume: number
  locomotionMode: 'teleport' | 'thumbstick' | 'none'
  snapTurnAngle: number
  showDebugPanel: boolean
  showPerformancePanel: boolean
  shadowsEnabled: boolean
  particlesEnabled: boolean
  fxaaEnabled: boolean
}

export interface XRState {
  isSupported: boolean
  isSessionActive: boolean
  sessionType: 'immersive-vr' | 'none'
  referenceSpaceType: string
  hasLeft: boolean
  hasRight: boolean
  hasHands: boolean
  errorMessage: string | null
}

// ─── Store Shape ──────────────────────────────────────────────────────────────

interface AppState {
  // Navigation
  view: AppView
  previousView: AppView | null
  currentGameId: GameId | null
  inputMode: InputMode

  // XR
  xr: XRState

  // Game
  gameScore: GameScore
  isPaused: boolean

  // Performance
  performance: PerformanceStats

  // Settings
  settings: Settings

  // Debug
  debugMode: boolean

  // ─── Actions ────────────────────────────────────────────────────────────────

  setView: (view: AppView) => void
  navigateTo: (view: AppView) => void
  goBack: () => void

  setCurrentGame: (id: GameId | null) => void
  setInputMode: (mode: InputMode) => void

  updateXR: (partial: Partial<XRState>) => void

  updateScore: (partial: Partial<GameScore>) => void
  resetScore: () => void
  addScore: (points: number) => void
  incrementCombo: () => void
  resetCombo: () => void

  setPaused: (paused: boolean) => void

  updatePerformance: (partial: Partial<PerformanceStats>) => void

  updateSettings: (partial: Partial<Settings>) => void

  setDebugMode: (enabled: boolean) => void
}

const defaultScore: GameScore = {
  score: 0,
  highScore: 0,
  level: 1,
  lives: 3,
  timer: 0,
  combo: 0,
}

const defaultXR: XRState = {
  isSupported: false,
  isSessionActive: false,
  sessionType: 'none',
  referenceSpaceType: '',
  hasLeft: false,
  hasRight: false,
  hasHands: false,
  errorMessage: null,
}

const defaultPerformance: PerformanceStats = {
  fps: 0,
  frameTime: 0,
  drawCalls: 0,
  triangles: 0,
  memoryMB: 0,
}

const defaultSettings: Settings = {
  masterVolume: 0.8,
  sfxVolume: 1.0,
  musicVolume: 0.5,
  locomotionMode: 'thumbstick',
  snapTurnAngle: 45,
  showDebugPanel: false,
  showPerformancePanel: true,
  shadowsEnabled: true,
  particlesEnabled: true,
  fxaaEnabled: false,
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    view: 'main-menu',
    previousView: null,
    currentGameId: null,
    inputMode: 'desktop',
    xr: defaultXR,
    gameScore: defaultScore,
    isPaused: false,
    performance: defaultPerformance,
    settings: defaultSettings,
    debugMode: false,

    setView: (view) => set({ view }),

    navigateTo: (view) => {
      const current = get().view
      set({ view, previousView: current })
    },

    goBack: () => {
      const prev = get().previousView
      if (prev) set({ view: prev, previousView: null })
      else set({ view: 'main-menu', previousView: null })
    },

    setCurrentGame: (id) => set({ currentGameId: id }),

    setInputMode: (mode) => set({ inputMode: mode }),

    updateXR: (partial) =>
      set((s) => ({ xr: { ...s.xr, ...partial } })),

    updateScore: (partial) =>
      set((s) => ({ gameScore: { ...s.gameScore, ...partial } })),

    resetScore: () =>
      set((s) => ({
        gameScore: {
          ...defaultScore,
          highScore: s.gameScore.highScore,
        },
      })),

    addScore: (points) =>
      set((s) => {
        const newScore = s.gameScore.score + points * Math.max(1, s.gameScore.combo)
        return {
          gameScore: {
            ...s.gameScore,
            score: newScore,
            highScore: Math.max(newScore, s.gameScore.highScore),
          },
        }
      }),

    incrementCombo: () =>
      set((s) => ({
        gameScore: { ...s.gameScore, combo: s.gameScore.combo + 1 },
      })),

    resetCombo: () =>
      set((s) => ({ gameScore: { ...s.gameScore, combo: 0 } })),

    setPaused: (paused) => set({ isPaused: paused }),

    updatePerformance: (partial) =>
      set((s) => ({ performance: { ...s.performance, ...partial } })),

    updateSettings: (partial) =>
      set((s) => ({ settings: { ...s.settings, ...partial } })),

    setDebugMode: (enabled) => set({ debugMode: enabled }),
  }))
)

// ─── Selectors (for performance — avoid re-renders) ───────────────────────────

export const selectView = (s: AppState) => s.view
export const selectCurrentGameId = (s: AppState) => s.currentGameId
export const selectXR = (s: AppState) => s.xr
export const selectInputMode = (s: AppState) => s.inputMode
export const selectGameScore = (s: AppState) => s.gameScore
export const selectIsPaused = (s: AppState) => s.isPaused
export const selectPerformance = (s: AppState) => s.performance
export const selectSettings = (s: AppState) => s.settings
export const selectDebugMode = (s: AppState) => s.debugMode
