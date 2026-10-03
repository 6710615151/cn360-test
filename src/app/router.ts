// SPA router — no page reloads, no window.location changes.
// All navigation is pure Zustand state transitions.
// This file documents the valid state machine transitions.

import { AppView } from './store'

export type Transition =
  | { from: AppView; to: AppView; trigger: string }

export const TRANSITIONS: Transition[] = [
  { from: 'main-menu',        to: 'game-selector',    trigger: 'Browse Games' },
  { from: 'main-menu',        to: 'controller-test',  trigger: 'Controller Test' },
  { from: 'main-menu',        to: 'xr-diagnostics',   trigger: 'XR Diagnostics' },
  { from: 'main-menu',        to: 'settings',         trigger: 'Settings' },
  { from: 'game-selector',    to: 'playing',          trigger: 'Select Game' },
  { from: 'game-selector',    to: 'main-menu',        trigger: 'Back' },
  { from: 'playing',          to: 'paused',           trigger: 'Pause' },
  { from: 'paused',           to: 'playing',          trigger: 'Resume' },
  { from: 'paused',           to: 'game-selector',    trigger: 'Exit Game' },
  { from: 'controller-test',  to: 'main-menu',        trigger: 'Back' },
  { from: 'xr-diagnostics',   to: 'main-menu',        trigger: 'Back' },
  { from: 'settings',         to: 'main-menu',        trigger: 'Back' },
]

// IMPORTANT: The SPA never calls:
//   window.location.reload()
//   window.location.href = ...
//   window.location.replace(...)
//
// All state is managed in Zustand. Three.js scene is never
// torn down when switching menus — only GameManager.dispose()
// is called when switching games.
