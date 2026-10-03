import React, { useState } from 'react'
import { useAppStore, selectXR, selectInputMode } from '../app/store'
import { audio } from '../app/AudioManager'

interface Props {
  onEnterVR: () => Promise<void>
  onExitVR: () => Promise<void>
}

export const VRButton: React.FC<Props> = ({ onEnterVR, onExitVR }) => {
  const xr = useAppStore(selectXR)
  const inputMode = useAppStore(selectInputMode)
  const setInputMode = useAppStore(s => s.setInputMode)
  const [loading, setLoading] = useState(false)

  const handleEnterVR = async () => {
    if (loading) return
    audio.resume()
    setLoading(true)
    try {
      await onEnterVR()
      setInputMode('vr')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleExitVR = async () => {
    await onExitVR()
    setInputMode('desktop')
  }

  const handleDesktopMode = () => {
    audio.resume()
    setInputMode('desktop')
    audio.play('click')
  }

  if (!xr.isSupported) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="px-6 py-3 border border-slate-600 text-slate-500 font-display text-sm tracking-widest uppercase rounded-xs">
          VR Not Available
        </div>
        <p className="text-slate-600 text-xs text-center max-w-xs">
          {xr.errorMessage ?? 'WebXR not supported in this browser.'}
        </p>
        <button className="neon-btn text-sm" onClick={handleDesktopMode}>
          ▶ Desktop Mode
        </button>
      </div>
    )
  }

  if (xr.isSessionActive) {
    return (
      <button className="neon-btn-pink text-sm" onClick={handleExitVR}>
        ✕ Exit VR
      </button>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        className="neon-btn text-base px-8 py-4 animate-pulse-neon disabled:opacity-40"
        onClick={handleEnterVR}
        disabled={loading}
      >
        {loading ? '⟳ Connecting...' : '◉ Enter VR'}
      </button>
      {inputMode !== 'vr' && (
        <button
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors font-mono underline underline-offset-2"
          onClick={handleDesktopMode}
        >
          or continue in Desktop Mode
        </button>
      )}
    </div>
  )
}
