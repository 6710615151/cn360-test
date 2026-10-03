import React from 'react'
import { useAppStore, selectXR, selectInputMode } from '../app/store'

export const ControllerStatus: React.FC = () => {
  const xr = useAppStore(selectXR)
  const inputMode = useAppStore(selectInputMode)

  if (inputMode === 'desktop') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 panel text-xs font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ffaa00]" />
        <span className="text-slate-400">Desktop Mode</span>
        <span className="text-slate-600">WASD+Mouse</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 panel text-xs font-mono">
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${xr.isSessionActive ? 'bg-[#39ff14]' : 'bg-slate-600'}`} />
        <span className="text-slate-400">VR</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${xr.hasLeft ? 'bg-[#00f5ff]' : 'bg-slate-700'}`} />
        <span className={xr.hasLeft ? 'text-[#00f5ff]' : 'text-slate-600'}>L</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${xr.hasRight ? 'bg-[#ff006e]' : 'bg-slate-700'}`} />
        <span className={xr.hasRight ? 'text-[#ff006e]' : 'text-slate-600'}>R</span>
      </div>
    </div>
  )
}
