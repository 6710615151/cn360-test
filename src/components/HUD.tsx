import React from 'react'
import { useAppStore, selectGameScore, selectCurrentGameId, selectIsPaused } from '../app/store'
import { GameRegistry } from '../games/GameRegistry'
import { audio } from '../app/AudioManager'

interface Props {
  onPause: () => void
  onExit: () => void
}

export const HUD: React.FC<Props> = ({ onPause, onExit }) => {
  const score = useAppStore(selectGameScore)
  const gameId = useAppStore(selectCurrentGameId)
  const isPaused = useAppStore(selectIsPaused)

  if (!gameId) return null

  const meta = GameRegistry.getAllMeta().find(m => m.id === gameId)
  const gameName = meta?.name ?? gameId

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none select-none">
      {/* Game title + score */}
      <div className="panel px-5 py-2 flex items-center gap-6">
        <span className="font-display text-xs text-neon-cyan tracking-widest uppercase">{gameName}</span>
        <div className="w-px h-4 bg-[#00f5ff30]" />
        <div className="flex items-center gap-1">
          <span className="text-slate-500 text-xs font-mono">SCORE</span>
          <span className="text-neon-cyan font-bold font-mono text-sm">{score.score.toLocaleString()}</span>
        </div>
        {score.combo > 1 && (
          <>
            <div className="w-px h-4 bg-[#00f5ff30]" />
            <span className="text-neon-pink font-bold font-mono text-xs animate-pulse">
              x{score.combo} COMBO
            </span>
          </>
        )}
        {score.lives > 0 && (
          <>
            <div className="w-px h-4 bg-[#00f5ff30]" />
            <span className="text-neon-pink font-mono text-xs">
              {'♥'.repeat(score.lives)}{'♡'.repeat(Math.max(0, 3 - score.lives))}
            </span>
          </>
        )}
        {score.timer > 0 && (
          <>
            <div className="w-px h-4 bg-[#00f5ff30]" />
            <span className="text-[#ffaa00] font-mono text-xs">{score.timer}s</span>
          </>
        )}
        {score.level > 1 && (
          <>
            <div className="w-px h-4 bg-[#00f5ff30]" />
            <span className="text-neon-purple font-mono text-xs">LVL {score.level}</span>
          </>
        )}
      </div>

      {/* Pause/exit buttons — pointer events re-enabled here */}
      <div className="flex gap-2 pointer-events-auto">
        <button
          className="px-4 py-1 text-xs font-mono border border-[#00f5ff30] text-slate-400
                     hover:border-neon-cyan hover:text-neon-cyan transition-all bg-[#050508cc] rounded-xs"
          onClick={() => { audio.play('click'); onPause() }}
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          className="px-4 py-1 text-xs font-mono border border-[#ff006e30] text-slate-400
                     hover:border-neon-pink hover:text-neon-pink transition-all bg-[#050508cc] rounded-xs"
          onClick={() => { audio.play('click'); onExit() }}
        >
          ✕ Exit
        </button>
      </div>
    </div>
  )
}
