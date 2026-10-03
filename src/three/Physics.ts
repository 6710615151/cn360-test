import * as THREE from 'three'

// Simple AABB collision — pluggable physics architecture.
// Swap out for Rapier/Cannon by replacing PhysicsBody implementation.

export interface PhysicsBody {
  id: string
  mesh: THREE.Object3D
  velocity: THREE.Vector3
  isStatic: boolean
  radius: number  // sphere collider radius
  onCollide?: (other: PhysicsBody) => void
  userData: Record<string, unknown>
}

export class SimplePhysics {
  private bodies: Map<string, PhysicsBody> = new Map()
  private gravity = new THREE.Vector3(0, -9.81, 0)
  private tmpA = new THREE.Vector3()
  private tmpB = new THREE.Vector3()

  setGravity(y: number) { this.gravity.y = y }

  addBody(body: PhysicsBody) {
    this.bodies.set(body.id, body)
  }

  removeBody(id: string) {
    this.bodies.delete(id)
  }

  getBody(id: string): PhysicsBody | undefined {
    return this.bodies.get(id)
  }

  update(delta: number) {
    const arr = Array.from(this.bodies.values())

    // Apply gravity & integrate
    for (const body of arr) {
      if (body.isStatic) continue
      body.velocity.addScaledVector(this.gravity, delta)
      body.mesh.position.addScaledVector(body.velocity, delta)

      // Simple floor constraint (y=0)
      if (body.mesh.position.y - body.radius < 0) {
        body.mesh.position.y = body.radius
        body.velocity.y = Math.abs(body.velocity.y) * 0.4 // bounce
        if (Math.abs(body.velocity.y) < 0.1) body.velocity.y = 0
      }
    }

    // Sphere-sphere collision detection
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j]
        this.tmpA.copy(a.mesh.position)
        this.tmpB.copy(b.mesh.position)
        const dist = this.tmpA.distanceTo(this.tmpB)
        const minDist = a.radius + b.radius
        if (dist < minDist && dist > 0) {
          a.onCollide?.(b)
          b.onCollide?.(a)
          // Push apart
          const dir = this.tmpA.sub(this.tmpB).normalize()
          const overlap = minDist - dist
          if (!a.isStatic) a.mesh.position.addScaledVector(dir, overlap * 0.5)
          if (!b.isStatic) b.mesh.position.addScaledVector(dir, -overlap * 0.5)
          // Reflect velocities
          if (!a.isStatic) a.velocity.reflect(dir).multiplyScalar(0.6)
          if (!b.isStatic) b.velocity.reflect(dir.negate()).multiplyScalar(0.6)
        }
      }
    }
  }

  clear() { this.bodies.clear() }
}
