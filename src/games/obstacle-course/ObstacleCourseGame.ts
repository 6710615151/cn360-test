import * as THREE from 'three'
import { BaseGame, GameContext, GameMeta } from '../Game'
import { useAppStore } from '../../app/store'

interface Platform {
  mesh: THREE.Mesh
  id: string
  moving: boolean
  moveAxis: 'x' | 'z'
  moveMin: number
  moveMax: number
  moveSpeed: number
  isCheckpoint: boolean
  checkpointReached: boolean
  isFinish: boolean
}

export class ObstacleCourseGame extends BaseGame {
  readonly meta: GameMeta = {
    id: 'obstacle-course',
    name: 'Obstacle Course',
    description: 'Race through moving platforms. Reach the finish line as fast as you can!',
    thumbnail: '🏃',
    difficulty: 2,
    worldConfig: { theme: 'default' },
  }

  private platforms: Platform[] = []
  private playerVelocity = new THREE.Vector3()
  private playerOnGround = false
  private playerGroundY = 0
  private elapsed = 0
  private finished = false
  private bestTime = Infinity
  private checkpointsPassed = 0
  private totalCheckpoints = 0

  private readonly gravity = -12
  private readonly moveSpeed = 4.5
  private readonly jumpForce = 5.5

  // Hazard spinners
  private spinners: THREE.Mesh[] = []

  async load(ctx: GameContext): Promise<void> {
    await super.load(ctx)
    this.buildCourse()
  }

  private buildCourse() {
    // Starting platform
    this.addPlatform({
      pos: [0, 0, 0], size: [3, 0.2, 3],
      color: 0x2244aa, moving: false, isCheckpoint: false, isFinish: false,
    })

    // Course layout
    const segments = [
      { pos: [0, 0, -5], size: [2, 0.2, 3], moving: false },
      { pos: [3, 0.5, -7], size: [1.5, 0.2, 1.5], moving: true, axis: 'x' as const, min: 1, max: 5, speed: 1.5 },
      { pos: [6, 1, -9], size: [2, 0.2, 2], moving: false },
      { pos: [6, 1.5, -13], size: [1.8, 0.2, 1], moving: true, axis: 'z' as const, min: -14, max: -11, speed: 2 },
      { pos: [3, 2, -16], size: [1.5, 0.2, 1.5], moving: false },
      { pos: [0, 2.5, -19], size: [2, 0.2, 2], moving: true, axis: 'x' as const, min: -2, max: 2, speed: 2.5 },
      { pos: [0, 3, -23], size: [3, 0.2, 2], moving: false },
      { pos: [-3, 3.5, -26], size: [1.5, 0.2, 1.5], moving: true, axis: 'x' as const, min: -5, max: -1, speed: 2 },
      { pos: [-5, 4, -29], size: [2, 0.2, 2], moving: false },
      { pos: [-3, 4.5, -32], size: [1.5, 0.2, 3], moving: true, axis: 'z' as const, min: -33, max: -30, speed: 1.8 },
      { pos: [0, 5, -36], size: [4, 0.2, 4], moving: false },  // Checkpoint 1
      { pos: [0, 5.5, -40], size: [1.5, 0.2, 1.5], moving: true, axis: 'x' as const, min: -2, max: 2, speed: 3 },
      { pos: [3, 6, -43], size: [1.5, 0.2, 2], moving: false },
      { pos: [3, 6.5, -47], size: [2, 0.2, 1.5], moving: true, axis: 'z' as const, min: -48, max: -45, speed: 2.5 },
      { pos: [0, 7, -51], size: [5, 0.2, 5], moving: false },  // FINISH
    ]

    let checkpointIdx = 0
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i]
      const isCheckpoint = i === 10
      const isFinish = i === segments.length - 1
      if (isCheckpoint) checkpointIdx++

      const p = this.addPlatform({
        pos: s.pos as [number, number, number],
        size: s.size as [number, number, number],
        color: isFinish ? 0x39ff14 : isCheckpoint ? 0xffaa00 : 0x1a3a6a,
        moving: s.moving,
        axis: (s as { axis?: 'x' | 'z' }).axis,
        min: (s as { min?: number }).min,
        max: (s as { max?: number }).max,
        speed: (s as { speed?: number }).speed,
        isCheckpoint,
        isFinish,
      })
      if (isCheckpoint || isFinish) this.totalCheckpoints++
    }

    // Add hazard spinners
    const spinnerPositions = [
      [0, 1.3, -19], [6, 2.3, -9], [-3, 4.8, -26],
    ]
    for (const pos of spinnerPositions) {
      this.addSpinner(pos as [number, number, number])
    }

    // Falling death zone visual
    const voidGeo = new THREE.PlaneGeometry(80, 80)
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x000011, transparent: true, opacity: 0.6 })
    const voidPlane = new THREE.Mesh(voidGeo, voidMat)
    voidPlane.rotation.x = -Math.PI / 2
    voidPlane.position.y = -5
    this.geometries.push(voidGeo)
    this.materials.push(voidMat)
    this.addToScene(voidPlane)

    // Finish gate
    this.buildFinishGate()
  }

  private addPlatform(opts: {
    pos: [number, number, number]
    size: [number, number, number]
    color: number
    moving: boolean
    axis?: 'x' | 'z'
    min?: number
    max?: number
    speed?: number
    isCheckpoint?: boolean
    isFinish?: boolean
  }): Platform {
    const geo = new THREE.BoxGeometry(...opts.size)
    const mat = new THREE.MeshStandardMaterial({
      color: opts.color, roughness: 0.5, metalness: 0.3,
      emissive: opts.isFinish ? 0x1a5500 : opts.isCheckpoint ? 0x553300 : 0x000000,
      emissiveIntensity: 0.3,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(...opts.pos)
    mesh.receiveShadow = true
    mesh.castShadow = true
    this.geometries.push(geo)
    this.materials.push(mat)
    this.addToScene(mesh)

    const platform: Platform = {
      mesh,
      id: `plat_${Math.random()}`,
      moving: opts.moving,
      moveAxis: opts.axis ?? 'x',
      moveMin: opts.min ?? opts.pos[0] - 2,
      moveMax: opts.max ?? opts.pos[0] + 2,
      moveSpeed: opts.speed ?? 1,
      isCheckpoint: opts.isCheckpoint ?? false,
      checkpointReached: false,
      isFinish: opts.isFinish ?? false,
    }
    this.platforms.push(platform)
    return platform
  }

  private addSpinner(pos: [number, number, number]) {
    const geo = new THREE.BoxGeometry(3, 0.08, 0.2)
    const mat = new THREE.MeshStandardMaterial({ color: 0xff2200, roughness: 0.3, metalness: 0.6, emissive: 0x440000 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(...pos)
    mesh.castShadow = true
    this.geometries.push(geo)
    this.materials.push(mat)
    this.addToScene(mesh)
    this.spinners.push(mesh)
  }

  private buildFinishGate() {
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 6)
    const postMat = new THREE.MeshStandardMaterial({ color: 0x39ff14, emissive: 0x1a6600, emissiveIntensity: 0.5 })
    this.materials.push(postMat)

    const leftPost = new THREE.Mesh(postGeo, postMat)
    leftPost.position.set(-2.5, 6.5, -51)
    const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), postMat)
    rightPost.position.set(2.5, 6.5, -51)
    this.geometries.push(postGeo)

    const topGeo = new THREE.BoxGeometry(5.2, 0.15, 0.15)
    const top = new THREE.Mesh(topGeo, postMat)
    top.position.set(0, 8, -51)
    this.geometries.push(topGeo)

    this.addToScene(leftPost)
    this.addToScene(rightPost)
    this.addToScene(top)
  }

  start() {
    super.start()
    this.elapsed = 0
    this.finished = false
    this.checkpointsPassed = 0
    this.playerVelocity.set(0, 0, 0)
    this.ctx.camera.position.set(0, 1.6, 1)
    useAppStore.getState().updateScore({ lives: 3, timer: 0 })
  }

  update(delta: number, elapsed: number, _frame?: XRFrame) {
    if (!this.isActive || this.finished) return

    this.elapsed += delta
    useAppStore.getState().updateScore({ timer: Math.floor(this.elapsed) })

    // Move platforms
    for (const platform of this.platforms) {
      if (!platform.moving) continue
      const axis = platform.moveAxis
      const cur = platform.mesh.position[axis]
      const newVal = cur + platform.moveSpeed * delta
      platform.mesh.position[axis] = (newVal > platform.moveMax || newVal < platform.moveMin)
        ? cur - platform.moveSpeed * delta
        : newVal
      if (newVal > platform.moveMax || newVal < platform.moveMin) platform.moveSpeed *= -1
    }

    // Rotate spinners
    for (const spinner of this.spinners) {
      spinner.rotation.y += delta * 2.5
    }

    // Player movement
    const moveX = this.ctx.input.getAxis('leftX')
    const moveZ = this.ctx.input.getAxis('leftY')
    const jumping = this.ctx.input.getButtonDown('thumbstick', 'left') ||
      this.ctx.input.isKeyDown('Space')

    const camDir = new THREE.Vector3()
    this.ctx.camera.getWorldDirection(camDir)
    camDir.y = 0
    camDir.normalize()
    const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0))

    const moveDir = new THREE.Vector3()
    moveDir.addScaledVector(camRight, moveX)
    moveDir.addScaledVector(camDir, -moveZ)

    if (moveDir.length() > 0) {
      moveDir.normalize().multiplyScalar(this.moveSpeed)
      this.playerVelocity.x = moveDir.x
      this.playerVelocity.z = moveDir.z
    } else {
      this.playerVelocity.x *= 0.85
      this.playerVelocity.z *= 0.85
    }

    // Jump
    if (jumping && this.playerOnGround) {
      this.playerVelocity.y = this.jumpForce
      this.playerOnGround = false
      this.ctx.audio.play('jump')
    }

    // Gravity
    this.playerVelocity.y += this.gravity * delta

    // Apply movement
    this.ctx.camera.position.addScaledVector(this.playerVelocity, delta)

    // Platform collision
    this.playerOnGround = false
    const feet = this.ctx.camera.position.clone()
    feet.y -= 1.6

    for (const platform of this.platforms) {
      const pb = new THREE.Box3().setFromObject(platform.mesh)
      const pMin = pb.min, pMax = pb.max

      const playerBox = new THREE.Box3(
        new THREE.Vector3(feet.x - 0.2, feet.y - 0.05, feet.z - 0.2),
        new THREE.Vector3(feet.x + 0.2, this.ctx.camera.position.y, feet.z + 0.2)
      )

      if (playerBox.intersectsBox(pb)) {
        // Land on top
        if (this.playerVelocity.y <= 0 && feet.y >= pMax.y - 0.3) {
          this.ctx.camera.position.y = pMax.y + 1.6
          this.playerVelocity.y = 0
          this.playerOnGround = true
          this.playerGroundY = pMax.y

          // Moving platform rides
          if (platform.moving && platform.moveAxis === 'x') {
            this.ctx.camera.position.x += platform.moveSpeed * delta * 0.5
          } else if (platform.moving && platform.moveAxis === 'z') {
            this.ctx.camera.position.z += platform.moveSpeed * delta * 0.5
          }

          if (platform.isCheckpoint && !platform.checkpointReached) {
            platform.checkpointReached = true
            this.checkpointsPassed++
            this.ctx.audio.play('checkpoint')
            useAppStore.getState().addScore(200)
          }
          if (platform.isFinish) {
            this.onFinish()
          }
        }
        // Head bump
        else if (this.ctx.camera.position.y < pMin.y + 0.5 && this.playerVelocity.y > 0) {
          this.playerVelocity.y = -0.5
          this.ctx.camera.position.y = pMin.y - 0.3
        }
      }
    }

    // Spinner collision — push player
    for (const spinner of this.spinners) {
      const dist = new THREE.Vector2(
        this.ctx.camera.position.x - spinner.position.x,
        this.ctx.camera.position.z - spinner.position.z
      ).length()
      if (dist < 1.8 && Math.abs(this.ctx.camera.position.y - spinner.position.y) < 1) {
        const lives = useAppStore.getState().gameScore.lives - 1
        useAppStore.getState().updateScore({ lives })
        this.ctx.audio.play('death')
        if (lives <= 0) { this.isActive = false; this.ctx.audio.play('gameover'); return }
        // Respawn at last checkpoint
        this.ctx.camera.position.set(0, 1.6, 1)
        this.playerVelocity.set(0, 0, 0)
      }
    }

    // Fall death
    if (this.ctx.camera.position.y < -4) {
      const lives = useAppStore.getState().gameScore.lives - 1
      useAppStore.getState().updateScore({ lives })
      this.ctx.audio.play('death')
      if (lives <= 0) { this.isActive = false; this.ctx.audio.play('gameover'); return }
      this.ctx.camera.position.set(0, 1.6, 1)
      this.playerVelocity.set(0, 0, 0)
    }
  }

  private onFinish() {
    this.finished = true
    this.isActive = false
    const timeScore = Math.max(0, 5000 - this.elapsed * 10)
    useAppStore.getState().addScore(Math.floor(timeScore))
    if (this.elapsed < this.bestTime) this.bestTime = this.elapsed
    this.ctx.audio.play('victory')
  }

  reset() {
    this.elapsed = 0
    this.finished = false
    this.checkpointsPassed = 0
    this.playerVelocity.set(0, 0, 0)
    this.ctx.camera.position.set(0, 1.6, 1)
    for (const p of this.platforms) p.checkpointReached = false
    useAppStore.getState().resetScore()
    useAppStore.getState().updateScore({ lives: 3, timer: 0 })
  }

  dispose() {
    this.spinners = []
    this.platforms = []
    super.dispose()
  }
}
