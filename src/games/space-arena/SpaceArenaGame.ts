import * as THREE from 'three'
import { BaseGame, GameContext, GameMeta } from '../Game'
import { useAppStore } from '../../app/store'

interface Enemy {
  mesh: THREE.Group
  id: string
  health: number
  maxHealth: number
  speed: number
  direction: THREE.Vector3
  lastShot: number
  shotInterval: number
  alive: boolean
}

interface Laser {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  lifetime: number
  fromPlayer: boolean
}

interface Platform {
  mesh: THREE.Mesh
  floatOffset: number
  floatSpeed: number
}

export class SpaceArenaGame extends BaseGame {
  readonly meta: GameMeta = {
    id: 'space-arena',
    name: 'Space Arena',
    description: 'Defend your station! Shoot down enemy ships in zero-gravity space.',
    thumbnail: '🚀',
    difficulty: 2,
    worldConfig: { theme: 'space' },
  }

  private enemies: Enemy[] = []
  private lasers: Laser[] = []
  private platforms: Platform[] = []
  private particleUpdaters: Array<(d: number) => boolean> = []

  private spawnTimer = 0
  private spawnInterval = 4.0
  private maxEnemies = 6
  private shotCooldown = 0
  private shotCooldownMax = 0.25
  private playerHealth = 3
  private elapsed = 0

  async load(ctx: GameContext): Promise<void> {
    await super.load(ctx)
    this.buildPlatforms()
    this.buildAsteroids()
  }

  private buildPlatforms() {
    const positions = [
      [0, 0, 0], [3, 0.5, -3], [-3, -0.3, -4],
      [5, 1, -6], [-5, 0.8, -5], [0, -0.5, -8],
    ]
    for (const pos of positions) {
      const geo = new THREE.CylinderGeometry(0.8, 0.8, 0.15, 8)
      const mat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.6, metalness: 0.8 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(pos[0], pos[1], pos[2])
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.geometries.push(geo)
      this.materials.push(mat)
      this.addToScene(mesh)
      this.platforms.push({ mesh, floatOffset: Math.random() * Math.PI * 2, floatSpeed: 0.4 + Math.random() * 0.3 })
    }
  }

  private buildAsteroids() {
    for (let i = 0; i < 20; i++) {
      const r = 0.3 + Math.random() * 0.8
      const geo = new THREE.IcosahedronGeometry(r, 0)
      const mat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.9, metalness: 0.1 })
      const mesh = new THREE.Mesh(geo, mat)
      const angle = Math.random() * Math.PI * 2
      const dist = 8 + Math.random() * 15
      mesh.position.set(
        Math.cos(angle) * dist,
        (Math.random() - 0.5) * 8,
        Math.sin(angle) * dist - 5
      )
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      mesh.castShadow = true
      this.geometries.push(geo)
      this.materials.push(mat)
      this.addToScene(mesh)
    }
  }

  private spawnEnemy() {
    if (this.enemies.length >= this.maxEnemies) return
    const id = `enemy_${Date.now()}_${Math.random()}`

    const group = new THREE.Group()

    // Enemy body (UFO shape)
    const bodyGeo = new THREE.SphereGeometry(0.35, 8, 6)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff4400, roughness: 0.3, metalness: 0.7, emissive: 0x220000 })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    this.geometries.push(bodyGeo)
    this.materials.push(bodyMat)

    const discGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.08, 10)
    const discMat = new THREE.MeshStandardMaterial({ color: 0x884422, roughness: 0.4, metalness: 0.6 })
    const disc = new THREE.Mesh(discGeo, discMat)
    this.geometries.push(discGeo)
    this.materials.push(discMat)

    group.add(body, disc)

    // Spawn far from player
    const angle = Math.random() * Math.PI * 2
    group.position.set(
      Math.cos(angle) * 12,
      (Math.random() - 0.5) * 4 + 1.6,
      Math.sin(angle) * 12 - 5
    )

    const enemy: Enemy = {
      mesh: group, id,
      health: 2, maxHealth: 2,
      speed: 1.5 + Math.random() * 1.5,
      direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
      lastShot: 0,
      shotInterval: 2.5 + Math.random() * 2,
      alive: true,
    }
    this.enemies.push(enemy)
    this.ctx.scene.add(group)
    this.objects.push(group)
  }

  private fireLaser(fromPlayer: boolean, origin: THREE.Vector3, direction: THREE.Vector3) {
    const geo = new THREE.CylinderGeometry(0.025, 0.025, 0.6, 4)
    const color = fromPlayer ? 0x00f5ff : 0xff2200
    const mat = new THREE.MeshBasicMaterial({ color })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(origin)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())
    this.geometries.push(geo)
    this.materials.push(mat)
    this.ctx.scene.add(mesh)
    this.objects.push(mesh)

    this.lasers.push({
      mesh,
      velocity: direction.clone().normalize().multiplyScalar(fromPlayer ? 18 : 10),
      lifetime: fromPlayer ? 1.5 : 2.0,
      fromPlayer,
    })
    this.ctx.audio.play(fromPlayer ? 'laser' : 'shoot')
  }

  private playerShoot() {
    if (this.shotCooldown > 0) return
    this.shotCooldown = this.shotCooldownMax

    const origin = new THREE.Vector3()
    const direction = new THREE.Vector3()

    const rightCtrl = this.ctx.renderer.xr.getController(1)
    if (rightCtrl && this.ctx.input.isVRActive()) {
      rightCtrl.getWorldPosition(origin)
      rightCtrl.getWorldDirection(direction)
      direction.negate()
    } else {
      this.ctx.camera.getWorldPosition(origin)
      this.ctx.camera.getWorldDirection(direction)
    }
    this.fireLaser(true, origin, direction)
  }

  start() {
    super.start()
    this.playerHealth = 3
    useAppStore.getState().updateScore({ lives: 3 })
    for (let i = 0; i < 2; i++) this.spawnEnemy()
  }

  update(delta: number, elapsed: number, _frame?: XRFrame) {
    if (!this.isActive) return

    this.elapsed += delta
    this.shotCooldown = Math.max(0, this.shotCooldown - delta)
    this.spawnTimer += delta

    // Input
    if (this.ctx.input.getButtonDown('trigger', 'right')) this.playerShoot()
    if (!this.ctx.input.isVRActive() && this.ctx.input.isKeyDown('Space')) this.playerShoot()

    // Spawn enemies
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0
      this.spawnEnemy()
      this.spawnInterval = Math.max(2.0, 4.0 - this.elapsed * 0.05)
    }

    const playerPos = this.ctx.camera.position

    // Update enemies
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue
      enemy.mesh.rotation.y += delta * 1.2

      // Move toward player
      const toPlayer = new THREE.Vector3().subVectors(playerPos, enemy.mesh.position).normalize()
      enemy.mesh.position.addScaledVector(toPlayer, enemy.speed * delta * 0.4)
      enemy.mesh.position.addScaledVector(enemy.direction, enemy.speed * delta * 0.6)

      // Bounce direction
      if (enemy.mesh.position.length() > 18) {
        enemy.direction.negate()
      }

      // Enemy shoots
      enemy.lastShot += delta
      if (enemy.lastShot >= enemy.shotInterval) {
        enemy.lastShot = 0
        const dir = new THREE.Vector3().subVectors(playerPos, enemy.mesh.position).normalize()
        this.fireLaser(false, enemy.mesh.position.clone(), dir)
      }

      // Float platforms
      for (const p of this.platforms) {
        p.mesh.position.y += Math.sin(elapsed * p.floatSpeed + p.floatOffset) * 0.002
      }
    }

    // Update lasers
    const toRemoveLasers: Laser[] = []
    for (const laser of this.lasers) {
      laser.mesh.position.addScaledVector(laser.velocity, delta)
      laser.lifetime -= delta
      if (laser.lifetime <= 0) { toRemoveLasers.push(laser); continue }

      if (laser.fromPlayer) {
        // Check enemy hits
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue
          if (laser.mesh.position.distanceTo(enemy.mesh.position) < 0.6) {
            enemy.health--
            toRemoveLasers.push(laser)
            const burst = this.spawnParticleBurst(enemy.mesh.position.clone(), 0xff4400, 16, 5, 0.6)
            this.particleUpdaters.push(burst)
            this.ctx.audio.play('hit')

            if (enemy.health <= 0) {
              enemy.alive = false
              this.ctx.scene.remove(enemy.mesh)
              const expBurst = this.spawnParticleBurst(enemy.mesh.position.clone(), 0xff8800, 30, 6, 0.8)
              this.particleUpdaters.push(expBurst)
              this.ctx.audio.play('explosion')
              useAppStore.getState().addScore(200)
              useAppStore.getState().incrementCombo()
            }
            break
          }
        }
      } else {
        // Enemy laser hits player
        if (laser.mesh.position.distanceTo(playerPos) < 0.5) {
          toRemoveLasers.push(laser)
          this.playerHealth--
          useAppStore.getState().updateScore({ lives: this.playerHealth })
          this.ctx.audio.play('death')
          if (this.playerHealth <= 0) {
            this.isActive = false
            this.ctx.audio.play('gameover')
          }
        }
      }
    }

    for (const l of toRemoveLasers) {
      this.ctx.scene.remove(l.mesh)
      l.mesh.geometry.dispose()
      ;(l.mesh.material as THREE.Material).dispose()
    }
    this.lasers = this.lasers.filter(l => !toRemoveLasers.includes(l))
    this.enemies = this.enemies.filter(e => e.alive)
    this.particleUpdaters = this.particleUpdaters.filter(fn => !fn(delta))
  }

  reset() {
    for (const e of this.enemies) { this.ctx.scene.remove(e.mesh) }
    for (const l of this.lasers) { this.ctx.scene.remove(l.mesh) }
    this.enemies = []
    this.lasers = []
    this.playerHealth = 3
    this.elapsed = 0
    this.spawnTimer = 0
    useAppStore.getState().resetScore()
    useAppStore.getState().updateScore({ lives: 3 })
    for (let i = 0; i < 2; i++) this.spawnEnemy()
  }

  dispose() {
    for (const e of this.enemies) { this.ctx.scene.remove(e.mesh) }
    for (const l of this.lasers) { this.ctx.scene.remove(l.mesh) }
    this.enemies = []
    this.lasers = []
    super.dispose()
  }
}
