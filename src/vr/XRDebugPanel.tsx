import React, { useEffect, useRef, useState } from 'react'
import { headsetRuntime } from './HeadsetManager'
import { ControllerManager } from './ControllerManager'
import { useAppStore, selectPerformance, selectXR, selectDebugMode } from '../app/store'

interface Props {
  controllers: ControllerManager | null
}

interface DebugSnapshot {
  headPos: { x: string; y: string; z: string }
  headRot: { x: string; y: string; z: string }
  headConnected: boolean
  left: {
    connected: boolean
    pos: { x: string; y: string; z: string }
    trigger: string
    grip: string
    stickX: string
    stickY: string
    primary: boolean
    secondary: boolean
    thumbstick: boolean
  }
  right: {
    connected: boolean
    pos: { x: string; y: string; z: string }
    trigger: string
    grip: string
    stickX: string
    stickY: string
    primary: boolean
    secondary: boolean
    thumbstick: boolean
  }
}

export const XRDebugPanel: React.FC<Props> = ({ controllers }) => {
  const debugMode = useAppStore(selectDebugMode)
  const xr = useAppStore(selectXR)
  const perf = useAppStore(selectPerformance)
  const setDebugMode = useAppStore(s => s.setDebugMode)
  const [snap, setSnap] = useState<DebugSnapshot | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!debugMode) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      const p = headsetRuntime.position
      const r = headsetRuntime.rotation
      const deg = (v: number) => (v * 180 / Math.PI).toFixed(1)
      const fmt = (v: number) => v.toFixed(3)

      const readCtrl = (hand: 'left' | 'right') => {
        const s = controllers?.getState(hand)
        if (!s) return {
          connected: false, pos: { x: '0', y: '0', z: '0' },
          trigger: '0.00', grip: '0.00', stickX: '0.00', stickY: '0.00',
          primary: false, secondary: false, thumbstick: false,
        }
        return {
          connected: s.connected,
          pos: { x: fmt(s.position.x), y: fmt(s.position.y), z: fmt(s.position.z) },
          trigger: s.trigger.toFixed(2),
          grip: s.grip.toFixed(2),
          stickX: s.thumbstickX.toFixed(2),
          stickY: s.thumbstickY.toFixed(2),
          primary: s.primaryPressed,
          secondary: s.secondaryPressed,
          thumbstick: s.thumbstickPressed,
        }
      }

      setSnap({
        headPos: { x: fmt(p.x), y: fmt(p.y), z: fmt(p.z) },
        headRot: { x: deg(r.x), y: deg(r.y), z: deg(r.z) },
        headConnected: headsetRuntime.connected,
        left: readCtrl('left'),
        right: readCtrl('right'),
      })
    }, 60)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [debugMode, controllers])

  return (
    <>
      {/* Toggle button always visible */}
      <button
        onClick={() => setDebugMode(!debugMode)}
        className="fixed top-4 right-4 z-50 px-3 py-1.5 text-xs font-mono border border-[#00f5ff40] 
                   text-[#00f5ff] bg-[#050508cc] hover:border-[#00f5ff] hover:bg-[#00f5ff15]
                   transition-all duration-150 rounded-sm"
      >
        {debugMode ? '✕ DEBUG' : '⌥ DEBUG'}
      </button>

      {debugMode && (
        <div className="fixed top-14 right-4 z-50 w-64 max-h-[calc(100vh-5rem)] overflow-y-auto
                        bg-[#050508e8] border border-[#00f5ff30] rounded-sm text-xs font-mono
                        backdrop-blur-sm select-none">

          {/* XR Status */}
          <div className="px-3 py-1.5 border-b border-[#00f5ff20] text-[#00f5ff] font-bold tracking-wider text-[10px] uppercase">
            XR Status
          </div>
          <div className="px-3 py-1.5 space-y-0.5">
            <Row label="WebXR" value={xr.isSupported ? 'Supported' : 'Not Supported'} ok={xr.isSupported} />
            <Row label="Session" value={xr.isSessionActive ? 'Active' : 'Inactive'} ok={xr.isSessionActive} />
            <Row label="RefSpace" value={xr.referenceSpaceType || '—'} />
          </div>

          {/* Headset */}
          <div className="px-3 py-1.5 border-y border-[#00f5ff20] text-[#b400ff] font-bold tracking-wider text-[10px] uppercase">
            Headset {snap?.headConnected ? '● VR' : '○ Desktop'}
          </div>
          {snap && (
            <div className="px-3 py-1.5 space-y-0.5">
              <Row label="Pos X" value={snap.headPos.x} />
              <Row label="Pos Y" value={snap.headPos.y} />
              <Row label="Pos Z" value={snap.headPos.z} />
              <Row label="Rot X°" value={snap.headRot.x} />
              <Row label="Rot Y°" value={snap.headRot.y} />
              <Row label="Rot Z°" value={snap.headRot.z} />
            </div>
          )}

          {/* Left Controller */}
          <ControllerBlock title="Left Controller" data={snap?.left} color="cyan" />

          {/* Right Controller */}
          <ControllerBlock title="Right Controller" data={snap?.right} color="pink" />

          {/* Performance */}
          <div className="px-3 py-1.5 border-t border-[#00f5ff20] text-[#39ff14] font-bold tracking-wider text-[10px] uppercase">
            Performance
          </div>
          <div className="px-3 py-1.5 pb-3 space-y-0.5">
            <Row label="FPS" value={perf.fps.toString()} ok={perf.fps >= 60} />
            <Row label="Frame" value={`${perf.frameTime.toFixed(1)}ms`} />
            <Row label="Draws" value={perf.drawCalls.toString()} />
            <Row label="Tris" value={perf.triangles.toLocaleString()} />
          </div>
        </div>
      )}
    </>
  )
}

const Row: React.FC<{ label: string; value: string; ok?: boolean }> = ({ label, value, ok }) => (
  <div className="flex justify-between">
    <span className="text-slate-500">{label}</span>
    <span className={ok === undefined ? 'text-slate-200' : ok ? 'text-[#39ff14]' : 'text-[#ff006e]'}>
      {value}
    </span>
  </div>
)

interface CtrlData {
  connected: boolean
  pos: { x: string; y: string; z: string }
  trigger: string; grip: string
  stickX: string; stickY: string
  primary: boolean; secondary: boolean; thumbstick: boolean
}

const ControllerBlock: React.FC<{ title: string; data?: CtrlData | null; color: 'cyan' | 'pink' }> = ({ title, data, color }) => {
  const c = color === 'cyan' ? '#00f5ff' : '#ff006e'
  return (
    <>
      <div className="px-3 py-1.5 border-y border-[#00f5ff20] font-bold tracking-wider text-[10px] uppercase" style={{ color: c }}>
        {title} {data?.connected ? '●' : '○'}
      </div>
      <div className="px-3 py-1.5 space-y-0.5">
        {data?.connected ? (
          <>
            <Row label="Pos X" value={data.pos.x} />
            <Row label="Pos Y" value={data.pos.y} />
            <Row label="Pos Z" value={data.pos.z} />
            <Row label="Trigger" value={data.trigger} />
            <Row label="Grip" value={data.grip} />
            <Row label="Stick X" value={data.stickX} />
            <Row label="Stick Y" value={data.stickY} />
            <Row label="Primary" value={data.primary ? 'ON' : 'OFF'} ok={data.primary} />
            <Row label="Secondary" value={data.secondary ? 'ON' : 'OFF'} ok={data.secondary} />
            <Row label="Stick Btn" value={data.thumbstick ? 'ON' : 'OFF'} ok={data.thumbstick} />
          </>
        ) : (
          <span className="text-slate-600">Not connected</span>
        )}
      </div>
    </>
  )
}
