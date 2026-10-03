import * as THREE from 'three'
import { InputManager } from '../vr/InputManager'
import { PointerManager } from '../vr/PointerManager'
import { InteractionSystem } from '../three/Interaction'
import { SimplePhysics } from '../three/Physics'
import { AudioManager } from '../app/AudioManager'
import { WorldConfig } from '../three/World'

// ─── Core Game Interface ──────────────────────────────────────────────────────

export interface GameContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  input: InputManager
  pointer: PointerManager
  interaction: InteractionSystem
  physics: SimplePhysics
  audio: AudioManager
  renderer: THREE.WebGLRenderer
}

export interface GameMeta {
  id: string
  name: string
  description: string
  thumbnail: string        // emoji or color hex used in UI
  difficulty: 1 | 2 | 3
  worldConfig: WorldConfig
}

export interface Game {
  readonly meta: GameMeta

  /** One-time setup — add objects to scene */
  load(ctx: GameContext): Promise<void>

  /** Called when player actually starts (after load) */
  start(): void

  /** Called every frame — delta in seconds */
  update(delta: number, elapsed: number, frame?: XRFrame): void

  /** Suspend game logic (keep scene visible) */
  pause(): void

  /** Resume from pause */
  resume(): void

  /** Reset to initial state without full dispose/reload */
  reset(): void

  /** Full cleanup — remove all objects, dispose all resources */
  dispose(): void
}

// ─── Base class with shared helpers ──────────────────────────────────────────

export abstract class BaseGame implements Game {
  abstract readonly meta: GameMeta

  protected ctx!: GameContext
  protected objects: THREE.Object3D[] = []
  protected geometries: THREE.BufferGeometry[] = []
  protected materials: THREE.Material[] = []
  protected isActive = false

  async load(ctx: GameContext): Promise<void> {
    this.ctx = ctx
  }

  start() { this.isActive = true }
  pause() { this.isActive = false }
  resume() { this.isActive = true }

  abstract update(delta: number, elapsed: number, frame?: XRFrame): void
  abstract reset(): void

  // ─── Object pool helpers ─────────────────────────────────────────────────

  protected addToScene(obj: THREE.Object3D) {
    this.ctx.scene.add(obj)
    this.objects.push(obj)
    return obj
  }

  protected makeMesh(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    castShadow = true,
    receiveShadow = false
  ): THREE.Mesh {
    this.geometries.push(geo)
    this.materials.push(mat)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow = castShadow
    mesh.receiveShadow = receiveShadow
    return mesh
  }

  protected makeInstancedMesh(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    count: number
  ): THREE.InstancedMesh {
    this.geometries.push(geo)
    this.materials.push(mat)
    return new THREE.InstancedMesh(geo, mat, count)
  }

  // ─── Particle burst helper ───────────────────────────────────────────────

  protected spawnParticleBurst(
    position: THREE.Vector3,
    color: number,
    count = 12,
    speed = 3,
    lifetime = 0.5
  ) {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const velocities: THREE.Vector3[] = []

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x
      positions[i * 3 + 1] = position.y
      positions[i * 3 + 2] = position.z
      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * speed,
          Math.random() * speed,
          (Math.random() - 0.5) * speed
        )
      )
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({ color, size: 0.06, sizeAttenuation: true })
    const points = new THREE.Points(geo, mat)
    this.ctx.scene.add(points)

    let age = 0
    const update = (delta: number) => {
      age += delta
      const pos = geo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < count; i++) {
        pos.setXYZ(
          i,
          pos.getX(i) + velocities[i].x * delta,
          pos.getY(i) + velocities[i].y * delta - 4.9 * delta * age,
          pos.getZ(i) + velocities[i].z * delta
        )
      }
      pos.needsUpdate = true
      mat.opacity = 1 - age / lifetime
      if (age >= lifetime) {
        this.ctx.scene.remove(points)
        geo.dispose()
        mat.dispose()
        return true // done
      }
      return false
    }

    return update
  }

  dispose() {
    this.isActive = false
    this.ctx.interaction.clear()
    this.ctx.physics.clear()

    // Remove all tracked objects
    for (const obj of this.objects) {
      this.ctx.scene.remove(obj)
    }
    // Dispose geometries and materials
    for (const g of this.geometries) g.dispose()
    for (const m of this.materials) m.dispose()

    this.objects = []
    this.geometries = []
    this.materials = []
  }
}
