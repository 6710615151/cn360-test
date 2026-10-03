import React from 'react'
import { useAppStore, selectXR, selectInputMode } from '../app/store'
import { VRButton } from './VRButton'
import { ControllerStatus } from './ControllerStatus'
import { audio } from '../app/AudioManager'

interface Props {
  onEnterVR: () => Promise<void>
  onExitVR: () => Promise<void>
  onSelectGames: () => void
  onControllerTest: () => void
  onDiagnostics: () => void
  onSettings: () => void
}

const NAV_ITEMS = [
  { icon: '🎯', label: 'Target Shooter', tag: 'target-shooter' },
  { icon: '🧱', label: 'Block Breaker', tag: 'block-breaker' },
  { icon: '🚀', label: 'Space Arena', tag: 'space-arena' },
  { icon: '⚔️', label: 'Sword Arena', tag: 'sword-arena' },
  { icon: '🏃', label: 'Obstacle Course', tag: 'obstacle-course' },
]

export const MainMenu: React.FC<Props> = ({
  onEnterVR, onExitVR, onSelectGames, onControllerTest, onDiagnostics, onSettings,
}) => {
  const xr = useAppStore(selectXR)
  const inputMode = useAppStore(selectInputMode)

  return (
    <div className="relative flex flex-col items-center justify-center min-h-full px-6 py-10 overflow-y-auto">
      {/* Background grid effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#00f5ff 1px, transparent 1px), linear-gradient(90deg, #00f5ff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-dark-900" />
      </div>

      {/* Top status bar */}
      <div className="absolute top-4 left-4 z-10">
        <ControllerStatus />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-lg w-full">
        {/* Hero title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#00f5ff30] rounded-xs mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
            <span className="text-xs font-mono text-neon-cyan tracking-widest uppercase">
              Pico 4 · WebXR
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-black tracking-wider text-white drop-shadow-[0_0_20px_#00f5ff60]">
            VR GAME
          </h1>
          <h2 className="font-display text-4xl sm:text-5xl font-black tracking-wider neon-text">
            WORLD
          </h2>
          <p className="text-slate-500 font-mono text-sm mt-3">
            Browser-based VR arcade · 5 games · WebXR
          </p>
        </div>

        {/* VR Button */}
        <VRButton onEnterVR={onEnterVR} onExitVR={onExitVR} />

        {/* Divider */}
        <div className="flex items-center gap-4 w-full">
          <div className="flex-1 h-px bg-linear-to-r from-transparent to-[#00f5ff30]" />
          <span className="text-slate-600 text-xs font-mono tracking-wider uppercase">Games</span>
          <div className="flex-1 h-px bg-linear-to-l from-transparent to-[#00f5ff30]" />
        </div>

        {/* Game quick-select grid */}
        <div className="grid grid-cols-5 gap-2 w-full">
          {NAV_ITEMS.map(item => (
            <button
              key={item.tag}
              onClick={() => { audio.play('hover') }}
              onDoubleClick={() => { audio.play('select'); onSelectGames() }}
              className="flex flex-col items-center gap-1.5 p-3 border border-[#ffffff10]
                         bg-dark-800 hover:border-[#00f5ff40] hover:bg-[#0f0f1e]
                         transition-all duration-200 rounded-xs"
              title={item.label}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-[9px] font-mono text-slate-600 text-center leading-tight">
                {item.label}
              </span>
            </button>
          ))}
        </div>

        {/* Play button */}
        <button
          className="neon-btn w-full text-base py-4"
          onClick={() => { audio.play('select'); onSelectGames() }}
        >
          ▶ Browse All Games
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 w-full">
          <div className="flex-1 h-px bg-[#ffffff10]" />
          <span className="text-slate-700 text-xs font-mono tracking-wider uppercase">Tools</span>
          <div className="flex-1 h-px bg-[#ffffff10]" />
        </div>

        {/* Secondary nav */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {[
            { icon: '🎮', label: 'Controller Test', onClick: onControllerTest },
            { icon: '🔬', label: 'XR Diagnostics', onClick: onDiagnostics },
            { icon: '⚙️', label: 'Settings', onClick: onSettings },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => { audio.play('click'); item.onClick() }}
              className="flex flex-col items-center gap-2 p-4 border border-[#ffffff10]
                         bg-dark-800 hover:border-[#b400ff40] hover:bg-[#0a0014]
                         transition-all duration-200 rounded-xs"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-mono text-slate-500 text-center">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Mode indicator */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
          <span>{inputMode === 'vr' ? '◉ VR Mode' : '○ Desktop Mode'}</span>
          {xr.isSessionActive && (
            <span className="text-neon-green">· Session Active</span>
          )}
        </div>
      </div>
    </div>
  )
}
