import * as THREE from 'three'
import { Lighting } from './Lighting'

export interface WorldConfig {
  skyColor?: number
  fogColor?: number
  fogNear?: number
  fogFar?: number
  enableFog?: boolean
  floorSize?: number
  floorColor?: number
  gridColor?: number
  enableGrid?: boolean
  theme?: 'default' | 'space' | 'arena' | 'neon'
}

export class World {
  readonly scene: THREE.Scene
  private lighting!: Lighting
  private floor: THREE.Mesh | null = null
  private skyMesh: THREE.Mesh | null = null
  private gridHelper: THREE.GridHelper | null = null
  private decorObjects: THREE.Object3D[] = []

  constructor(config: WorldConfig = {}) {
    this.scene = new THREE.Scene()
    this.apply(config)
  }

  apply(config: WorldConfig) {
    const theme = config.theme ?? 'default'
    this.applyThemeDefaults(theme, config)
  }

  private applyThemeDefaults(theme: string, cfg: WorldConfig) {
    const defaults: Record<string, WorldConfig> = {
      default: {
        skyColor: 0x050510,
        fogColor: 0x050510,
        fogNear: 20,
        fogFar: 80,
        enableFog: true,
        floorSize: 60,
        floorColor: 0x0a0a20,
        gridColor: 0x00f5ff,
        enableGrid: true,
      },
      space: {
        skyColor: 0x000005,
        fogColor: 0x000005,
        fogNear: 30,
        fogFar: 120,
        enableFog: true,
        floorSize: 80,
        floorColor: 0x05050f,
        enableGrid: false,
      },
      arena: {
        skyColor: 0x0a0005,
        fogColor: 0x0a0005,
        fogNear: 15,
        fogFar: 60,
        enableFog: true,
        floorSize: 40,
        floorColor: 0x120008,
        gridColor: 0xff006e,
        enableGrid: true,
      },
      neon: {
        skyColor: 0x020210,
        fogColor: 0x020210,
        fogNear: 20,
        fogFar: 70,
        enableFog: true,
        floorSize: 50,
        floorColor: 0x080815,
        gridColor: 0xb400ff,
        enableGrid: true,
      },
    }

    const d = { ...defaults[theme], ...cfg }

    // Background / sky
    this.scene.background = new THREE.Color(d.skyColor ?? 0x050510)

    // Fog
    if (d.enableFog) {
      this.scene.fog = new THREE.Fog(d.fogColor ?? 0x050510, d.fogNear ?? 20, d.fogFar ?? 80)
    }

    // Lighting
    if (this.lighting) this.lighting.dispose()
    this.lighting = new Lighting(this.scene, {
      ambientIntensity: theme === 'space' ? 0.15 : 0.25,
      enableShadows: true,
    })

    // Floor
    this.buildFloor(d.floorSize ?? 60, d.floorColor ?? 0x0a0a20)

    // Grid
    if (d.enableGrid) {
      this.buildGrid(d.floorSize ?? 60, d.gridColor ?? 0x00f5ff)
    }

    // Stars for space theme
    if (theme === 'space') this.buildStarField()
  }

  private buildFloor(size: number, color: number) {
    if (this.floor) {
      this.scene.remove(this.floor)
      this.floor.geometry.dispose()
      ;(this.floor.material as THREE.Material).dispose()
    }
    const geo = new THREE.PlaneGeometry(size, size)
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9,
      metalness: 0.1,
    })
    this.floor = new THREE.Mesh(geo, mat)
    this.floor.rotation.x = -Math.PI / 2
    this.floor.receiveShadow = true
    this.floor.name = 'floor'
    this.scene.add(this.floor)
  }

  private buildGrid(size: number, color: number) {
    if (this.gridHelper) this.scene.remove(this.gridHelper)
    this.gridHelper = new THREE.GridHelper(size, size / 2, color, color)
    ;(this.gridHelper.material as THREE.LineBasicMaterial).opacity = 0.15
    ;(this.gridHelper.material as THREE.LineBasicMaterial).transparent = true
    this.gridHelper.position.y = 0.01
    this.scene.add(this.gridHelper)
  }

  private buildStarField() {
    const count = 2000
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 80 + Math.random() * 40
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true })
    const stars = new THREE.Points(geo, mat)
    stars.name = 'starfield'
    this.scene.add(stars)
    this.decorObjects.push(stars)
  }

  addObject(obj: THREE.Object3D) {
    this.scene.add(obj)
  }

  removeObject(obj: THREE.Object3D) {
    this.scene.remove(obj)
  }

  getLighting() { return this.lighting }
  getFloor() { return this.floor }

  dispose() {
    this.lighting?.dispose()
    if (this.floor) {
      this.floor.geometry.dispose()
      ;(this.floor.material as THREE.Material).dispose()
      this.scene.remove(this.floor)
    }
    if (this.gridHelper) this.scene.remove(this.gridHelper)
    this.decorObjects.forEach(o => {
      this.scene.remove(o)
      if (o instanceof THREE.Points) {
        o.geometry.dispose()
        ;(o.material as THREE.Material).dispose()
      }
    })
    this.decorObjects = []
  }
}
