import React from 'react'
import { useAppStore, selectPerformance, selectSettings } from '../app/store'

export const PerformancePanel: React.FC = () => {
  const perf = useAppStore(selectPerformance)
  const settings = useAppStore(selectSettings)

  if (!settings.showPerformancePanel) return null

  const fpsColor = perf.fps >= 72 ? '#39ff14' : perf.fps >= 45 ? '#ffaa00' : '#ff006e'

  return (
    <div className="fixed bottom-4 left-4 z-40 panel w-44 select-none pointer-events-none">
      <div className="panel-header">Performance</div>
      <div className="px-3 py-2 space-y-0.5 font-mono text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">FPS</span>
          <span style={{ color: fpsColor }} className="font-bold">{perf.fps}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Frame</span>
          <span className="text-slate-300">{perf.frameTime.toFixed(1)}ms</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Draws</span>
          <span className="text-slate-300">{perf.drawCalls}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Tris</span>
          <span className="text-slate-300">{(perf.triangles / 1000).toFixed(1)}K</span>
        </div>
      </div>
    </div>
  )
}
