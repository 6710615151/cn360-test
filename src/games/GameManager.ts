import { Game, GameContext } from './Game'
import { GameRegistry } from './GameRegistry'
import { GameId, useAppStore } from '../app/store'

export class GameManager {
  private currentGame: Game | null = null
  private ctx: GameContext
  private particleUpdaters: Array<(delta: number) => boolean> = []

  constructor(ctx: GameContext) {
    this.ctx = ctx
  }

  async loadGame(id: GameId): Promise<void> {
    // Dispose previous game cleanly
    if (this.currentGame) {
      this.disposeCurrentGame()
    }

    useAppStore.getState().setCurrentGame(id)
    useAppStore.getState().resetScore()

    const game = GameRegistry.create(id)
    this.currentGame = game

    await game.load(this.ctx)
  }

  startGame() {
    if (!this.currentGame) return
    this.currentGame.start()
    useAppStore.getState().setPaused(false)
  }

  pauseGame() {
    if (!this.currentGame) return
    this.currentGame.pause()
    useAppStore.getState().setPaused(true)
  }

  resumeGame() {
    if (!this.currentGame) return
    this.currentGame.resume()
    useAppStore.getState().setPaused(false)
  }

  resetGame() {
    if (!this.currentGame) return
    this.currentGame.reset()
    useAppStore.getState().resetScore()
  }

  exitGame() {
    this.disposeCurrentGame()
    useAppStore.getState().setCurrentGame(null)
    useAppStore.getState().setPaused(false)
    useAppStore.getState().navigateTo('game-selector')
  }

  /** Call every frame */
  update(delta: number, elapsed: number, frame?: XRFrame) {
    if (!useAppStore.getState().isPaused && this.currentGame) {
      this.currentGame.update(delta, elapsed, frame)
    }

    // Tick particle effects
    this.particleUpdaters = this.particleUpdaters.filter(fn => !fn(delta))
  }

  registerParticle(fn: (delta: number) => boolean) {
    this.particleUpdaters.push(fn)
  }

  getCurrentGame(): Game | null { return this.currentGame }

  private disposeCurrentGame() {
    if (this.currentGame) {
      this.currentGame.dispose()
      this.currentGame = null
    }
    this.particleUpdaters = []
  }

  dispose() {
    this.disposeCurrentGame()
  }
}
