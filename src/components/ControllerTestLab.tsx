import React, { useEffect, useRef, useState } from 'react'
import { ControllerManager } from '../vr/ControllerManager'
import { useAppStore, selectXR, selectInputMode } from '../app/store'
import { audio } from '../app/AudioManager'

interface Props {
  controllers: ControllerManager | null
  onBack: () => void
}

interface CtrlSnapshot {
  trigger: number; grip: number
  stickX: number; stickY: number
  primary: boolean; secondary: boolean; thumbstick: boolean
  connected: boolean
  posX: number; posY: number; posZ: number
}

const defaultSnap = (): CtrlSnapshot => ({
  trigger: 0, grip: 0, stickX: 0, stickY: 0,
  primary: false, secondary: false, thumbstick: false,
  connected: false, posX: 0, posY: 0, posZ: 0,
})

const Bar: React.FC<{ value: number; color: string; label: string }> = ({ value, color, label }) => (
  <div className="space-y-0.5">
    <div className="flex justify-between text-xs font-mono">
      <span className="text-slate-500">{label}</span>
      <span style={{ color }}>{Math.round(value * 100)}%</span>
    </div>
    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-75"
        style={{ width: `${value * 100}%`, backgroundColor: color }}
      />
    </div>
  </div>
)

const Stick: React.FC<{ x: number; y: number; color: string; label: string }> = ({ x, y, color, label }) => (
  <div className="flex flex-col items-center gap-1">
    <span className="text-xs font-mono text-slate-500">{label}</span>
    <div className="relative w-16 h-16 border border-slate-700 rounded-full bg-slate-900">
      {/* Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-px bg-slate-800" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-full w-px bg-slate-800" />
      </div>
      {/* Dot */}
      <div
        className="absolute w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
        style={{
          backgroundColor: color,
          left: `${(x * 0.45 + 0.5) * 100}%`,
          top: `${(-y * 0.45 + 0.5) * 100}%`,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
    </div>
    <span className="text-[10px] font-mono text-slate-600">
      {x.toFixed(2)}, {y.toFixed(2)}
    </span>
  </div>
)

const Btn: React.FC<{ label: string; pressed: boolean; color: string }> = ({ label, pressed, color }) => (
  <div
    className="px-3 py-1.5 text-xs font-mono border rounded-xs text-center transition-all duration-75 min-w-12"
    style={{
      borderColor: pressed ? color : '#333344',
      color: pressed ? color : '#555566',
      backgroundColor: pressed ? color + '22' : 'transparent',
      boxShadow: pressed ? `0 0 8px ${color}60` : 'none',
    }}
  >
    {label}
  </div>
)

const ControllerCard: React.FC<{
  title: string
  snap: CtrlSnapshot
  leftColor: string
  rightColor: string
  primaryLabel: string
  secondaryLabel: string
}> = ({ title, snap, leftColor, primaryLabel, secondaryLabel }) => (
  <div className="panel flex-1 min-w-0">
    <div className="panel-header" style={{ color: leftColor }}>
      {title} {snap.connected ? '● Connected' : '○ Disconnected'}
    </div>
    <div className="p-4 space-y-4">
      {/* Position */}
      <div>
        <p className="text-[10px] font-mono text-slate-600 mb-1 tracking-wider uppercase">Position</p>
        <div className="font-mono text-xs space-y-0.5 text-slate-400">
          <div>X: <span style={{ color: leftColor }}>{snap.posX.toFixed(3)}</span></div>
          <div>Y: <span style={{ color: leftColor }}>{snap.posY.toFixed(3)}</span></div>
          <div>Z: <span style={{ color: leftColor }}>{snap.posZ.toFixed(3)}</span></div>
        </div>
      </div>

      {/* Analog inputs */}
      <div className="space-y-2">
        <Bar value={snap.trigger} color={leftColor} label="Trigger" />
        <Bar value={snap.grip} color='#ffaa00' label="Grip" />
      </div>

      {/* Thumbstick */}
      <div className="flex justify-center">
        <Stick x={snap.stickX} y={snap.stickY} color={leftColor} label="Thumbstick" />
      </div>

      {/* Buttons */}
      <div>
        <p className="text-[10px] font-mono text-slate-600 mb-2 tracking-wider uppercase">Buttons</p>
        <div className="flex flex-wrap gap-1.5">
          <Btn label={primaryLabel} pressed={snap.primary} color={leftColor} />
          <Btn label={secondaryLabel} pressed={snap.secondary} color={leftColor} />
          <Btn label="Stick" pressed={snap.thumbstick} color='#ffaa00' />
        </div>
      </div>
    </div>
  </div>
)

export const ControllerTestLab: React.FC<Props> = ({ controllers, onBack }) => {
  const xr = useAppStore(selectXR)
  const inputMode = useAppStore(selectInputMode)
  const [left, setLeft] = useState<CtrlSnapshot>(defaultSnap())
  const [right, setRight] = useState<CtrlSnapshot>(defaultSnap())
  const rafRef = useRef<number>()

  useEffect(() => {
    const tick = () => {
      if (controllers) {
        const readCtrl = (hand: 'left' | 'right'): CtrlSnapshot => {
          const s = controllers.getState(hand)
          return {
            trigger: s.trigger, grip: s.grip,
            stickX: s.thumbstickX, stickY: s.thumbstickY,
            primary: s.primaryPressed, secondary: s.secondaryPressed,
            thumbstick: s.thumbstickPressed,
            connected: s.connected,
            posX: s.position.x, posY: s.position.y, posZ: s.position.z,
          }
        }
        setLeft(readCtrl('left'))
        setRight(readCtrl('right'))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [controllers])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#00f5ff20]">
        <button
          className="text-slate-500 hover:text-neon-cyan transition-colors font-mono text-sm"
          onClick={() => { audio.play('click'); onBack() }}
        >
          ← Back
        </button>
        <div className="text-center">
          <h2 className="font-display text-neon-cyan tracking-widest text-sm uppercase">
            Controller Test Lab
          </h2>
          <p className="text-slate-600 text-xs font-mono mt-0.5">
            {inputMode === 'vr'
              ? xr.isSessionActive ? 'VR Session Active — Move controllers to test' : 'Enter VR first'
              : 'Desktop Mode — Limited input preview'}
          </p>
        </div>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Status bar */}
        <div className="flex gap-3 mb-6 justify-center flex-wrap">
          <StatusBadge label="WebXR" ok={xr.isSupported} />
          <StatusBadge label="Session" ok={xr.isSessionActive} />
          <StatusBadge label="Left Ctrl" ok={xr.hasLeft} />
          <StatusBadge label="Right Ctrl" ok={xr.hasRight} />
          <StatusBadge label="RefSpace" value={xr.referenceSpaceType || '—'} />
        </div>

        {/* Controller cards */}
        <div className="flex gap-4 max-w-3xl mx-auto flex-wrap">
          <ControllerCard
            title="Left Controller" snap={left}
            leftColor="#00f5ff" rightColor="#00f5ff"
            primaryLabel="X" secondaryLabel="Y"
          />
          <ControllerCard
            title="Right Controller" snap={right}
            leftColor="#ff006e" rightColor="#ff006e"
            primaryLabel="A" secondaryLabel="B"
          />
        </div>

        {/* Desktop keyboard hint */}
        {inputMode === 'desktop' && (
          <div className="mt-6 panel max-w-md mx-auto p-4">
            <p className="panel-header -mx-4 -mt-4 mb-3 rounded-t-sm">Desktop Controls</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs font-mono">
              {[
                ['WASD', 'Move'], ['Mouse', 'Look'],
                ['Left Click', 'Trigger'], ['Right Click', 'Grip'],
                ['Space', 'Jump / Thumbstick'], ['F', 'Primary Button'],
                ['G', 'Secondary Button'], ['Esc', 'Pause / Menu'],
                ['1-5', 'Quick Select Game'],
              ].map(([key, val]) => (
                <React.Fragment key={key}>
                  <span className="text-neon-cyan">{key}</span>
                  <span className="text-slate-500">{val}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const StatusBadge: React.FC<{ label: string; ok?: boolean; value?: string }> = ({ label, ok, value }) => (
  <div className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono border rounded-xs ${
    ok === undefined ? 'border-slate-700 text-slate-400' :
    ok ? 'border-[#39ff1440] text-neon-green bg-[#39ff1410]' :
    'border-[#ff006e40] text-neon-pink bg-[#ff006e10]'
  }`}>
    {ok !== undefined && (
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-neon-green' : 'bg-neon-pink'}`} />
    )}
    <span>{label}</span>
    {value && <span className="text-slate-500 ml-1">{value}</span>}
  </div>
)
