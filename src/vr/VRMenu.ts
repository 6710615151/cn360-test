import * as THREE from 'three'
import { InteractionSystem, Interactable } from '../three/Interaction'
import { headsetRuntime } from './HeadsetManager'

// ─── In-VR 3D menu ────────────────────────────────────────────────────────────
// HTML/React overlays are not visible inside an immersive-vr session, so while
// in VR the menus are rendered as world-space panels selectable by the laser.

export interface VRMenuButton {
  id: string
  label: string
  sublabel?: string
  color?: string
  onSelect: () => void
}

export interface VRMenuScreen {
  key: string   // changes when the screen content changes → triggers rebuild
  title: string
  buttons: VRMenuButton[]
}

const PANEL_WIDTH = 0.9
const BUTTON_W = 0.75
const BUTTON_H = 0.11
const BUTTON_GAP = 0.025
const TITLE_H = 0.12
const PX_PER_M = 800
const DISTANCE = 1.3

export class VRMenu {
  private scene: THREE.Scene
  private interaction: InteractionSystem
  private root = new THREE.Group()
  private currentKey: string | null = null
  private placedFromHeadset = false
  private registeredIds: string[] = []
  private disposables: Array<{ dispose(): void }> = []

  constructor(scene: THREE.Scene, interaction: InteractionSystem) {
    this.scene = scene
    this.interaction = interaction
    this.root.name = 'vr-menu'
    this.root.visible = false
    this.scene.add(this.root)
  }

  /** Show `screen` (or hide when null). Cheap to call every frame. */
  show(screen: VRMenuScreen | null) {
    if (!screen) {
      if (this.root.visible) this.hide()
      return
    }
    // Games call interaction.clear() on dispose, so re-register if our ids vanished
    const lostRegistration = this.registeredIds.some(id => !this.interaction.getAll().some(i => i.userData['vrMenuId'] === id))
    // Headset pose may not exist on the first XR frame — re-place once it does
    if (this.root.visible && !this.placedFromHeadset && headsetRuntime.connected) this.placeInFrontOfHead()
    if (screen.key === this.currentKey && this.root.visible && !lostRegistration) return

    const wasVisible = this.root.visible
    this.build(screen)
    if (!wasVisible) this.placeInFrontOfHead()
    this.root.visible = true
  }

  private hide() {
    this.root.visible = false
    this.clear()
    this.currentKey = null
  }

  private placeInFrontOfHead() {
    this.placedFromHeadset = headsetRuntime.connected
    if (!headsetRuntime.connected) {
      // XR origin, facing -Z
      this.root.position.set(0, 1.45, -DISTANCE)
      this.root.rotation.set(0, 0, 0)
      return
    }
    const pos = headsetRuntime.position
    const dir = headsetRuntime.direction.clone()
    dir.y = 0
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1)
    dir.normalize()
    const eyeY = pos.y > 0.5 ? pos.y : 1.6
    this.root.position.set(pos.x + dir.x * DISTANCE, eyeY - 0.15, pos.z + dir.z * DISTANCE)
    this.root.lookAt(pos.x, eyeY - 0.15, pos.z)
  }

  private build(screen: VRMenuScreen) {
    this.clear()
    this.currentKey = screen.key

    const n = screen.buttons.length
    const contentH = TITLE_H + n * BUTTON_H + (n - 1) * BUTTON_GAP
    const panelH = contentH + 0.12

    // Background panel
    const bgGeo = new THREE.PlaneGeometry(PANEL_WIDTH, panelH)
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x0a0a20, transparent: true, opacity: 0.85 })
    const bg = new THREE.Mesh(bgGeo, bgMat)
    bg.position.z = -0.005
    this.root.add(bg)
    this.disposables.push(bgGeo, bgMat)

    // Border
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(bgGeo),
      new THREE.LineBasicMaterial({ color: 0x00f5ff }),
    )
    edges.position.z = -0.004
    this.root.add(edges)
    this.disposables.push(edges.geometry, edges.material as THREE.Material)

    let y = panelH / 2 - 0.06

    // Title
    const title = this.makeLabel(screen.title, PANEL_WIDTH * 0.95, TITLE_H, {
      fg: '#00f5ff', bg: null, font: 'bold 64px sans-serif',
    })
    title.mesh.position.y = y - TITLE_H / 2
    this.root.add(title.mesh)
    y -= TITLE_H

    // Buttons
    for (const b of screen.buttons) {
      const accent = b.color ?? '#00f5ff'
      const draw = (hover: boolean) => ({
        fg: hover ? '#050508' : '#ffffff',
        bg: hover ? accent : '#16213e',
        border: accent,
        font: 'bold 44px sans-serif',
        sub: b.sublabel,
      })
      const label = this.makeLabel(b.label, BUTTON_W, BUTTON_H, draw(false))
      label.mesh.position.y = y - BUTTON_H / 2
      this.root.add(label.mesh)
      y -= BUTTON_H + BUTTON_GAP

      const interactable = new Interactable(label.mesh, 'button', {
        onHover: () => label.redraw(draw(true)),
        onUnhover: () => label.redraw(draw(false)),
        onSelect: () => b.onSelect(),
      })
      const id = `vr-menu:${b.id}`
      interactable.userData['vrMenuId'] = id
      this.interaction.register(id, interactable)
      this.registeredIds.push(id)
    }
  }

  private makeLabel(
    text: string,
    w: number,
    h: number,
    style: { fg: string; bg: string | null; border?: string; font: string; sub?: string },
  ) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * PX_PER_M)
    canvas.height = Math.round(h * PX_PER_M)
    const ctx = canvas.getContext('2d')!
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace

    const redraw = (s: typeof style) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (s.bg) {
        ctx.fillStyle = s.bg
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      if (s.border) {
        ctx.strokeStyle = s.border
        ctx.lineWidth = 6
        ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6)
      }
      ctx.fillStyle = s.fg
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = s.font
      const cy = s.sub ? canvas.height * 0.38 : canvas.height / 2
      ctx.fillText(text, canvas.width / 2, cy)
      if (s.sub) {
        ctx.font = '28px sans-serif'
        ctx.globalAlpha = 0.75
        const maxW = canvas.width - 40
        let sub = s.sub
        while (sub.length > 1 && ctx.measureText(sub).width > maxW) sub = sub.slice(0, -2) + '…'
        ctx.fillText(sub, canvas.width / 2, canvas.height * 0.76)
        ctx.globalAlpha = 1
      }
      tex.needsUpdate = true
    }
    redraw(style)

    const geo = new THREE.PlaneGeometry(w, h)
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    const mesh = new THREE.Mesh(geo, mat)
    this.disposables.push(geo, mat, tex)
    return { mesh, redraw }
  }

  private clear() {
    for (const id of this.registeredIds) this.interaction.unregister(id)
    this.registeredIds = []
    for (const d of this.disposables) d.dispose()
    this.disposables = []
    this.root.clear()
  }

  dispose() {
    this.clear()
    this.scene.remove(this.root)
  }
}
