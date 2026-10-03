import React from 'react'
import { GameId, useAppStore } from '../app/store'
import { GameRegistry } from '../games/GameRegistry'
import { audio } from '../app/AudioManager'

interface Props {
  onSelectGame: (id: GameId) => void
  onBack: () => void
}

const GAME_ICONS: Record<string, string> = {
  'target-shooter': '🎯',
  'block-breaker': '🧱',
  'space-arena': '🚀',
  'sword-arena': '⚔️',
  'obstacle-course': '🏃',
}

const DIFFICULTY_LABELS = ['', 'Easy', 'Medium', 'Hard']
const DIFFICULTY_COLORS = ['', '#39ff14', '#ffaa00', '#ff006e']

export const GameSelector: React.FC<Props> = ({ onSelectGame, onBack }) => {
  const allMeta = GameRegistry.getAllMeta()
  const currentId = useAppStore(s => s.currentGameId)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#00f5ff20]">
        <button
          className="text-slate-500 hover:text-[#00f5ff] transition-colors font-mono text-sm"
          onClick={() => { audio.play('click'); onBack() }}
        >
          ← Back
        </button>
        <h2 className="font-display text-[#00f5ff] tracking-widest text-sm uppercase">
          Select Game
        </h2>
        <div className="w-12" />
      </div>

      {/* Game grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {allMeta.map(meta => {
            const isActive = meta.id === currentId
            return (
              <button
                key={meta.id}
                onClick={() => { audio.play('select'); onSelectGame(meta.id as GameId) }}
                className={`
                  relative flex flex-col p-5 text-left rounded-sm transition-all duration-200
                  border bg-[#0a0a12] hover:bg-[#0f0f1e]
                  ${isActive
                    ? 'border-[#00f5ff] shadow-[0_0_16px_#00f5ff40]'
                    : 'border-[#ffffff15] hover:border-[#00f5ff60] hover:shadow-[0_0_8px_#00f5ff20]'
                  }
                `}
              >
                {/* Game icon */}
                <div className="text-4xl mb-3">{GAME_ICONS[meta.id] ?? '🎮'}</div>

                {/* Name */}
                <h3 className="font-display text-sm text-white tracking-wide mb-1">
                  {meta.name}
                </h3>

                {/* Description */}
                <p className="text-slate-500 text-xs font-mono leading-relaxed mb-3 flex-1">
                  {meta.description}
                </p>

                {/* Difficulty */}
                <div className="flex items-center justify-between mt-auto">
                  <span
                    className="text-xs font-mono px-2 py-0.5 border rounded-sm"
                    style={{
                      color: DIFFICULTY_COLORS[meta.difficulty],
                      borderColor: DIFFICULTY_COLORS[meta.difficulty] + '44',
                      backgroundColor: DIFFICULTY_COLORS[meta.difficulty] + '11',
                    }}
                  >
                    {DIFFICULTY_LABELS[meta.difficulty]}
                  </span>
                  <span
                    className="text-xs font-display tracking-widest uppercase px-3 py-1 border rounded-sm
                               text-[#00f5ff] border-[#00f5ff] bg-[#00f5ff10] hover:bg-[#00f5ff25] transition-colors"
                  >
                    Play
                  </span>
                </div>

                {isActive && (
                  <div className="absolute top-2 right-2 text-[10px] font-mono text-[#00f5ff] bg-[#00f5ff15] px-1.5 py-0.5 rounded-sm">
                    ACTIVE
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
