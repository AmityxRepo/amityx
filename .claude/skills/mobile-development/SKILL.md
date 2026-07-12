---
name: mobile-development
description: Build and modify mobile apps — React Native/Expo scaffolding, screens, navigation, Supabase backend, device APIs, offline behavior, store-ready builds. Use for any iOS/Android app task.
---

# Mobile Development

## Stack default: Expo (React Native + TypeScript) + Supabase backend
Cross-platform from one codebase, shares the JS ecosystem with the web skill, EAS builds
in the cloud without local Xcode/Android Studio pain. Backend is our Supabase project —
the SAME project as the web app when both exist (one schema, one auth).
- Choose **Flutter** only if the objective demands it (extreme custom UI/animation).
- Choose **native Swift/Kotlin** only for integrations Expo modules can't reach.
Record the choice in ARCHITECTURE.md + DECISIONS.md.

## Scaffold
`npx create-expo-app@latest app/mobile` (includes expo-router; dir is `app/mobile` so a
web app can live in `app/web` — routes then live in `app/mobile/app/`). Core libraries:
- Navigation: expo-router (file-based)
- Backend: `@supabase/supabase-js`. **Session storage:** don't put the raw session in
  expo-secure-store — SecureStore caps values at 2048 bytes and Supabase sessions exceed
  it (Android warnings/failures). Use Supabase's documented **LargeSecureStore** pattern
  (AES-encrypt the session into AsyncStorage, keep only the key in SecureStore). Never
  plain AsyncStorage for tokens.
- Styling: NativeWind (Tailwind syntax) or StyleSheet — pick one, record it
- Server state: TanStack Query · client state: Zustand only if genuinely shared
- Local data / offline: expo-sqlite (+ Drizzle if the local schema is non-trivial)

## Platform design language (feel native, not "web-in-a-shell")
Follow each platform's conventions, not just your `app/DESIGN.md` tokens — a mobile app that
ignores them feels off even when it "works":
- **Navigation:** iOS → tab bar + native stack (back swipe, large titles); Android → bottom
  nav / nav drawer + Material top app bar and hardware/gesture back. expo-router gives native
  stacks per platform; don't hardcode a web-style top nav.
- **Components:** prefer platform-adaptive primitives; respect `Platform.select` for the
  handful of places iOS and Android genuinely differ (date pickers, action sheets, ripples).
- **Type & motion:** SF Pro feel on iOS, Roboto/Material motion on Android; honor the OS
  Dynamic Type / font-scale setting and Reduce Motion.
- **Touch & feedback:** iOS opacity/press states vs Android ripple; respect the platform's
  destructive-action patterns (iOS action sheet, Material dialog).
Reference Apple's Human Interface Guidelines and Google's Material Design; match the platform
your user is on rather than shipping one web layout to both.

## Conventions
- Screens thin; logic in hooks; one directory per feature under `src/features/`.
- Design for BOTH platforms from the start; check layout changes on iOS and Android.
- Safe areas via react-native-safe-area-context on every screen.
- Touch targets ≥ 44pt; Pressable with pressed feedback.
- Keyboard handled on every form (KeyboardAvoidingView / scroll-into-view).
- Assume flaky network: TanStack Query retries + cached reads; every fetch has defined
  offline behavior, even if it's just a friendly error.
- RLS on the Supabase side is the security boundary — the app ships with the anon key.

## Verification loop (developer runs before handing to tester)
1. `npx tsc --noEmit` passes.
2. `npx expo start` → exercise the feature in a simulator/Expo Go; both platforms for
   layout changes.
3. Jest for hooks/logic; Maestro flows (`.maestro/`) for acceptance-criteria journeys.
4. Fill "How to run" in the task Result — device/simulator steps included.

## Builds & store prep
- EAS's **free tier** covers this (builds queue on the free plan); or build locally for free
  with `eas build --local` / prebuild. Don't require a paid EAS plan (`framework/COST_POLICY.md`).
  Apple/Google store **developer accounts** cost money to publish — flag that to the user as
  their choice; it's never auto-assumed, and testing works free via simulator/Expo Go.
- One-time: `eas login` then `eas build:configure`. Then build non-interactively:
  `eas build --profile preview --platform all --non-interactive` (internal),
  `--profile production` (stores).
- App icon: one 1024×1024 master → `app.json` derives sizes (make it with the
  image-creation skill). Splash tested on tall and short screens.
- Permissions: declare only what's used, each with a clear purpose string.

## Quality checklist before write-back
- [ ] Works on iOS and Android (or single-platform documented in DECISIONS.md)
- [ ] Safe areas respected; nothing under notch/home indicator
- [ ] Offline / poor-network behavior defined for every fetch
- [ ] Loading / error / empty states on every screen
- [ ] Keyboard never covers the focused input
- [ ] No hardcoded secrets; config via app.config + env

## Difficulty hints for routing
- haiku: copy/style tweaks, new screen cloned from an existing pattern
- sonnet: navigation flows, forms, data-driven lists, push-notification setup
- opus: offline sync design, native module needs, list/startup performance, app architecture
