import * as THREE from 'three'
import { BaseGame, GameContext, GameMeta } from '../Game'
import { useAppStore } from '../../app/store'
import { Interactable } from '../../three/Interaction'

interface Target {
  mesh: THREE.Mesh
  interactable: Interactable
  id: string
  health: number
  moving: boolean
  speed: number
  direction: THREE.Vector3
  boundsMin: number
  boundsMax: number
  spawnTime: number
  lifetime: number
}

export class TargetShooterGame extends BaseGame {
  readonly meta: GameMeta = {
    id: 'target-shooter',
    name: 'Target Shooter',
    description: 'Shoot moving targets with your VR gun. Build combos for max score!',
    thumbnail: '🎯',
    difficulty: 1,
    worldConfig: { theme: 'default' },
  }

  private targets: Target[] = []
  private gun: THREE.Group | null = null
  private muzzleFlash: THREE.Mesh | null = null
  private flashTimer = 0

  private spawnTimer = 0
  private spawnInterval = 2.0   // seconds between spawns
  private maxTargets = 8
  private shotCooldown = 0
  private shotCooldownMax = 0.3

  private gameDuration = 60
  private elapsed = 0
  private particleUpdaters: Array<(d: number) => boolean> = []

  async load(ctx: GameContext): Promise<void> {
    await super.load(ctx)
    this.buildGun()
    this.buildEnvironment()
  }

  private buildGun() {
    this.gun = new THREE.Group()

    // Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8)
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.8 })
    const barrel = new THREE.Mesh(barrelGeo, gunMat)
    this.geometries.push(barrelGeo)
    this.materials.push(gunMat)
    barrel.rotation.x = Math.PI / 2
    barrel.position.z = -0.15

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.05, 0.1, 0.2)
    const body = new THREE.Mesh(bodyGeo, gunMat)
    this.geometries.push(bodyGeo)
    body.position.y = -0.03
    body.position.z = -0.02

    // Muzzle flash
    const flashGeo = new THREE.SphereGeometry(0.04, 6, 6)
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 })
    this.muzzleFlash = new THREE.Mesh(flashGeo, flashMat)
    this.geometries.push(flashGeo)
    this.materials.push(flashMat)
    this.muzzleFlash.position.z = -0.31

    this.gun.add(barrel, body, this.muzzleFlash)

    // Attach gun to right controller (or camera in desktop)
    const rightCtrl = this.ctx.renderer.xr.getController(1)
    if (rightCtrl) {
      rightCtrl.add(this.gun)
    } else {
      this.gun.position.set(0.25, -0.25, -0.5)
      this.ctx.camera.add(this.gun)
    }
  }

  private buildEnvironment() {
    // Shooting range walls (low-poly)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x112233, roughness: 0.9 })
    this.materials.push(wallMat)

    const wallData = [
      { pos: [0, 3, -15], rot: [0, 0, 0], size: [30, 6, 0.3] },
      { pos: [-15, 3, 0], rot: [0, Math.PI / 2, 0], size: [30, 6, 0.3] },
      { pos: [15, 3, 0], rot: [0, Math.PI / 2, 0], size: [30, 6, 0.3] },
    ]
    for (const w of wallData) {
      const geo = new THREE.BoxGeometry(...(w.size as [number, number, number]))
      const mesh = new THREE.Mesh(geo, wallMat)
      mesh.position.set(...(w.pos as [number, number, number]))
      mesh.rotation.y = w.rot[1]
      mesh.receiveShadow = true
      this.geometries.push(geo)
      this.addToScene(mesh)
    }

    // Target spawn zones indicator
    const indicatorGeo = new THREE.RingGeometry(0.4, 0.5, 12)
    const indicatorMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.3 })
    this.geometries.push(indicatorGeo)
    this.materials.push(indicatorMat)
    const indicator = new THREE.Mesh(indicatorGeo, indicatorMat)
    indicator.rotation.x = -Math.PI / 2
    indicator.position.y = 0.01
    this.addToScene(indicator)
  }

  private spawnTarget() {
    if (this.targets.length >= this.maxTargets) return

    const id = `target_${Date.now()}_${Math.random()}`
    const isMoving = Math.random() > 0.4
    const size = 0.15 + Math.random() * 0.25

    const geo = new THREE.SphereGeometry(size, 10, 8)
    const hue = Math.random()
    const color = new THREE.Color().setHSL(hue, 1, 0.5)
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 })
    this.geometries.push(geo)
    this.materials.push(mat)

    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow = true

    // Random position in front of player
    const angle = (Math.random() - 0.5) * Math.PI * 1.2
    const dist = 4 + Math.random() * 6
    mesh.position.set(
      Math.sin(angle) * dist,
      1 + Math.random() * 2.5,
      -dist * Math.cos(angle * 0.3) - 2
    )
    mesh.name = id

    const interactable = new Interactable(mesh, 'target', {
      onSelect: () => this.hitTarget(id),
      onHover: () => { mat.emissive.setHex(0x444400) },
      onUnhover: () => { mat.emissive.setHex(0x000000) },
    })
    this.ctx.interaction.register(id, interactable)

    const target: Target = {
      mesh, interactable, id,
      health: 1,
      moving: isMoving,
      speed: 1 + Math.random() * 2,
      direction: new THREE.Vector3(Math.random() - 0.5, 0, 0).normalize(),
      boundsMin: mesh.position.x - 3,
      boundsMax: mesh.position.x + 3,
      spawnTime: 0,
      lifetime: 5 + Math.random() * 5,
    }
    this.targets.push(target)
    this.addToScene(mesh)
  }

  private hitTarget(id: string) {
    const idx = this.targets.findIndex(t => t.id === id)
    if (idx === -1) return

    const target = this.targets[idx]
    const pos = target.mesh.position.clone()

    // Particle burst
    const color = (target.mesh.material as THREE.MeshStandardMaterial).color.getHex()
    const burst = this.spawnParticleBurst(pos, color, 16, 4, 0.6)
    this.particleUpdaters.push(burst)

    // Score
    const points = Math.round(100 / (target.mesh.geometry.boundingSphere?.radius ?? 0.2 + 0.15))
    useAppStore.getState().addScore(points)
    useAppStore.getState().incrementCombo()
    this.ctx.audio.play('hit')
    this.ctx.audio.play('score')

    // Remove
    this.ctx.scene.remove(target.mesh)
    this.ctx.interaction.unregister(id)
    this.targets.splice(idx, 1)
  }

  private shoot() {
    if (this.shotCooldown > 0) return

    this.ctx.audio.play('shoot')
    this.shotCooldown = this.shotCooldownMax
    this.flashTimer = 0.08

    // Raycast from right controller (or camera)
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

    // Check hit
    const raycaster = new THREE.Raycaster(origin, direction.normalize(), 0, 20)
    const targetMeshes = this.targets.map(t => t.mesh)
    const hits = raycaster.intersectObjects(targetMeshes)

    if (hits.length > 0) {
      const hitMesh = hits[0].object
      const target = this.targets.find(t => t.mesh === hitMesh)
      if (target) this.hitTarget(target.id)
    } else {
      useAppStore.getState().resetCombo()
      this.ctx.audio.play('miss')
    }
  }

  start() {
    super.start()
    this.elapsed = 0
    this.spawnTimer = 0
    // Immediate first spawn
    for (let i = 0; i < 3; i++) this.spawnTarget()
  }

  update(delta: number, elapsed: number, _frame?: XRFrame) {
    if (!this.isActive) return

    this.elapsed += delta
    this.shotCooldown = Math.max(0, this.shotCooldown - delta)
    this.spawnTimer += delta

    // Timer
    const remaining = Math.max(0, this.gameDuration - this.elapsed)
    useAppStore.getState().updateScore({ timer: Math.floor(remaining) })

    if (remaining <= 0) {
      this.isActive = false
      this.ctx.audio.play('gameover')
      return
    }

    // Shoot on trigger
    if (this.ctx.input.getButtonDown('trigger', 'right') ||
        (this.ctx.input.isKeyDown('Space') && !this.ctx.input.isVRActive())) {
      this.shoot()
    }

    // Muzzle flash
    if (this.muzzleFlash) {
      this.flashTimer -= delta
      const mat = this.muzzleFlash.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, this.flashTimer / 0.08)
    }

    // Spawn
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0
      this.spawnTarget()
      // Speed up over time
      this.spawnInterval = Math.max(0.8, 2.0 - this.elapsed * 0.02)
    }

    // Move targets + expire old ones
    const toRemove: string[] = []
    for (const t of this.targets) {
      t.spawnTime += delta
      if (t.spawnTime > t.lifetime) {
        toRemove.push(t.id)
        useAppStore.getState().resetCombo()
        continue
      }

      if (t.moving) {
        t.mesh.position.x += t.direction.x * t.speed * delta
        if (t.mesh.position.x > t.boundsMax || t.mesh.position.x < t.boundsMin) {
          t.direction.x *= -1
        }
        // Gentle bob
        t.mesh.position.y += Math.sin(elapsed * 2 + t.boundsMin) * 0.005
      }

      // Rotate targets
      t.mesh.rotation.y += delta * 1.5
    }

    for (const id of toRemove) {
      const idx = this.targets.findIndex(t => t.id === id)
      if (idx !== -1) {
        this.ctx.scene.remove(this.targets[idx].mesh)
        this.ctx.interaction.unregister(id)
        this.targets.splice(idx, 1)
      }
    }

    // Particle updates
    this.particleUpdaters = this.particleUpdaters.filter(fn => !fn(delta))

    // Desktop pointer select
    if (!this.ctx.input.isVRActive()) {
      const hovered = this.ctx.pointer.getHovered('desktop')
      if (this.ctx.input.getButtonDown('trigger', 'right') && hovered) {
        hovered.select()
      }
    }
  }

  reset() {
    for (const t of this.targets) {
      this.ctx.scene.remove(t.mesh)
      this.ctx.interaction.unregister(t.id)
    }
    this.targets = []
    this.elapsed = 0
    this.spawnTimer = 0
    this.shotCooldown = 0
    useAppStore.getState().resetScore()
    for (let i = 0; i < 3; i++) this.spawnTarget()
  }

  dispose() {
    for (const t of this.targets) {
      this.ctx.interaction.unregister(t.id)
    }
    this.targets = []

    if (this.gun) {
      const rightCtrl = this.ctx.renderer.xr.getController(1)
      rightCtrl?.remove(this.gun)
      this.ctx.camera.remove(this.gun)
    }

    super.dispose()
  }
}
