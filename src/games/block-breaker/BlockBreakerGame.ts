import * as THREE from 'three'
import { BaseGame, GameContext, GameMeta } from '../Game'
import { useAppStore } from '../../app/store'

interface Block {
  mesh: THREE.Mesh
  row: number
  col: number
  alive: boolean
  color: number
  points: number
}

interface Ball {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  attached: boolean  // true = held on paddle before launch
}

export class BlockBreakerGame extends BaseGame {
  readonly meta: GameMeta = {
    id: 'block-breaker',
    name: 'Block Breaker',
    description: 'Smash blocks with your paddle! Use the controller to hit the ball.',
    thumbnail: '🧱',
    difficulty: 2,
    worldConfig: { theme: 'neon' },
  }

  private paddle: THREE.Mesh | null = null
  private paddleGroup: THREE.Group | null = null
  private balls: Ball[] = []
  private blocks: Block[] = []
  private particleUpdaters: Array<(d: number) => boolean> = []

  private ballSpeed = 6
  private paddleWidth = 0.6
  private paddleHeight = 0.08
  private paddleDepth = 0.12

  private blockRows = 5
  private blockCols = 8
  private blockWidth = 0.5
  private blockHeight = 0.18
  private blockDepth = 0.22
  private blockSpacingX = 0.58
  private blockSpacingY = 0.26

  private playAreaMin = new THREE.Vector3(-3, 0.5, -8)
  private playAreaMax = new THREE.Vector3(3, 6, -2)

  async load(ctx: GameContext): Promise<void> {
    await super.load(ctx)
    this.buildPaddle()
    this.buildBlocks()
    this.buildBall()
    this.buildWalls()
  }

  private buildPaddle() {
    const geo = new THREE.BoxGeometry(this.paddleWidth, this.paddleHeight, this.paddleDepth)
    const mat = new THREE.MeshStandardMaterial({ color: 0x00f5ff, roughness: 0.2, metalness: 0.7, emissive: 0x003344 })
    this.paddle = new THREE.Mesh(geo, mat)
    this.paddle.castShadow = true
    this.geometries.push(geo)
    this.materials.push(mat)

    this.paddleGroup = new THREE.Group()
    this.paddleGroup.add(this.paddle)
    this.paddleGroup.position.set(0, 1.2, -3)

    // Attach paddle to right controller
    const rightCtrl = this.ctx.renderer.xr.getController(1)
    if (rightCtrl) {
      rightCtrl.add(this.paddleGroup)
    } else {
      this.addToScene(this.paddleGroup)
    }
  }

  private buildBall() {
    const geo = new THREE.SphereGeometry(0.1, 10, 8)
    const mat = new THREE.MeshStandardMaterial({ color: 0xff006e, roughness: 0.2, metalness: 0.5, emissive: 0x330011 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow = true
    this.geometries.push(geo)
    this.materials.push(mat)

    const ball: Ball = {
      mesh,
      velocity: new THREE.Vector3(2, 3, -5).normalize().multiplyScalar(this.ballSpeed),
      attached: true,
    }
    this.balls.push(ball)
    this.addToScene(mesh)
  }

  private buildBlocks() {
    const colors = [0xff006e, 0xb400ff, 0x00f5ff, 0x39ff14, 0xffaa00]
    const points = [50, 40, 30, 20, 10]

    for (let row = 0; row < this.blockRows; row++) {
      for (let col = 0; col < this.blockCols; col++) {
        const geo = new THREE.BoxGeometry(this.blockWidth, this.blockHeight, this.blockDepth)
        const color = colors[row % colors.length]
        const mat = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.3,
          metalness: 0.4,
          emissive: color,
          emissiveIntensity: 0.15,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.castShadow = true
        mesh.receiveShadow = true
        this.geometries.push(geo)
        this.materials.push(mat)

        const x = (col - (this.blockCols - 1) / 2) * this.blockSpacingX
        const y = 3.5 + row * this.blockSpacingY
        const z = -7
        mesh.position.set(x, y, z)

        const block: Block = { mesh, row, col, alive: true, color, points: points[row] }
        this.blocks.push(block)
        this.addToScene(mesh)
      }
    }
  }

  private buildWalls() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0a0a20, roughness: 0.9, transparent: true, opacity: 0.3, wireframe: true })
    this.materials.push(wallMat)

    // Side walls (invisible boundaries)
    const thickness = 0.1
    const wallData = [
      { pos: [this.playAreaMin.x - thickness / 2, 3, -5], size: [thickness, 8, 8] },
      { pos: [this.playAreaMax.x + thickness / 2, 3, -5], size: [thickness, 8, 8] },
      { pos: [0, this.playAreaMax.y + thickness / 2, -5], size: [8, thickness, 8] },
    ]
    for (const w of wallData) {
      const geo = new THREE.BoxGeometry(...(w.size as [number, number, number]))
      const mesh = new THREE.Mesh(geo, wallMat)
      mesh.position.set(...(w.pos as [number, number, number]))
      this.geometries.push(geo)
      this.addToScene(mesh)
    }
  }

  start() {
    super.start()
    // Ball starts attached to paddle
    for (const ball of this.balls) {
      ball.attached = true
    }
  }

  update(delta: number, _elapsed: number, _frame?: XRFrame) {
    if (!this.isActive) return

    // Paddle follows right controller or mouse
    this.updatePaddle(delta)

    // Launch ball on trigger
    if (this.ctx.input.getButtonDown('trigger', 'right')) {
      for (const ball of this.balls) {
        if (ball.attached) {
          ball.attached = false
          ball.velocity.set(1.5, 2, -4).normalize().multiplyScalar(this.ballSpeed)
          this.ctx.audio.play('click')
        }
      }
    }

    // Update balls
    for (const ball of this.balls) {
      if (ball.attached) {
        // Snap ball to paddle
        if (this.paddleGroup) {
          const worldPos = new THREE.Vector3()
          this.paddleGroup.getWorldPosition(worldPos)
          ball.mesh.position.copy(worldPos)
          ball.mesh.position.y += 0.15
        }
        continue
      }

      // Move
      ball.mesh.position.addScaledVector(ball.velocity, delta)
      const bp = ball.mesh.position

      // Wall bounces
      if (bp.x < this.playAreaMin.x + 0.1 || bp.x > this.playAreaMax.x - 0.1) {
        ball.velocity.x *= -1
        bp.x = THREE.MathUtils.clamp(bp.x, this.playAreaMin.x + 0.12, this.playAreaMax.x - 0.12)
        this.ctx.audio.play('hit')
      }
      if (bp.y > this.playAreaMax.y - 0.1) {
        ball.velocity.y *= -1
        this.ctx.audio.play('hit')
      }

      // Ball lost (below floor)
      if (bp.y < 0.2) {
        const lives = useAppStore.getState().gameScore.lives - 1
        useAppStore.getState().updateScore({ lives })
        this.ctx.audio.play('death')
        if (lives <= 0) {
          this.isActive = false
          this.ctx.audio.play('gameover')
          return
        }
        // Reset ball
        ball.attached = true
        ball.mesh.position.set(0, 1.3, -3)
        return
      }

      // Paddle collision
      if (this.paddleGroup) {
        const paddleWorld = new THREE.Vector3()
        this.paddleGroup.getWorldPosition(paddleWorld)
        const dx = Math.abs(bp.x - paddleWorld.x)
        const dy = Math.abs(bp.y - paddleWorld.y)
        const dz = Math.abs(bp.z - paddleWorld.z)

        if (dx < this.paddleWidth / 2 + 0.1 && dy < this.paddleHeight / 2 + 0.1 && dz < this.paddleDepth / 2 + 0.1) {
          // Reflect with angle based on hit offset
          const offsetX = (bp.x - paddleWorld.x) / (this.paddleWidth / 2)
          ball.velocity.x = offsetX * this.ballSpeed * 0.8
          ball.velocity.y = Math.abs(ball.velocity.y)
          ball.velocity.z = Math.abs(ball.velocity.z) * -1
          ball.velocity.normalize().multiplyScalar(this.ballSpeed)
          this.ctx.audio.play('hit')
        }
      }

      // Block collisions
      for (const block of this.blocks) {
        if (!block.alive) continue
        const bd = new THREE.Vector3().subVectors(bp, block.mesh.position)
        const absX = Math.abs(bd.x)
        const absY = Math.abs(bd.y)
        const absZ = Math.abs(bd.z)
        const halfX = this.blockWidth / 2 + 0.1
        const halfY = this.blockHeight / 2 + 0.1
        const halfZ = this.blockDepth / 2 + 0.1

        if (absX < halfX && absY < halfY && absZ < halfZ) {
          block.alive = false
          this.ctx.scene.remove(block.mesh)
          const burst = this.spawnParticleBurst(block.mesh.position.clone(), block.color, 14, 3.5, 0.5)
          this.particleUpdaters.push(burst)
          useAppStore.getState().addScore(block.points)
          useAppStore.getState().incrementCombo()
          this.ctx.audio.play('block_break')

          // Reflect
          if (absX > absY && absX > absZ) ball.velocity.x *= -1
          else if (absY > absX && absY > absZ) ball.velocity.y *= -1
          else ball.velocity.z *= -1

          // Check win
          if (this.blocks.every(b => !b.alive)) {
            this.ctx.audio.play('victory')
            const lvl = useAppStore.getState().gameScore.level
            useAppStore.getState().updateScore({ level: lvl + 1 })
            setTimeout(() => this.rebuildBlocks(), 1500)
          }
          break
        }
      }
    }

    this.particleUpdaters = this.particleUpdaters.filter(fn => !fn(delta))
  }

  private updatePaddle(_delta: number) {
    if (!this.paddleGroup) return
    if (this.ctx.input.isVRActive()) return // In VR, paddle follows controller automatically

    // Desktop: paddle follows mouse-driven camera look + fixed Z
    const dir = new THREE.Vector3()
    this.ctx.camera.getWorldDirection(dir)
    const t = (-3 - this.ctx.camera.position.z) / dir.z
    const paddleX = THREE.MathUtils.clamp(
      this.ctx.camera.position.x + dir.x * t,
      this.playAreaMin.x + this.paddleWidth / 2,
      this.playAreaMax.x - this.paddleWidth / 2
    )
    this.paddleGroup.position.x = paddleX
    this.paddleGroup.position.y = 1.2
    this.paddleGroup.position.z = -3
  }

  private rebuildBlocks() {
    for (const block of this.blocks) {
      if (!block.alive) {
        block.alive = true
        block.mesh.visible = true
        this.ctx.scene.add(block.mesh)
      }
    }
    this.ballSpeed += 0.5
  }

  reset() {
    for (const block of this.blocks) {
      if (!block.alive) {
        block.alive = true
        this.ctx.scene.add(block.mesh)
      }
    }
    for (const ball of this.balls) {
      ball.attached = true
      ball.mesh.position.set(0, 1.3, -3)
      ball.velocity.set(0, 0, 0)
    }
    this.ballSpeed = 6
    useAppStore.getState().resetScore()
  }

  dispose() {
    const rightCtrl = this.ctx.renderer.xr.getController(1)
    if (this.paddleGroup) rightCtrl?.remove(this.paddleGroup)
    this.balls = []
    this.blocks = []
    super.dispose()
  }
}
