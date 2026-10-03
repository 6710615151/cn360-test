# Handson — สิ่งที่ต้องทำก่อน build ผ่าน

---

## Step 1 — ติดตั้ง Node.js (บังคับ ทำก่อนอย่างอื่น)

Node.js ไม่มีในเครื่อง → `node_modules` ไม่มี → build ไม่ได้เลย

1. ดาวน์โหลด Node.js **v18 LTS** จาก https://nodejs.org แล้วติดตั้ง
2. เปิด terminal ใหม่ในโฟลเดอร์โปรเจค:

```bash
cd "c:\Users\Natthida\OneDrive\Desktop\testmyVR\web-vr-test"
npm install
npm run dev
```

---

## Step 2 — แก้ `src/three/ThreeScene.ts` (VR ใช้ไม่ได้ถ้าไม่แก้)

Three.js ส่ง `XRFrame` เป็น argument ที่ 2 ของ `setAnimationLoop`
แต่ตอนนี้ code รับแค่ `(time)` ตัวเดียว → frame เป็น `undefined` ตลอด

### แก้จุดที่ 1 — บรรทัด 25

```ts
// เดิม
private onUpdateCallbacks: Array<(delta: number, elapsed: number) => void> = []

// แก้เป็น
private onUpdateCallbacks: Array<(delta: number, elapsed: number, frame?: XRFrame) => void> = []
```

### แก้จุดที่ 2 — บรรทัด 66

```ts
// เดิม
onUpdate(cb: (delta: number, elapsed: number) => void) {

// แก้เป็น
onUpdate(cb: (delta: number, elapsed: number, frame?: XRFrame) => void) {
```

### แก้จุดที่ 3 — บรรทัด 78

```ts
// เดิม
this.renderer.setAnimationLoop((time: number) => {

// แก้เป็น
this.renderer.setAnimationLoop((time: number, frame?: XRFrame) => {
```

### แก้จุดที่ 4 — บรรทัด 99

```ts
// เดิม
this.onUpdateCallbacks.forEach(cb => cb(delta, elapsed))

// แก้เป็น
this.onUpdateCallbacks.forEach(cb => cb(delta, elapsed, frame))
```

---

## Step 3 — แก้ `src/app/App.tsx` (VR ใช้ไม่ได้ถ้าไม่แก้)

`getFrame()` ไม่มีอยู่ใน Three.js WebXRManager → `frame` เป็น `undefined` เสมอ
→ headset pose / controller pose ไม่อัปเดตเลยในโหมด VR

### ลบบรรทัดนี้ออก (อยู่ใน onUpdate callback)

```ts
// ลบออก
const frame = renderer.xr.enabled
  ? (renderer.xr as unknown as { getFrame?: () => XRFrame }).getFrame?.()
  : undefined
```

### แก้ onUpdate signature ให้รับ frame จาก ThreeScene

```ts
// เดิม
const unsubUpdate = threeScene.onUpdate((delta, elapsed) => {

// แก้เป็น
const unsubUpdate = threeScene.onUpdate((delta, elapsed, frame) => {
```

frame ที่ได้มาจาก `setAnimationLoop` โดยตรงผ่าน ThreeScene แล้ว ใช้ได้เลย

---

## Step 4 — แก้ `src/games/target-shooter/TargetShooterGame.ts` (ไม่บล็อก build)

Operator precedence ผิด: `??` bind ต่ำกว่า `+`
ทำให้ `0.2 + 0.15` ถูกประมวลผลก่อน แล้วค่อย `??` เทียบ → fallback ผิด

```ts
// เดิม
const points = Math.round(100 / (target.mesh.geometry.boundingSphere?.radius ?? 0.2 + 0.15))

// แก้เป็น
const points = Math.round(100 / ((target.mesh.geometry.boundingSphere?.radius ?? 0.2) + 0.15))
```

---

## สรุป Priority

| # | ไฟล์ | งาน | ผลกระทบ |
|---|------|-----|---------|
| 1 | — | ติดตั้ง Node.js 18+ แล้วรัน `npm install` | build ไม่ผ่านเลย |
| 2 | `src/three/ThreeScene.ts` | รับ `frame` จาก `setAnimationLoop` (4 จุด) | VR ไม่ทำงาน |
| 3 | `src/app/App.tsx` | ลบ `getFrame()` + รับ `frame` จาก `onUpdate` | VR ไม่ทำงาน |
| 4 | `src/games/target-shooter/TargetShooterGame.ts` | แก้ operator precedence | score คำนวณผิดนิดหน่อย |

**ไฟล์อื่นทั้งหมดไม่มี error ที่ทำให้ build พัง**
