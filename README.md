# VR GAME WORLD — Pico 4 WebXR Playground

A browser-based VR arcade platform that runs directly on Pico 4 using WebXR and Three.js.

Open the web app → Enter VR → See 3D world → Use Pico 4 controllers → Select a game → Play.  
Everything happens inside a single SPA with no page reloads.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

---

## Vercel Deployment

1. Push to a GitHub/GitLab repository
2. Import project in [Vercel](https://vercel.com)
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy — the `vercel.json` handles SPA routing and CORS headers automatically

The deployed URL will be `https://your-project.vercel.app` — HTTPS is required for WebXR.

---

## Pico 4 Setup (Step-by-Step)

1. Deploy the project to Vercel (HTTPS URL required)
2. Put on your Pico 4 headset
3. Open **Pico Browser** (or any WebXR-enabled browser on the device)
4. Navigate to `https://your-project.vercel.app`
5. You will see the **VR GAME WORLD** main menu
6. Tap **◉ Enter VR** with your controller
7. Grant VR permissions when the browser prompts
8. The 3D world will enter immersive mode
9. Use the **Controller Test Lab** to verify all inputs are working
10. Select a game from the menu and play!

> **Note:** WebXR support depends on the browser and firmware version on your Pico 4.  
> The Pico Browser supports WebXR. If you see "Immersive VR not supported", try updating  
> Pico OS or using an alternative browser that exposes the WebXR API.

---

## Games

| # | Game | Description | Difficulty |
|---|------|-------------|------------|
| 1 | 🎯 Target Shooter | Shoot moving targets with your VR gun. Build combos! | Easy |
| 2 | 🧱 Block Breaker | Smash blocks with your paddle controller. | Medium |
| 3 | 🚀 Space Arena | Defend against enemy ships in zero-gravity space. | Medium |
| 4 | ⚔️ Sword Arena | Fight waves of enemies with your VR sword. | Hard |
| 5 | 🏃 Obstacle Course | Race through moving platforms to the finish line. | Medium |

---

## Controller Mapping (Pico 4)

| Input | Action |
|-------|--------|
| Right Trigger | Shoot / Select / Swing |
| Right Grip | Grab weapon / Object |
| Left/Right Thumbstick | Move (thumbstick locomotion mode) |
| Left Primary (X) | Teleport aim (teleport mode) |
| Left Secondary (Y) | Secondary action |
| Right Primary (A) | Primary action |
| Right Secondary (B) | Secondary action |
| Thumbstick Click | Jump (Obstacle Course) |
| Head tracking | Camera / Aim direction |

---

## Desktop Controls (for Development)

| Input | Action |
|-------|--------|
| W A S D | Move |
| Mouse (click canvas first) | Look around |
| Left Click | Trigger / Shoot |
| Right Click | Grip |
| Space | Jump / Thumbstick click |
| F | Primary button (A/X) |
| G | Secondary button (B/Y) |
| Esc | Pause / Back to menu |
| 1–5 | Quick navigate to game selector |

Click the canvas to lock the mouse pointer. Press Esc to unlock.

---

## Architecture

```
src/
├── app/
│   ├── App.tsx            — SPA root, Three.js + VR orchestration
│   ├── store.ts           — Zustand global state
│   ├── router.ts          — SPA state machine transitions (no page reload)
│   ├── AudioManager.ts    — Web Audio API procedural sound synthesis
│   └── DesktopSimulation.ts — WASD + mouse desktop testing mode
│
├── vr/
│   ├── XRManager.ts       — WebXR session lifecycle
│   ├── HeadsetManager.ts  — Head pose tracking
│   ├── ControllerManager.ts — Pico 4 controller input
│   ├── InputManager.ts    — Abstracted input API for games
│   ├── PointerManager.ts  — Laser pointer + raycasting
│   ├── TeleportSystem.ts  — Parabolic arc teleport locomotion
│   ├── GrabSystem.ts      — Controller grab/drop system
│   └── XRDebugPanel.tsx   — Live debug overlay
│
├── three/
│   ├── ThreeScene.ts      — Renderer, animation loop, FPS tracking
│   ├── World.ts           — Scene themes (default/space/arena/neon)
│   ├── Camera.ts          — Camera management
│   ├── Lighting.ts        — Ambient + directional + hemisphere lights
│   ├── Physics.ts         — Simple sphere collision (pluggable)
│   └── Interaction.ts     — Interactable objects system
│
├── games/
│   ├── Game.ts            — BaseGame interface + helpers
│   ├── GameManager.ts     — Load/start/pause/reset/dispose lifecycle
│   ├── GameRegistry.ts    — Game factory registry
│   ├── target-shooter/    — VR Target Shooter
│   ├── block-breaker/     — Block Breaker
│   ├── space-arena/       — Space Arena
│   ├── sword-arena/       — VR Sword Arena
│   └── obstacle-course/   — VR Obstacle Course
│
└── components/
    ├── MainMenu.tsx        — Landing page
    ├── GameSelector.tsx    — Game selection grid
    ├── VRButton.tsx        — Enter/Exit VR button
    ├── HUD.tsx             — In-game score/pause overlay
    ├── ControllerTestLab.tsx — Real-time controller testing
    ├── XRDiagnostics.tsx   — WebXR capability diagnostics
    ├── PerformancePanel.tsx — FPS/draw call monitor
    ├── ControllerStatus.tsx — Status bar indicator
    └── SettingsPanel.tsx   — Volume, locomotion, graphics settings
```

---

## Adding a New Game

1. Create a new folder: `src/games/my-game/`
2. Create `MyGame.ts` extending `BaseGame`:

```typescript
import { BaseGame, GameContext, GameMeta } from '../Game'

export class MyGame extends BaseGame {
  readonly meta: GameMeta = {
    id: 'my-game',
    name: 'My Game',
    description: 'Description here.',
    thumbnail: '🎮',
    difficulty: 1,
    worldConfig: { theme: 'default' },
  }

  async load(ctx: GameContext) {
    await super.load(ctx)
    // Add objects to ctx.scene
  }

  update(delta: number, elapsed: number) {
    if (!this.isActive) return
    // Read input via this.ctx.input (never raw WebXR)
    // e.g. this.ctx.input.getButton('trigger', 'right')
  }

  reset() { /* restore initial state */ }
}
```

3. Register in `GameRegistry.ts`:

```typescript
import { MyGame } from './my-game/MyGame'
// Add to registry map:
['my-game', () => new MyGame()],
```

4. Add `'my-game'` to the `GameId` type in `store.ts`

No other files need to change.

---

## WebXR Requirements

- **HTTPS is mandatory** — WebXR will not work over HTTP in production
- Pico Browser on Pico 4 supports WebXR with `immersive-vr`
- Reference space: `local-floor` (falls back to `local` if unavailable)
- Optional features: `bounded-floor`, `hand-tracking`, `layers`

---

## Performance Targets

| Platform | Target FPS |
|----------|-----------|
| Pico 4 (standalone) | 72–90 fps |
| Desktop (dev) | 60+ fps |

The app uses:
- Low-poly procedural geometry (no external asset downloads)
- Object pooling for particles
- `dispose()` on all geometries/materials when switching games
- Instanced meshes where applicable
- Shadow map size capped at 1024×1024

---

## Troubleshooting

**"Immersive VR not supported"**  
→ Open in Pico Browser, not a standard mobile browser. Ensure Pico OS is up to date.

**Controllers not detected**  
→ Check XR Diagnostics page. Ensure VR session is active (tap Enter VR first).

**Low FPS on Pico 4**  
→ Disable shadows in Settings. Lower particle count. The device runs standalone at 72Hz.

**Pointer / laser not working**  
→ The laser only appears in an active VR session. In desktop mode, use mouse gaze (screen center).

**Build error: `tsc` fails**  
→ Run `npm install` to ensure all `@types/*` packages are present. Node.js 18+ required.
