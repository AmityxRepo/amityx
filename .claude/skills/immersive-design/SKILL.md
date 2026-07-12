---
name: immersive-design
description: The immersive/3D/motion layer on top of web and mobile UI — 3D scenes (R3F, Spline), scroll-telling, glassmorphism/aurora/bento aesthetics, WebGL shaders, and native motion (Reanimated, Skia, Rive). Use when a task calls for 3D, parallax, an animated hero, a "wow" landing page, or rich micro-interaction — layered on top of web-development / mobile-development, not instead of them.
---

# Immersive & 3D Design

The layer that makes an app feel alive. Sits on Forge's stack: Web = Next.js/Vite + React
+ TS + Tailwind + shadcn/ui on Vercel; Mobile = Expo/React Native. Prefer **MIT
copy-paste code you own** over runtime deps; keep heavy WebGL **off the critical path**.

> **Free only (`framework/COST_POLICY.md`).** Every immersive effect here is achievable with
> free, MIT-licensed tools. Do **not** buy or depend on any paid/"Pro"/unlicensed library
> (Skiper UI, Animmaster, Vengeance UI, Spline Pro, Aceternity Pro, or any Pro tier). If you
> think an effect needs a paid source, it doesn't — use the free alternative below, or ask
> the user before spending anything.

## Decision tree (pick the lightest thing that hits the brief)
1. **Micro-interaction / reveal / hover / stagger** (95% of "make it pop") → **Motion**
   (`motion/react`) + a **copy-paste** component from Magic UI / Aceternity. No 3D, no
   canvas. Cheapest, safest.
2. **Scroll-telling / pinned sections / parallax** → **GSAP + ScrollTrigger** (now free)
   + **Lenis** smooth scroll. Reach for this before any 3D.
3. **A designed 3D scene / product model / hero** made by a designer → embed a **Spline**
   scene (`@splinetool/react-spline`). No Three.js code to maintain.
4. **Programmatic / data-driven / interactive 3D** (custom geometry, shaders, physics,
   thousands of instances) → **React Three Fiber** + drei + postprocessing.
5. **Aesthetic-only background** (aurora, gradient mesh, grain, spotlight) → CSS/SVG or a
   single fragment shader — not a full 3D scene.
6. **Mobile (RN)** → **Reanimated** for motion/gesture, **Skia** for custom drawing,
   **Rive/Lottie** for designed animation, **expo-gl + expo-three** only if you truly
   need 3D on device.

> Rule of thumb: R3F for *generative/interactive* 3D you code; Spline for *designed* 3D a
> tool produced. Don't hand-code in Three.js what a Spline embed does in one `<Spline/>`.

## Curated libraries & licenses
| Tool | Use for | Install | License | Notes |
|---|---|---|---|---|
| **Motion** (ex-Framer Motion) | React animation, scroll/gesture | `npm i motion` → `motion/react` | MIT | Default web animation engine |
| **GSAP + ScrollTrigger** | Scroll-telling, timelines, SplitText | `npm i gsap` | **Free incl. all plugins** (Webflow, 2025) | Was paid-Club; now free for commercial use |
| **Lenis** | Smooth/inertia scroll | `npm i lenis` | MIT | Pairs with ScrollTrigger |
| **three** | WebGL engine | `npm i three` | MIT | Base for R3F |
| **@react-three/fiber** | React renderer for Three | `npm i @react-three/fiber` | MIT | Declarative 3D |
| **@react-three/drei** | R3F helpers (controls, loaders, env) | `npm i @react-three/drei` | MIT | Don't reinvent these |
| **@react-three/postprocessing** | Bloom, DOF, glitch, vignette | `npm i @react-three/postprocessing` | MIT | Bloom = the "glow" |
| **@splinetool/react-spline** | Embed designed 3D scenes | `npm i @splinetool/react-spline @splinetool/runtime` | MIT (runtime) | Editor is freemium — use the **free** export; if its limits pinch, build the scene in **R3F (fully free)** instead of paying for Pro |
| **Magic UI** | Marquees, bento, beams, particles, kinetic text | `npx shadcn add "https://magicui.design/r/<name>"` | **MIT copy-paste** | You own the code — safest |
| **Aceternity UI** | 3D cards, spotlight, aurora, glare | copy-paste / shadcn registry | Free **MIT**; Pro templates paid | Free components are MIT |
| **motion-primitives**, **cult-ui** | Docks, spotlight cards, glass, scroll fx | copy-paste / shadcn | MIT (Pro tiers exist) | Own the code |
| **Reanimated** (3/4) | RN native-thread animation + gesture | `npx expo install react-native-reanimated` | MIT | Mobile default |
| **react-native-gesture-handler** | Native gestures for Reanimated | `npx expo install react-native-gesture-handler` | MIT | Pair with Reanimated |
| **@shopify/react-native-skia** | Custom drawing, shaders, effects on device | `npx expo install @shopify/react-native-skia` | MIT | Mobile "canvas" |
| **rive-react-native** | Interactive state-machine vector animation | `npx expo install rive-react-native` | MIT (editor freemium) | Interactive mascots/loaders |
| **lottie-react-native** | Play After Effects/JSON animation | `npx expo install lottie-react-native` | MIT | Non-interactive designed motion |
| **expo-gl + expo-three** | Three.js on device | `npx expo install expo-gl` + `npm i expo-three three` | MIT | Only if you truly need on-device 3D — costly |

### Reference sites the user flagged — verdict (default to MIT copy-paste instead)
- **Magic UI / Aceternity / motion-primitives / cult-ui** → depend freely; MIT copy-paste,
  you own the source.
- **Vengeance UI** (vengenceui.com) → copy-paste shadcn-style on GSAP/Framer Motion, but
  its repo has **no LICENSE file** → effectively unlicensed. Use as *inspiration only*;
  re-implement rather than shipping its code.
- **Skiper UI** (skiper-ui.com) → shadcn-CLI components on Motion; **freemium/proprietary**
  (paid Premium/Exclusive tiers, free-tier license unstated). Use free parts with caution;
  do not treat as MIT.
- **Animmaster Lib** (animmasterlib.dev) → **paid** zip download, only ~40% React/Next, no
  MIT. Buy for reference only; not a drop-in React dep.
> The user does not want to pay: treat every paid/pro/unlicensed source as off-limits and
> use the free MIT alternative. Only if the user explicitly approves a paid option does it
> get used — logged in DECISIONS.md.

## Minimal recipes

**R3F scene, lazy + off the critical path (Next.js):**
```tsx
// Scene.tsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
export default function Scene() {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 5] }}>
      <mesh><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial /></mesh>
      <Environment preset="city" /><OrbitControls enablePan={false} />
    </Canvas>
  );
}
```
```tsx
// page.tsx — keep WebGL out of the shared bundle and below the fold
import dynamic from "next/dynamic";
const Scene = dynamic(() => import("./Scene"), { ssr: false, loading: () => <div className="h-[60vh]" /> });
// render <Scene/> below the fold; never block LCP on the canvas
```

**Motion scroll reveal (respects reduced motion):**
```tsx
import { motion, useReducedMotion } from "motion/react";
export function Reveal({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >{children}</motion.div>
  );
}
```

**Lenis smooth scroll (opt out under reduced motion; sync ScrollTrigger to it):**
```tsx
import { useEffect } from "react";
import Lenis from "lenis";
export function useLenis() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis();
    const raf = (t: number) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);
}
```

**Postprocessing bloom (the "glow"):**
```tsx
import { EffectComposer, Bloom } from "@react-three/postprocessing";
// inside <Canvas>: <EffectComposer><Bloom intensity={0.6} mipmapBlur /></EffectComposer>
```

**RN Reanimated + Skia (native-thread animated blob):**
```tsx
import { Canvas, Circle } from "@shopify/react-native-skia";
import { useSharedValue, withRepeat, withTiming, useDerivedValue } from "react-native-reanimated";
export function Pulse() {
  const t = useSharedValue(0);
  t.value = withRepeat(withTiming(1, { duration: 1500 }), -1, true);
  const r = useDerivedValue(() => 40 + t.value * 20);
  return <Canvas style={{ flex: 1 }}><Circle cx={100} cy={100} r={r} color="#7c3aed" /></Canvas>;
}
```

## Aesthetic playbook (the "immersive/3D" look)
- **Glassmorphism** — `backdrop-blur-xl bg-white/5 border border-white/10`; sparingly;
  keep text contrast.
- **Aurora / gradient mesh** — animated conic/radial gradients or one fragment shader as a
  fixed background layer.
- **Bento grids** — asymmetric CSS grid of cards; each card gets one subtle motion trick,
  not five.
- **Parallax & scroll-telling** — Lenis + ScrollTrigger; pin a section, drive
  opacity/transform by scroll progress.
- **3D tilt / hover** — Motion `useSpring` on pointer position, or an Aceternity 3D-card.
- **Spotlight / cursor effects** — radial gradient following pointer via CSS vars; disable
  on touch.
- **Marquees, animated gradients, depth/layering, noise/grain** — Magic UI marquee; grain
  as a tiling PNG/SVG overlay at low opacity.
- Restraint wins: **one hero moment per view.** Depth comes from layering + shadow + blur,
  not from stacking effects.

## Guardrails checklist (before write-back — non-negotiable)
- [ ] **`prefers-reduced-motion` honored** everywhere (accessibility + legal): gate
      autoplay/parallax/3D idle motion; still fallback. `useReducedMotion()` (web) /
      `AccessibilityInfo.isReduceMotionEnabled()` (RN).
- [ ] **3D/WebGL off the critical path**: `dynamic(..., { ssr: false })`, below the fold,
      `<Suspense>` fallback. **The LCP element is never the canvas.**
- [ ] **Performance budget**: LCP < 2.5s, INP < 200ms; cap `dpr={[1,2]}`; instance/merge
      geometry; lazy-load models (draco/meshopt).
- [ ] **Dispose Three.js resources** you created manually (geometries, materials,
      textures, render targets) on unmount — R3F auto-disposes its own tree; avoid GPU leaks.
- [ ] **Mobile cost**: no infinite 3D idle loops; pause animation when backgrounded /
      off-screen (battery + thermal). Prefer Rive/Lottie/Skia over on-device Three.js.
- [ ] **Free & MIT only**: every library used is free/MIT copy-paste (Magic UI/Aceternity/
      R3F/Motion/GSAP). No paid/"Pro"/unlicensed source shipped unless the user explicitly
      approved it (then logged in DECISIONS.md).
- [ ] **Fallbacks**: detect no-WebGL / low-power; ship a static image/gradient. Never a
      blank canvas.
- [ ] **Bundle**: three + R3F is heavy — keep it in a lazy chunk, not the shared bundle.

## Difficulty hints for routing
- **haiku**: drop in one copy-paste Magic UI/Aceternity component; add a Motion
  fade/stagger; swap a gradient.
- **sonnet**: scroll-telling with Lenis+ScrollTrigger, Spline embed, bento hero, RN
  Reanimated/Skia interactions, reduced-motion + lazy-load wiring.
- **opus**: custom R3F scenes + shaders/postprocessing, scroll-synced 3D rigs,
  performance/LCP budgeting for a WebGL-heavy page, the overall immersive architecture.
