import React, { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { useAppStore, selectView, selectInputMode, selectIsPaused, GameId } from './store'

// Three.js core
import { ThreeScene } from '../three/ThreeScene'
import { SimplePhysics } from '../three/Physics'
import { GameRegistry } from '../games/GameRegistry'

// VR systems
import { XRManager } from '../vr/XRManager'
import { HeadsetManager } from '../vr/HeadsetManager'
import { ControllerManager } from '../vr/ControllerManager'
import { InputManager } from '../vr/InputManager'
import { PointerManager } from '../vr/PointerManager'
import { TeleportSystem } from '../vr/TeleportSystem'
import { GrabSystem } from '../vr/GrabSystem'

// App systems
import { GameManager } from '../games/GameManager'
import { DesktopSimulation } from './DesktopSimulation'
import { audio } from './AudioManager'

// UI components
import { MainMenu } from '../components/MainMenu'
import { GameSelector } from '../components/GameSelector'
import { HUD } from '../components/HUD'
import { PerformancePanel } from '../components/PerformancePanel'
import { ControllerTestLab } from '../components/ControllerTestLab'
import { XRDiagnostics } from '../components/XRDiagnostics'
import { SettingsPanel } from '../components/SettingsPanel'
import { XRDebugPanel } from '../vr/XRDebugPanel'

// ─── Runtime refs (NOT React state — avoid re-renders for frame data) ─────────
interface RuntimeRefs {
  threeScene: ThreeScene | null
  xrManager: XRManager | null
  headsetManager: HeadsetManager | null
  controllerManager: ControllerManager | null
  inputManager: InputManager | null
  pointerManager: PointerManager | null
  teleportSystem: TeleportSystem | null
  grabSystem: GrabSystem | null
  gameManager: GameManager | null
  desktopSim: DesktopSimulation | null
  physics: SimplePhysics
}

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rt = useRef<RuntimeRefs>({
    threeScene: null, xrManager: null, headsetManager: null,
    controllerManager: null, inputManager: null, pointerManager: null,
    teleportSystem: null, grabSystem: null, gameManager: null,
    desktopSim: null, physics: new SimplePhysics(),
  })
  const controllerManagerRef = useRef<ControllerManager | null>(null)

  const view = useAppStore(selectView)
  const inputMode = useAppStore(selectInputMode)
  const isPaused = useAppStore(selectIsPaused)
  const { navigateTo, setInputMode } = useAppStore.getState()

  // ─── Initialize Three.js + all VR systems once ────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Three.js scene
    const threeScene = new ThreeScene({ canvas, worldConfig: { theme: 'default' } })
    rt.current.threeScene = threeScene

    const { renderer, cameraManager, world, interactionSystem } = threeScene

    // XR systems
    const xrManager = new XRManager({
      renderer,
      camera: cameraManager.camera,
      onSessionStart: () => {
        setInputMode('vr')
        sim.disable()
      },
      onSessionEnd: () => {
        setInputMode('desktop')
        sim.enable()
      },
    })
    rt.current.xrManager = xrManager

    const headsetManager = new HeadsetManager(xrManager, cameraManager.camera)
    rt.current.headsetManager = headsetManager

    const controllerManager = new ControllerManager(xrManager)
    controllerManager.setupWithRenderer(renderer, world.scene)
    rt.current.controllerManager = controllerManager
    controllerManagerRef.current = controllerManager

    const inputManager = new InputManager(controllerManager, headsetManager)
    inputManager.setDesktopMode(true)
    rt.current.inputManager = inputManager

    const pointerManager = new PointerManager(controllerManager, interactionSystem, world.scene)
    pointerManager.setCamera(cameraManager.camera)
    rt.current.pointerManager = pointerManager

    const teleportSystem = new TeleportSystem(world.scene, inputManager, cameraManager.camera)
    if (world.getFloor()) teleportSystem.setValidFloors([world.getFloor()!])
    rt.current.teleportSystem = teleportSystem

    const grabSystem = new GrabSystem(controllerManager, interactionSystem)
    rt.current.grabSystem = grabSystem

    // Game manager
    const gameCtx = {
      scene: world.scene,
      camera: cameraManager.camera,
      input: inputManager,
      pointer: pointerManager,
      interaction: interactionSystem,
      physics: rt.current.physics,
      audio,
      renderer,
    }
    const gameManager = new GameManager(gameCtx)
    rt.current.gameManager = gameManager

    // Desktop simulation
    const sim = new DesktopSimulation(cameraManager.camera, inputManager, headsetManager, canvas)
    sim.enable()
    rt.current.desktopSim = sim

    // ─── Main loop ───────────────────────────────────────────────────────────
    const unsubUpdate = threeScene.onUpdate((delta, elapsed) => {
      // Get XR frame from Three.js xr manager
      const frame = renderer.xr.enabled ? (renderer.xr as unknown as { getFrame?: () => XRFrame }).getFrame?.() : undefined

      // Update VR systems
      headsetManager.update(frame)
      controllerManager.update(frame)
      inputManager.setDesktopMode(!xrManager.isActive())

      // Locomotion
      const settings = useAppStore.getState().settings
      if (xrManager.isActive()) {
        if (settings.locomotionMode === 'teleport') {
          const dest = teleportSystem.update(delta)
          if (dest) {
            cameraManager.camera.position.set(dest.x, dest.y + 1.6, dest.z)
          }
        } else if (settings.locomotionMode === 'thumbstick') {
          applyThumbstickLocomotion(delta, inputManager, cameraManager.camera)
        }
      } else {
        sim.update(delta)
      }

      // Pointer
      pointerManager.update(xrManager.isActive())
      // Pointer select via trigger
      if (inputManager.getButtonDown('trigger', 'right')) {
        pointerManager.selectHovered(xrManager.isActive() ? 'right' : 'desktop')
      }
      if (inputManager.getButtonUp('trigger', 'right')) {
        pointerManager.releaseSelected(xrManager.isActive() ? 'right' : 'desktop')
      }

      // Grab
      grabSystem.update()

      // Game
      gameManager.update(delta, elapsed, frame)

      // Physics
      rt.current.physics.update(delta)

      // Flush input edge detection
      inputManager.flushFrame()
    })

    threeScene.start()

    return () => {
      unsubUpdate()
      sim.dispose()
      teleportSystem.dispose()
      pointerManager.dispose()
      controllerManager.dispose()
      gameManager.dispose()
      threeScene.dispose()
      rt.current = {
        threeScene: null, xrManager: null, headsetManager: null,
        controllerManager: null, inputManager: null, pointerManager: null,
        teleportSystem: null, grabSystem: null, gameManager: null,
        desktopSim: null, physics: new SimplePhysics(),
      }
      controllerManagerRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Update world theme when game changes ─────────────────────────────────
  useEffect(() => {
    const unsub = useAppStore.subscribe(
      s => s.currentGameId,
      (gameId) => {
        if (!rt.current.threeScene) return
        if (gameId) {
          const meta = GameRegistry.getAllMeta().find((m) => m.id === gameId)
          if (meta?.worldConfig) {
            rt.current.threeScene.setWorldConfig(meta.worldConfig)
          }
        } else {
          rt.current.threeScene.setWorldConfig({ theme: 'default' })
        }
      }
    )
    return unsub
  }, [])

  // ─── VR session handlers ──────────────────────────────────────────────────
  const handleEnterVR = useCallback(async () => {
    await rt.current.xrManager?.requestSession()
  }, [])

  const handleExitVR = useCallback(async () => {
    await rt.current.xrManager?.endSession()
  }, [])

  // ─── Game flow ────────────────────────────────────────────────────────────
  const handleSelectGame = useCallback(async (id: GameId) => {
    const gm = rt.current.gameManager
    if (!gm) return
    navigateTo('playing')
    await gm.loadGame(id)
    gm.startGame()
    // Update pointer — setup with new controller meshes
    rt.current.pointerManager?.setupWithControllers()
  }, [navigateTo])

  const handlePause = useCallback(() => {
    const gm = rt.current.gameManager
    if (!gm) return
    if (isPaused) {
      gm.resumeGame()
    } else {
      gm.pauseGame()
      audio.play('click')
    }
  }, [isPaused])

  const handleExit = useCallback(() => {
    rt.current.gameManager?.exitGame()
  }, [])

  // ─── Render UI layer ──────────────────────────────────────────────────────
  const renderUI = () => {
    switch (view) {
      case 'main-menu':
        return (
          <MainMenu
            onEnterVR={handleEnterVR}
            onExitVR={handleExitVR}
            onSelectGames={() => navigateTo('game-selector')}
            onControllerTest={() => navigateTo('controller-test')}
            onDiagnostics={() => navigateTo('xr-diagnostics')}
            onSettings={() => navigateTo('settings')}
          />
        )
      case 'game-selector':
        return (
          <GameSelector
            onSelectGame={handleSelectGame}
            onBack={() => navigateTo('main-menu')}
          />
        )
      case 'playing':
      case 'paused':
        return (
          <>
            {isPaused && <PauseOverlay onResume={handlePause} onExit={handleExit} />}
          </>
        )
      case 'controller-test':
        return (
          <ControllerTestLab
            controllers={controllerManagerRef.current}
            onBack={() => navigateTo('main-menu')}
          />
        )
      case 'xr-diagnostics':
        return <XRDiagnostics onBack={() => navigateTo('main-menu')} />
      case 'settings':
        return <SettingsPanel onBack={() => navigateTo('main-menu')} />
      default:
        return null
    }
  }

  const showHUD = view === 'playing' || view === 'paused'
  const showCanvas = true
  const showOverlay = view !== 'playing' || isPaused

  return (
    <div className="relative w-full h-full bg-dark-900 overflow-hidden">
      {/* Three.js canvas — always rendered */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full ${showCanvas ? 'opacity-100' : 'opacity-0'}`}
        style={{ touchAction: 'none' }}
      />

      {/* UI overlay — covers canvas when not playing */}
      {showOverlay && (
        <div className="absolute inset-0 z-20 overflow-hidden">
          {/* Semi-transparent backdrop for menus (not during gameplay) */}
          {view !== 'playing' && (
            <div className="absolute inset-0 bg-[#050508d0] backdrop-blur-xs" />
          )}
          <div className="relative z-10 h-full overflow-y-auto">
            {renderUI()}
          </div>
        </div>
      )}

      {/* HUD — always on top during gameplay */}
      {showHUD && <HUD onPause={handlePause} onExit={handleExit} />}

      {/* Performance monitor */}
      <PerformancePanel />

      {/* XR Debug panel — toggle with ⌥ DEBUG button */}
      <XRDebugPanel controllers={controllerManagerRef.current} />

      {/* Desktop mode crosshair */}
      {view === 'playing' && !isPaused && inputMode === 'desktop' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
          <div className="w-4 h-4 relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-[#00f5ff80]" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#00f5ff80]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border border-neon-cyan" />
          </div>
        </div>
      )}

      {/* Click to focus hint */}
      {view === 'playing' && !isPaused && inputMode === 'desktop' && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <p className="text-[10px] font-mono text-slate-600 bg-[#050508aa] px-3 py-1 rounded-xs">
            Click to lock mouse · ESC to pause
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyThumbstickLocomotion(
  delta: number,
  input: InputManager,
  camera: THREE.PerspectiveCamera
) {
  const x = input.getAxis('leftX')
  const z = input.getAxis('leftY')
  if (Math.abs(x) < 0.1 && Math.abs(z) < 0.1) return

  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  forward.y = 0
  forward.normalize()
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0))

  const speed = 3.0
  camera.position.addScaledVector(right, x * speed * delta)
  camera.position.addScaledVector(forward, -z * speed * delta)
}

const PauseOverlay: React.FC<{ onResume: () => void; onExit: () => void }> = ({
  onResume, onExit,
}) => (
  <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#050508cc] backdrop-blur-xs">
    <div className="panel p-8 flex flex-col items-center gap-6 min-w-[280px]">
      <div className="font-display text-2xl text-neon-cyan tracking-widest">PAUSED</div>
      <div className="flex flex-col gap-3 w-full">
        <button
          className="neon-btn w-full py-3"
          onClick={() => { audio.play('click'); onResume() }}
        >
          ▶ Resume
        </button>
        <button
          className="neon-btn-pink w-full py-3"
          onClick={() => { audio.play('click'); onExit() }}
        >
          ✕ Exit Game
        </button>
      </div>
    </div>
  </div>
)
