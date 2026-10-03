import React, { useEffect, useState } from 'react'
import { useAppStore, selectXR, selectPerformance } from '../app/store'
import { audio } from '../app/AudioManager'

interface Props {
  onBack: () => void
}

interface DiagRow {
  label: string
  value: string
  status: 'ok' | 'warn' | 'error' | 'info'
}

export const XRDiagnostics: React.FC<Props> = ({ onBack }) => {
  const xr = useAppStore(selectXR)
  const perf = useAppStore(selectPerformance)
  const [webglInfo, setWebglInfo] = useState<string>('Checking...')
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // Quick WebGL capability check
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      if (gl) {
        const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info')
        const renderer = ext
          ? (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL)
          : 'Available'
        setWebglInfo(renderer as string)
      } else {
        setWebglInfo('Not Available')
      }
    } catch {
      setWebglInfo('Error')
    }
    setChecked(true)
  }, [])

  const rows: DiagRow[] = [
    {
      label: 'WebXR API',
      value: typeof navigator !== 'undefined' && 'xr' in navigator ? 'Available' : 'Not Available',
      status: typeof navigator !== 'undefined' && 'xr' in navigator ? 'ok' : 'error',
    },
    {
      label: 'Immersive VR',
      value: xr.isSupported ? 'Supported' : 'Not Supported',
      status: xr.isSupported ? 'ok' : 'warn',
    },
    {
      label: 'VR Session',
      value: xr.isSessionActive ? 'Active' : 'Inactive',
      status: xr.isSessionActive ? 'ok' : 'info',
    },
    {
      label: 'Reference Space',
      value: xr.referenceSpaceType || '—',
      status: xr.referenceSpaceType ? 'ok' : 'info',
    },
    {
      label: 'WebGL',
      value: checked ? webglInfo : 'Checking...',
      status: webglInfo !== 'Not Available' ? 'ok' : 'error',
    },
    {
      label: 'Left Controller',
      value: xr.hasLeft ? 'Connected' : 'Not Connected',
      status: xr.hasLeft ? 'ok' : 'info',
    },
    {
      label: 'Right Controller',
      value: xr.hasRight ? 'Connected' : 'Not Connected',
      status: xr.hasRight ? 'ok' : 'info',
    },
    {
      label: 'Hand Tracking',
      value: xr.hasHands ? 'Available' : 'Not Available',
      status: xr.hasHands ? 'ok' : 'info',
    },
    {
      label: 'FPS',
      value: `${perf.fps}`,
      status: perf.fps >= 72 ? 'ok' : perf.fps >= 45 ? 'warn' : 'error',
    },
    {
      label: 'Frame Time',
      value: `${perf.frameTime.toFixed(1)}ms`,
      status: perf.frameTime < 15 ? 'ok' : perf.frameTime < 25 ? 'warn' : 'error',
    },
    {
      label: 'Draw Calls',
      value: `${perf.drawCalls}`,
      status: perf.drawCalls < 100 ? 'ok' : 'warn',
    },
    {
      label: 'Triangles',
      value: `${(perf.triangles / 1000).toFixed(1)}K`,
      status: perf.triangles < 200000 ? 'ok' : 'warn',
    },
  ]

  const statusColor = {
    ok: '#39ff14',
    warn: '#ffaa00',
    error: '#ff006e',
    info: '#00f5ff',
  }

  const statusIcon = { ok: '●', warn: '◐', error: '○', info: '◉' }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#00f5ff20]">
        <button
          className="text-slate-500 hover:text-neon-cyan transition-colors font-mono text-sm"
          onClick={() => { audio.play('click'); onBack() }}
        >
          ← Back
        </button>
        <h2 className="font-display text-neon-cyan tracking-widest text-sm uppercase">
          XR Diagnostics
        </h2>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto">
          <p className="text-slate-600 text-xs font-mono mb-6 text-center">
            Real-time WebXR and performance diagnostics for Pico 4 debugging.
          </p>

          <div className="panel">
            {rows.map((row, i) => (
              <div
                key={row.label}
                className={`flex items-center justify-between px-4 py-2.5 font-mono text-sm
                  ${i < rows.length - 1 ? 'border-b border-[#ffffff08]' : ''}`}
              >
                <span className="text-slate-400">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 text-xs max-w-[180px] text-right truncate">
                    {row.value}
                  </span>
                  <span style={{ color: statusColor[row.status] }} className="text-xs">
                    {statusIcon[row.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Error message */}
          {xr.errorMessage && (
            <div className="mt-4 panel p-4 border-[#ff006e40]">
              <p className="text-[10px] font-mono text-neon-pink tracking-wider uppercase mb-1">Error</p>
              <p className="text-xs font-mono text-slate-400">{xr.errorMessage}</p>
            </div>
          )}

          {/* Pico 4 hint */}
          <div className="mt-6 panel p-4 border-[#b400ff30]">
            <p className="text-[10px] font-mono text-neon-purple tracking-wider uppercase mb-2">Pico 4 Setup</p>
            <ol className="text-xs font-mono text-slate-500 space-y-1 list-decimal list-inside">
              <li>Deploy to Vercel (HTTPS required)</li>
              <li>Open Pico Browser on your Pico 4</li>
              <li>Navigate to your Vercel URL</li>
              <li>Tap "Enter VR" button</li>
              <li>Allow VR permissions when prompted</li>
              <li>Use this page to verify controller input</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
