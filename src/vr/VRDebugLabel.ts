import * as THREE from 'three'

// Small text panel for reading runtime state from inside the headset,
// where the HTML debug panels are not visible.
export class VRDebugLabel {
  readonly mesh: THREE.Mesh
  private canvas = document.createElement('canvas')
  private ctx: CanvasRenderingContext2D
  private texture: THREE.CanvasTexture
  private lastText = ''

  constructor() {
    this.canvas.width = 512
    this.canvas.height = 256
    this.ctx = this.canvas.getContext('2d')!
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.12),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false }),
    )
    this.mesh.renderOrder = 999
    // Above the controller, tilted toward the face
    this.mesh.position.set(0, 0.09, -0.05)
    this.mesh.rotation.x = -Math.PI / 5
  }

  setLines(lines: string[]) {
    const text = lines.join('\n')
    if (text === this.lastText) return
    this.lastText = text
    const { ctx, canvas } = this
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'rgba(5,5,16,0.85)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#39ff14'
    ctx.font = '22px monospace'
    ctx.textBaseline = 'top'
    lines.forEach((line, i) => ctx.fillText(line, 10, 10 + i * 28, canvas.width - 20))
    this.texture.needsUpdate = true
  }

  dispose() {
    this.mesh.removeFromParent()
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
    this.texture.dispose()
  }
}
