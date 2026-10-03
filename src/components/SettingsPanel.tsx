import React from 'react'
import { useAppStore, selectSettings } from '../app/store'
import { audio } from '../app/AudioManager'

interface Props {
  onBack: () => void
}

export const SettingsPanel: React.FC<Props> = ({ onBack }) => {
  const settings = useAppStore(selectSettings)
  const updateSettings = useAppStore(s => s.updateSettings)

  const Slider: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
    <div className="flex items-center gap-4">
      <span className="text-slate-400 font-mono text-xs w-28">{label}</span>
      <input
        type="range" min={0} max={1} step={0.05} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-[#00f5ff] h-1"
      />
      <span className="text-[#00f5ff] font-mono text-xs w-10 text-right">{Math.round(value * 100)}%</span>
    </div>
  )

  const Toggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between">
      <span className="text-slate-400 font-mono text-xs">{label}</span>
      <button
        onClick={() => { audio.play('click'); onChange(!value) }}
        className={`px-3 py-1 text-xs font-mono border rounded-sm transition-all ${
          value
            ? 'border-[#00f5ff] text-[#00f5ff] bg-[#00f5ff15]'
            : 'border-slate-700 text-slate-600'
        }`}
      >
        {value ? 'ON' : 'OFF'}
      </button>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#00f5ff20]">
        <button
          className="text-slate-500 hover:text-[#00f5ff] transition-colors font-mono text-sm"
          onClick={() => { audio.play('click'); onBack() }}
        >
          ← Back
        </button>
        <h2 className="font-display text-[#00f5ff] tracking-widest text-sm uppercase">Settings</h2>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-md mx-auto w-full">
        <div className="space-y-6">
          {/* Audio */}
          <section>
            <h3 className="font-display text-xs text-[#b400ff] tracking-widest uppercase mb-3">Audio</h3>
            <div className="space-y-3">
              <Slider label="Master Volume" value={settings.masterVolume}
                onChange={v => { updateSettings({ masterVolume: v }); audio.setMasterVolume(v) }} />
              <Slider label="SFX Volume" value={settings.sfxVolume}
                onChange={v => { updateSettings({ sfxVolume: v }); audio.setSfxVolume(v) }} />
            </div>
          </section>

          {/* VR / Locomotion */}
          <section>
            <h3 className="font-display text-xs text-[#b400ff] tracking-widest uppercase mb-3">Locomotion</h3>
            <div className="space-y-3">
              {(['teleport', 'thumbstick', 'none'] as const).map(mode => (
                <div key={mode} className="flex items-center justify-between">
                  <span className="text-slate-400 font-mono text-xs capitalize">{mode}</span>
                  <button
                    onClick={() => { updateSettings({ locomotionMode: mode }); audio.play('click') }}
                    className={`px-3 py-1 text-xs font-mono border rounded-sm transition-all ${
                      settings.locomotionMode === mode
                        ? 'border-[#00f5ff] text-[#00f5ff] bg-[#00f5ff15]'
                        : 'border-slate-700 text-slate-600'
                    }`}
                  >
                    {settings.locomotionMode === mode ? '● Selected' : 'Select'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Graphics */}
          <section>
            <h3 className="font-display text-xs text-[#b400ff] tracking-widest uppercase mb-3">Graphics</h3>
            <div className="space-y-3">
              <Toggle label="Shadows" value={settings.shadowsEnabled}
                onChange={v => updateSettings({ shadowsEnabled: v })} />
              <Toggle label="Particles" value={settings.particlesEnabled}
                onChange={v => updateSettings({ particlesEnabled: v })} />
              <Toggle label="Performance HUD" value={settings.showPerformancePanel}
                onChange={v => updateSettings({ showPerformancePanel: v })} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
