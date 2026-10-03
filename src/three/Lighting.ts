import * as THREE from 'three'

export interface LightingOptions {
  ambientIntensity?: number
  ambientColor?: number
  directionalIntensity?: number
  directionalColor?: number
  enableShadows?: boolean
  enableHemisphere?: boolean
}

export class Lighting {
  private scene: THREE.Scene
  private ambientLight!: THREE.AmbientLight
  private directionalLight!: THREE.DirectionalLight
  private hemisphereLight!: THREE.HemisphereLight
  private pointLights: THREE.PointLight[] = []

  constructor(scene: THREE.Scene, options: LightingOptions = {}) {
    this.scene = scene
    const {
      ambientIntensity = 0.3,
      ambientColor = 0x111122,
      directionalIntensity = 1.0,
      directionalColor = 0xffffff,
      enableShadows = true,
      enableHemisphere = true,
    } = options

    this.setupAmbient(ambientColor, ambientIntensity)
    this.setupDirectional(directionalColor, directionalIntensity, enableShadows)
    if (enableHemisphere) this.setupHemisphere()
  }

  private setupAmbient(color: number, intensity: number) {
    this.ambientLight = new THREE.AmbientLight(color, intensity)
    this.scene.add(this.ambientLight)
  }

  private setupDirectional(color: number, intensity: number, shadows: boolean) {
    this.directionalLight = new THREE.DirectionalLight(color, intensity)
    this.directionalLight.position.set(5, 10, 5)
    this.directionalLight.castShadow = shadows
    if (shadows) {
      this.directionalLight.shadow.mapSize.width = 1024
      this.directionalLight.shadow.mapSize.height = 1024
      this.directionalLight.shadow.camera.near = 0.1
      this.directionalLight.shadow.camera.far = 50
      this.directionalLight.shadow.camera.left = -20
      this.directionalLight.shadow.camera.right = 20
      this.directionalLight.shadow.camera.top = 20
      this.directionalLight.shadow.camera.bottom = -20
      this.directionalLight.shadow.bias = -0.001
    }
    this.scene.add(this.directionalLight)
  }

  private setupHemisphere() {
    this.hemisphereLight = new THREE.HemisphereLight(0x223366, 0x112211, 0.4)
    this.scene.add(this.hemisphereLight)
  }

  addPointLight(
    color: number,
    intensity: number,
    distance: number,
    position: THREE.Vector3
  ): THREE.PointLight {
    const light = new THREE.PointLight(color, intensity, distance)
    light.position.copy(position)
    this.scene.add(light)
    this.pointLights.push(light)
    return light
  }

  setAmbientIntensity(v: number) { this.ambientLight.intensity = v }
  setDirectionalIntensity(v: number) { this.directionalLight.intensity = v }

  dispose() {
    this.scene.remove(this.ambientLight)
    this.scene.remove(this.directionalLight)
    if (this.hemisphereLight) this.scene.remove(this.hemisphereLight)
    this.pointLights.forEach(l => this.scene.remove(l))
    this.pointLights = []
  }
}
