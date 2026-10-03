import { Game, GameMeta } from './Game'
import { GameId } from '../app/store'

// Import all games
import { TargetShooterGame } from './target-shooter/TargetShooterGame'
import { BlockBreakerGame } from './block-breaker/BlockBreakerGame'
import { SpaceArenaGame } from './space-arena/SpaceArenaGame'
import { SwordArenaGame } from './sword-arena/SwordArenaGame'
import { ObstacleCourseGame } from './obstacle-course/ObstacleCourseGame'

export class GameRegistry {
  private static registry: Map<GameId, () => Game> = new Map<GameId, () => Game>([
    ['target-shooter', () => new TargetShooterGame()],
    ['block-breaker', () => new BlockBreakerGame()],
    ['space-arena', () => new SpaceArenaGame()],
    ['sword-arena', () => new SwordArenaGame()],
    ['obstacle-course', () => new ObstacleCourseGame()],
  ])

  static create(id: GameId): Game {
    const factory = this.registry.get(id)
    if (!factory) throw new Error(`Unknown game id: ${id}`)
    return factory()
  }

  static getAllMeta(): GameMeta[] {
    return Array.from(this.registry.keys()).map(id => {
      const game = this.create(id as GameId)
      return game.meta
    })
  }

  static getIds(): GameId[] {
    return Array.from(this.registry.keys()) as GameId[]
  }
}
