import * as THREE from 'three'
import { BaseGame, GameContext, GameMeta } from '../Game'
import { useAppStore } from '../../app/store'

interface SwordEnemy {
  mesh: THREE.Group
  id: string
  health: number
  maxHealth: number
  speed: number
  state: 'patrol' | 'charge' | 'stunned' | 'dead'
  stateTimer: number
  patrolTarget: THREE.Vector3
  alive: boolean
  hitCooldown: number
}

export class SwordArenaGame extends BaseGame {
  readonly meta: GameMeta = {
    id: 'sword-arena',
    name: 'Sword Arena',
    description: 'Grip your sword and fight off waves of enemies. Swing to slash!',
    thumbnail: '⚔️',
    difficulty: 3,
    worldConfig: { theme: 'arena' },
  }

  private sword: THREE.Group | null = null
  private swordTip = new THREE.Vector3()
  private swordTipPrev = new THREE.Vector3()
  private swordVelocity = new THREE.Vector3()

  private enemies: SwordEnemy[] = []
  private particleUpdaters: Array<(d: number) => boolean> = []

  private wave = 0
  private waveTimer = 0
  private betweenWaves = false
  private betweenWaveTimer = 0
  private killCount = 0

  private swordGripped = false
  private gripReleaseTimer = 0

  async load(ctx: GameContext): Promise<void> {
    await super.load(ctx)
    this.buildSword()
    this.buildArena()
  }

  private buildSword() {
    this.sword = new THREE.Group()

    // Blade
    const bladeGeo = new THREE.BoxGeometry(0.04, 0.7, 0.015)
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xccddff, roughness: 0.1, metalness: 0.95,
      emissive: 0x1133aa, emissiveIntensity: 0.3,
    })
    const blade = new THREE.Mesh(bladeGeo, bladeMat)
    blade.position.y = 0.35
    this.geometries.push(bladeGeo)
    this.materials.push(bladeMat)

    // Guard
    const guardGeo = new THREE.BoxGeometry(0.18, 0.04, 0.04)
    const guardMat = new THREE.MeshStandardMaterial({ color: 0x886622, roughness: 0.4, metalness: 0.7 })
    const guard = new THREE.Mesh(guardGeo, guardMat)
    guard.position.y = 0.02
    this.geometries.push(guardGeo)
    this.materials.push(guardMat)

    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.2, 8)
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x4a2800, roughness: 0.8 })
    const handle = new THREE.Mesh(handleGeo, handleMat)
    handle.position.y = -0.12
    this.geometries.push(handleGeo)
    this.materials.push(handleMat)

    // Blade glow line
    const glowGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.65, 4)
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.7 })
    const glow = new THREE.Mesh(glowGeo, glowMat)
    glow.position.y = 0.35
    this.geometries.push(glowGeo)
    this.materials.push(glowMat)

    this.sword.add(blade, guard, handle, glow)
    this.sword.rotation.x = Math.PI / 2  // point forward

    // Attach to right controller
    const rightCtrl = this.ctx.renderer.xr.getController(1)
    if (rightCtrl) {
      rightCtrl.add(this.sword)
    } else {
      // Desktop: attach to camera, offset to right hand position
      this.sword.position.set(0.3, -0.3, -0.5)
      this.ctx.camera.add(this.sword)
    }
  }

  private buildArena() {
    // Arena floor with glow grid
    const floorGeo = new THREE.CircleGeometry(8, 32)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x110008, roughness: 0.9,
      emissive: 0x200010, emissiveIntensity: 0.5,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.geometries.push(floorGeo)
    this.materials.push(floorMat)
    this.addToScene(floor)

    // Arena walls (cylinder)
    const wallGeo = new THREE.CylinderGeometry(8, 8, 4, 16, 1, true)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x220011, roughness: 0.8,
      side: THREE.BackSide,
      emissive: 0xff006e, emissiveIntensity: 0.05,
    })
    const wall = new THREE.Mesh(wallGeo, wallMat)
    wall.position.y = 2
    this.geometries.push(wallGeo)
    this.materials.push(wallMat)
    this.addToScene(wall)

    // Torch lights
    const torchPositions = [
      [7, 2, 0], [-7, 2, 0], [0, 2, 7], [0, 2, -7],
      [5, 2, 5], [-5, 2, 5], [5, 2, -5], [-5, 2, -5],
    ]
    for (const pos of torchPositions) {
      const light = this.ctx.scene.getObjectByName('lighting')
        ? null
        : new THREE.PointLight(0xff6600, 0.6, 6)
      if (light) {
        light.position.set(pos[0], pos[1], pos[2])
        this.ctx.scene.add(light)
        this.objects.push(light)
      }
    }
  }

  private spawnWave() {
    this.wave++
    const count = 2 + this.wave
    const radius = 5 + Math.random()

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const pos = new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      )
      this.spawnEnemy(pos)
    }

    useAppStore.getState().updateScore({ level: this.wave })
    this.ctx.audio.play('countdown')
  }

  private spawnEnemy(position: THREE.Vector3) {
    const id = `sword_enemy_${Date.now()}_${Math.random()}`
    const group = new THREE.Group()

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.6, 4, 8)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x883300, roughness: 0.7, metalness: 0.2, emissive: 0x440000 })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.y = 0.6
    this.geometries.push(bodyGeo)
    this.materials.push(bodyMat)

    // Head
    const headGeo = new THREE.SphereGeometry(0.2, 8, 6)
    const headMat = new THREE.MeshStandardMaterial({ color: 0x662200, roughness: 0.5, emissive: 0xff0000, emissiveIntensity: 0.3 })
    const head = new THREE.Mesh(headGeo, headMat)
    head.position.y = 1.4
    this.geometries.push(headGeo)
    this.materials.push(headMat)

    // Enemy sword
    const eswGeo = new THREE.BoxGeometry(0.03, 0.5, 0.01)
    const eswMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9 })
    const esword = new THREE.Mesh(eswGeo, eswMat)
    esword.position.set(0.3, 0.9, 0)
    esword.rotation.z = Math.PI / 6
    this.geometries.push(eswGeo)
    this.materials.push(eswMat)

    group.add(body, head, esword)
    group.position.copy(position)

    const enemy: SwordEnemy = {
      mesh: group, id,
      health: 2 + Math.floor(this.wave / 2),
      maxHealth: 2 + Math.floor(this.wave / 2),
      speed: 1.2 + this.wave * 0.15,
      state: 'patrol',
      stateTimer: 0,
      patrolTarget: new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        0,
        (Math.random() - 0.5) * 10
      ),
      alive: true,
      hitCooldown: 0,
    }
    this.enemies.push(enemy)
    this.ctx.scene.add(group)
    this.objects.push(group)
  }

  start() {
    super.start()
    this.wave = 0
    this.killCount = 0
    this.betweenWaves = false
    this.spawnWave()
    useAppStore.getState().updateScore({ lives: 5 })
  }

  update(delta: number, elapsed: number, _frame?: XRFrame) {
    if (!this.isActive) return

    this.waveTimer += delta

    // Track sword tip for swing detection
    this.swordTipPrev.copy(this.swordTip)
    if (this.sword) {
      this.sword.localToWorld(this.swordTip.set(0, 0.7, 0))
      this.swordVelocity.subVectors(this.swordTip, this.swordTipPrev).divideScalar(delta)
    }

    const swingSpeed = this.swordVelocity.length()

    // Grip detection
    const gripPressed = this.ctx.input.getButton('grip', 'right')
    if (gripPressed && !this.swordGripped) {
      this.swordGripped = true
      this.ctx.audio.play('sword_swing')
    }
    if (!gripPressed) {
      this.swordGripped = false
    }

    // Swing attack — detect fast movement
    const isSwinging = swingSpeed > 2.5 || this.ctx.input.getButtonDown('trigger', 'right')
    if (isSwinging) {
      this.checkSwordHits()
    }

    const playerPos = this.ctx.camera.position

    // Enemy AI
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue
      enemy.stateTimer += delta
      enemy.hitCooldown = Math.max(0, enemy.hitCooldown - delta)

      const toPlayer = new THREE.Vector3().subVectors(playerPos, enemy.mesh.position)
      const distToPlayer = toPlayer.length()

      // Face player
      enemy.mesh.lookAt(playerPos.x, enemy.mesh.position.y, playerPos.z)

      switch (enemy.state) {
        case 'patrol': {
          const toTarget = new THREE.Vector3().subVectors(enemy.patrolTarget, enemy.mesh.position)
          if (toTarget.length() < 0.5 || enemy.stateTimer > 3) {
            enemy.patrolTarget.set((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12)
            enemy.stateTimer = 0
          }
          enemy.mesh.position.addScaledVector(toTarget.normalize(), enemy.speed * 0.5 * delta)
          if (distToPlayer < 4) { enemy.state = 'charge'; enemy.stateTimer = 0 }
          break
        }
        case 'charge': {
          enemy.mesh.position.addScaledVector(toPlayer.normalize(), enemy.speed * delta)
          // Attack player
          if (distToPlayer < 0.8 && enemy.hitCooldown <= 0) {
            enemy.hitCooldown = 1.5
            const lives = useAppStore.getState().gameScore.lives - 1
            useAppStore.getState().updateScore({ lives })
            this.ctx.audio.play('sword_hit')
            if (lives <= 0) {
              this.isActive = false
              this.ctx.audio.play('gameover')
              return
            }
          }
          if (distToPlayer > 8) enemy.state = 'patrol'
          break
        }
        case 'stunned': {
          if (enemy.stateTimer > 0.5) { enemy.state = 'charge'; enemy.stateTimer = 0 }
          break
        }
        case 'dead': break
      }

      // Clamp to arena
      const pos2D = new THREE.Vector2(enemy.mesh.position.x, enemy.mesh.position.z)
      if (pos2D.length() > 7.5) {
        pos2D.normalize().multiplyScalar(7.5)
        enemy.mesh.position.x = pos2D.x
        enemy.mesh.position.z = pos2D.y
      }
      enemy.mesh.position.y = 0

      // Bobbing
      enemy.mesh.getObjectByName?.('')
    }

    // Between waves
    if (this.enemies.filter(e => e.alive).length === 0 && !this.betweenWaves) {
      this.betweenWaves = true
      this.betweenWaveTimer = 0
      this.ctx.audio.play('victory')
      useAppStore.getState().addScore(500 * this.wave)
    }

    if (this.betweenWaves) {
      this.betweenWaveTimer += delta
      if (this.betweenWaveTimer >= 3) {
        this.betweenWaves = false
        this.spawnWave()
      }
    }

    this.particleUpdaters = this.particleUpdaters.filter(fn => !fn(delta))
  }

  private checkSwordHits() {
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.hitCooldown > 0) continue
      const dist = this.swordTip.distanceTo(enemy.mesh.position)
      if (dist < 1.0) {
        enemy.health--
        enemy.hitCooldown = 0.4
        enemy.state = 'stunned'
        enemy.stateTimer = 0

        const burst = this.spawnParticleBurst(enemy.mesh.position.clone(), 0xff3300, 20, 5, 0.5)
        this.particleUpdaters.push(burst)
        this.ctx.audio.play('sword_hit')
        useAppStore.getState().addScore(50)
        useAppStore.getState().incrementCombo()

        if (enemy.health <= 0) {
          enemy.alive = false
          enemy.state = 'dead'
          this.ctx.scene.remove(enemy.mesh)
          const bigBurst = this.spawnParticleBurst(enemy.mesh.position.clone(), 0xff6600, 35, 6, 0.8)
          this.particleUpdaters.push(bigBurst)
          this.ctx.audio.play('explosion')
          this.killCount++
          useAppStore.getState().addScore(150)
        }
      }
    }
  }

  reset() {
    for (const e of this.enemies) { if (e.alive) this.ctx.scene.remove(e.mesh) }
    this.enemies = []
    this.wave = 0
    this.killCount = 0
    useAppStore.getState().resetScore()
    useAppStore.getState().updateScore({ lives: 5 })
    this.spawnWave()
  }

  dispose() {
    for (const e of this.enemies) { if (e.alive) this.ctx.scene.remove(e.mesh) }
    this.enemies = []
    const rightCtrl = this.ctx.renderer.xr.getController(1)
    if (this.sword) {
      rightCtrl?.remove(this.sword)
      this.ctx.camera.remove(this.sword)
    }
    super.dispose()
  }
}
