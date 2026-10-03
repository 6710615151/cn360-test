// AudioManager — Web Audio API procedural sounds, no external files needed.
// All sounds are synthesized at runtime.

export type SoundId =
  | 'shoot' | 'hit' | 'miss' | 'explosion'
  | 'click' | 'hover' | 'select'
  | 'score' | 'combo' | 'levelup'
  | 'sword_swing' | 'sword_hit' | 'block_break'
  | 'laser' | 'powerup' | 'death'
  | 'jump' | 'land' | 'checkpoint'
  | 'countdown' | 'gameover' | 'victory'

export class AudioManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private enabled = true

  constructor() {
    // Lazy-init AudioContext on first user gesture
  }

  private ensureContext() {
    if (this.ctx) return
    try {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.sfxGain = this.ctx.createGain()
      this.musicGain = this.ctx.createGain()
      this.masterGain.gain.value = 0.8
      this.sfxGain.gain.value = 1.0
      this.musicGain.gain.value = 0.4
      this.sfxGain.connect(this.masterGain)
      this.musicGain.connect(this.masterGain)
      this.masterGain.connect(this.ctx.destination)
    } catch (e) {
      console.warn('[AudioManager] Web Audio not available:', e)
    }
  }

  resume() {
    this.ensureContext()
    if (this.ctx?.state === 'suspended') this.ctx.resume()
  }

  play(id: SoundId, volume = 1.0) {
    if (!this.enabled) return
    this.ensureContext()
    if (!this.ctx || !this.sfxGain) return
    if (this.ctx.state === 'suspended') this.ctx.resume()

    try {
      switch (id) {
        case 'shoot': this.synthShoot(volume); break
        case 'hit': this.synthHit(volume); break
        case 'miss': this.synthMiss(volume); break
        case 'explosion': this.synthExplosion(volume); break
        case 'click': this.synthClick(volume); break
        case 'hover': this.synthHover(volume); break
        case 'select': this.synthSelect(volume); break
        case 'score': this.synthScore(volume); break
        case 'combo': this.synthCombo(volume); break
        case 'levelup': this.synthLevelUp(volume); break
        case 'sword_swing': this.synthSwordSwing(volume); break
        case 'sword_hit': this.synthSwordHit(volume); break
        case 'block_break': this.synthBlockBreak(volume); break
        case 'laser': this.synthLaser(volume); break
        case 'powerup': this.synthPowerup(volume); break
        case 'death': this.synthDeath(volume); break
        case 'jump': this.synthJump(volume); break
        case 'land': this.synthLand(volume); break
        case 'checkpoint': this.synthCheckpoint(volume); break
        case 'countdown': this.synthCountdown(volume); break
        case 'gameover': this.synthGameOver(volume); break
        case 'victory': this.synthVictory(volume); break
      }
    } catch (e) {
      // Silently ignore audio errors — never crash game
    }
  }

  setMasterVolume(v: number) {
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v))
  }
  setSfxVolume(v: number) {
    if (this.sfxGain) this.sfxGain.gain.value = Math.max(0, Math.min(1, v))
  }
  setEnabled(v: boolean) { this.enabled = v }

  // ─── Synth helpers ─────────────────────────────────────────────────────────

  private makeOsc(type: OscillatorType, freq: number, duration: number, vol: number, detune = 0): void {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    osc.detune.value = detune
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(this.sfxGain!)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  }

  private makeNoise(duration: number, vol: number, freq: number, q: number): void {
    const ctx = this.ctx!
    const bufSize = ctx.sampleRate * duration
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = freq
    filter.Q.value = q
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxGain!)
    src.start()
    src.stop(ctx.currentTime + duration)
  }

  private synthShoot(v: number) {
    this.makeOsc('sawtooth', 880, 0.08, v * 0.5)
    this.makeOsc('square', 440, 0.12, v * 0.3, -200)
  }

  private synthHit(v: number) {
    this.makeNoise(0.1, v * 0.7, 800, 2)
    this.makeOsc('sine', 200, 0.1, v * 0.4)
  }

  private synthMiss(v: number) {
    this.makeOsc('sine', 300, 0.15, v * 0.3)
    this.makeOsc('sine', 250, 0.2, v * 0.2)
  }

  private synthExplosion(v: number) {
    this.makeNoise(0.5, v * 0.9, 200, 0.5)
    this.makeOsc('sine', 80, 0.4, v * 0.6)
  }

  private synthClick(v: number) {
    this.makeOsc('sine', 1200, 0.05, v * 0.4)
  }

  private synthHover(v: number) {
    this.makeOsc('sine', 800, 0.04, v * 0.2)
  }

  private synthSelect(v: number) {
    this.makeOsc('sine', 1000, 0.06, v * 0.3)
    this.makeOsc('sine', 1400, 0.08, v * 0.25)
  }

  private synthScore(v: number) {
    this.makeOsc('sine', 600, 0.05, v * 0.4)
    this.makeOsc('sine', 900, 0.08, v * 0.35)
  }

  private synthCombo(v: number) {
    [440, 550, 660, 880].forEach((f, i) => {
      setTimeout(() => this.makeOsc('sine', f, 0.08, v * 0.4), i * 50)
    })
  }

  private synthLevelUp(v: number) {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.makeOsc('sine', f, 0.15, v * 0.5), i * 80)
    })
  }

  private synthSwordSwing(v: number) {
    this.makeNoise(0.2, v * 0.5, 2000, 5)
    this.makeOsc('sawtooth', 300, 0.15, v * 0.3, 100)
  }

  private synthSwordHit(v: number) {
    this.makeNoise(0.15, v * 0.7, 1500, 3)
    this.makeOsc('square', 180, 0.12, v * 0.5)
  }

  private synthBlockBreak(v: number) {
    this.makeNoise(0.2, v * 0.8, 500, 1.5)
    this.makeOsc('sine', 220, 0.2, v * 0.4)
  }

  private synthLaser(v: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(1200, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3)
    gain.gain.setValueAtTime(v * 0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(this.sfxGain!)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  }

  private synthPowerup(v: number) {
    [330, 440, 550, 660, 880].forEach((f, i) => {
      setTimeout(() => this.makeOsc('sine', f, 0.12, v * 0.4), i * 60)
    })
  }

  private synthDeath(v: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(400, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.8)
    gain.gain.setValueAtTime(v * 0.6, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.connect(gain)
    gain.connect(this.sfxGain!)
    osc.start()
    osc.stop(ctx.currentTime + 0.8)
  }

  private synthJump(v: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(300, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(v * 0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.connect(gain)
    gain.connect(this.sfxGain!)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  }

  private synthLand(v: number) {
    this.makeNoise(0.08, v * 0.5, 300, 2)
  }

  private synthCheckpoint(v: number) {
    [784, 1047].forEach((f, i) => {
      setTimeout(() => this.makeOsc('sine', f, 0.15, v * 0.5), i * 100)
    })
  }

  private synthCountdown(v: number) {
    this.makeOsc('sine', 880, 0.1, v * 0.5)
  }

  private synthGameOver(v: number) {
    [400, 300, 200, 100].forEach((f, i) => {
      setTimeout(() => this.makeOsc('sawtooth', f, 0.3, v * 0.5), i * 150)
    })
  }

  private synthVictory(v: number) {
    const melody = [523, 659, 784, 1047, 784, 1047]
    melody.forEach((f, i) => {
      setTimeout(() => this.makeOsc('sine', f, 0.2, v * 0.5), i * 100)
    })
  }

  dispose() {
    this.ctx?.close()
    this.ctx = null
  }
}

// Singleton
export const audio = new AudioManager()
