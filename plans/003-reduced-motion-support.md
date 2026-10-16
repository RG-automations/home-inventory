# 003 — Add reduced-motion support to SwipeableRow and Modal transitions

- **Status**: DONE
- **Commit**: b2dddbb
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 3 files (`components/SwipeableRow.tsx`, a new `lib/use-reduced-motion.ts`, and 12 files with `<Modal animationType=...>`)

## Problem

Zero results anywhere in the codebase for `prefers-reduced-motion`,
`AccessibilityInfo`, `isReduceMotionEnabled`, or `useReducedMotion`. Two
categories of motion in this app never check the system's reduced-motion
setting:

1. **`components/SwipeableRow.tsx`**: the native swipe gesture (lines
   96-140) drives `translateX` through a rubber-band overshoot function
   (`rubberband()`, lines 30-33) and a `withSpring` with velocity handoff
   (lines 103, 132-135). A user with vestibular sensitivity who has enabled
   "Reduce Motion" still gets the full spring-driven, momentum-carrying
   slide-and-bounce every time they swipe a row.

2. **12 `<Modal animationType="fade"|"slide">` usages** (`AccountSettingsModal.tsx:78`, `AddItemModal.tsx:83`, `AllItemsModal.tsx:89`, `EditItemModal.tsx:98`, `EditLocationModal.tsx:135`, `LanguagePicker.tsx:32`, `LocationBrowser.tsx:282`, `LocationPicker.tsx:99`, `LocationTreeModal.tsx:40`, `QuickAddModal.tsx:101`, `SearchBar.tsx:76`, `UpgradeModal.tsx:24`) — React Native's built-in `Modal` `animationType` prop has no reduced-motion awareness at all; it always slides or fades at the system's default speed regardless of the accessibility setting.

Per the audit's guidance, reduced motion means *fewer and gentler*
animations, not zero — opacity/color feedback that aids comprehension should
stay; movement (translation, rubber-band overshoot, slide-in) should be
dropped or minimized.

## Target

A single new hook, `lib/use-reduced-motion.ts`, backed by React Native's own
`AccessibilityInfo` API (confirmed via `node_modules/react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo.d.ts:71`: `isReduceMotionEnabled: () => Promise<boolean>` — and confirmed that `react-native-web` implements the same API by reading `window.matchMedia('(prefers-reduced-motion: reduce)')` under the hood, per `node_modules/react-native-web/src/exports/AccessibilityInfo/index.js:22`, so **one hook covers iOS, Android, and web** — no `Platform.OS` branching needed):

```ts
// lib/use-reduced-motion.ts — new file, target
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Odczytuje systemowe ustawienie "Ogranicz ruch" (iOS/Android) lub
 * prefers-reduced-motion (web — react-native-web mapuje to samo API na
 * te sama media query pod spodem, wiec ten hook dziala identycznie
 * na wszystkich platformach bez rozgalezien Platform.OS).
 */
export function useReducedMotion(): boolean {
  const [isReduced, setIsReduced] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isMounted) setIsReduced(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setIsReduced(enabled);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return isReduced;
}
```

For `SwipeableRow.tsx`: when reduced motion is on, skip the rubber-band
overshoot entirely (clamp hard at the boundary instead) and use Reanimated's
own built-in `reduceMotion` option on `withSpring` (confirmed present in
`node_modules/react-native-reanimated/lib/typescript/animation/spring/springConfigs.d.ts:72`: `reduceMotion?: ReduceMotion`, and the enum at `node_modules/react-native-reanimated/lib/typescript/commonTypes.d.ts:301-305` has a `System` value that reads the OS setting internally) — this means **Reanimated already has native reduced-motion support built in**, and the fix here is simply to opt into it rather than reimplement detection:

```tsx
// components/SwipeableRow.tsx — target (spring config, replaces line 39)
import { ReduceMotion } from 'react-native-reanimated';

const SWIPE_SPRING_CONFIG = {
  dampingRatio: 1,
  duration: 350,
  reduceMotion: ReduceMotion.System,
} as const;
```

With `reduceMotion: ReduceMotion.System`, Reanimated will disable the spring
easing under the hood and jump directly to the target value when the OS
setting is on — this alone handles the "no easing" part.
It does **not** disable the rubber-band overshoot function (`rubberband()`,
lines 30-33), which runs on every `onUpdate` frame during the drag itself,
not through `withSpring`. That needs an explicit check using the new hook,
because the rubber-band overshoot is a physical, moving deviation from where
the finger is, which reduced-motion users should not see:

```tsx
// components/SwipeableRow.tsx — target (inside NativeSwipeableRow, near the panGesture definition)
const isReducedMotion = useReducedMotion();
// ... pass isReducedMotion into the worklet via a shared value, since
// Gesture.Pan().onUpdate runs on the UI thread and cannot read a plain
// JS boolean captured by closure reliably across re-renders:
const reducedMotionShared = useSharedValue(isReducedMotion);
useEffect(() => {
  reducedMotionShared.value = isReducedMotion;
}, [isReducedMotion, reducedMotionShared]);
```

```tsx
// components/SwipeableRow.tsx — target (onUpdate handler, replaces lines 111-121)
.onUpdate((event) => {
  const raw = startX.value + event.translationX;
  if (reducedMotionShared.value) {
    // Ogranicz ruch: twardy stop na granicy, bez fizycznego oporu —
    // rubber-band to ruch WIEKSZY niz to, co robi palec, wiec dla
    // uzytkownikow wrazliwych na ruch pomijamy go calkowicie.
    translateX.value = Math.max(-ACTIONS_WIDTH, Math.min(0, raw));
  } else if (raw < -ACTIONS_WIDTH) {
    translateX.value = -ACTIONS_WIDTH + rubberband(raw + ACTIONS_WIDTH, ACTIONS_WIDTH);
  } else if (raw > 0) {
    translateX.value = rubberband(raw, ACTIONS_WIDTH);
  } else {
    translateX.value = raw;
  }
})
```

For the 12 `Modal` usages: React Native's `Modal` component's `animationType`
prop has no reduced-motion escape hatch. The correct target per the audit
("reduced motion means fewer and gentler, not zero — keep opacity/color that
aids comprehension") is: when reduced motion is on, use `animationType="none"`
(RN's actual literal value for "no animation," confirmed in
`node_modules/@types/react-native/index.d.ts` — search `ModalBaseProps` for
`animationType?: 'none' | 'slide' | 'fade'`) so the modal simply appears/disappears
instantly with no slide or fade motion, satisfying "movement dropped." This
does forgo the "keep opacity feedback" nuance since `Modal` doesn't expose a
partial-animation mode — that's an acceptable simplification given RN's
`Modal` primitive is a black box here (documented as a deliberate constraint,
not missed nuance).

## Repo conventions to follow

- New cross-cutting hooks live directly in `lib/` as `use-*.ts`, exporting a single named hook — follow `lib/use-swipe-back.ts` and `lib/use-photo-picker.ts` as the exact naming and file-placement convention.
- Reanimated worklet functions that run on the UI thread are marked with the `'worklet'` directive string as the first statement — see `components/SwipeableRow.tsx:30-33`'s `rubberband()` function for the exact pattern to follow if any new worklet-context code is added.
- This codebase already has one shared-value-driven-by-a-prop pattern to imitate if the `useEffect` sync in Target above needs a reference: none exists yet in this specific shape, so follow the Target code as given — it is the minimal correct pattern (`useSharedValue` + `useEffect` to sync a JS-thread value into a UI-thread shared value).

## Steps

1. Create `lib/use-reduced-motion.ts` with the exact content shown in Target.
2. In `components/SwipeableRow.tsx`:
   - Add `import { useReducedMotion } from '../lib/use-reduced-motion';` near the other local imports.
   - Add `import { ReduceMotion } from 'react-native-reanimated';` to the existing Reanimated import block (lines 5-10).
   - Update `SWIPE_SPRING_CONFIG` (line 39) to include `reduceMotion: ReduceMotion.System` as shown in Target.
   - Inside `NativeSwipeableRow` (the function starting at line 85), add the `useReducedMotion()` call and the `reducedMotionShared` shared value + sync `useEffect`, exactly as shown in Target, placed after the existing `translateX`/`startX` shared value declarations (after line 100).
   - Replace the `onUpdate` handler body (lines 111-121) with the Target version that branches on `reducedMotionShared.value`.
3. For each of the 12 files with `<Modal animationType="fade"|"slide" ...>`, add a reduced-motion check that swaps the literal string to `"none"`. Concretely, in each file:
   - Add `import { useReducedMotion } from '../lib/use-reduced-motion';` (adjust relative path per file's directory depth — all are directly in `components/`, so `'../lib/use-reduced-motion'`).
   - Add `const isReducedMotion = useReducedMotion();` inside the component function, near its other hook calls.
   - Change `animationType="fade"` to `animationType={isReducedMotion ? 'none' : 'fade'}` (or the `"slide"` equivalent for the 4 files that use it: `AccountSettingsModal.tsx`, `AllItemsModal.tsx`, `LocationPicker.tsx`, `LocationTreeModal.tsx`).
   - The 12 files, exact prop to change: `AccountSettingsModal.tsx:78` (`slide`→conditional), `AddItemModal.tsx:83` (`fade`→conditional), `AllItemsModal.tsx:89` (`slide`→conditional), `EditItemModal.tsx:98` (`fade`→conditional), `EditLocationModal.tsx:135` (`fade`→conditional), `LanguagePicker.tsx:32` (`fade`→conditional), `LocationBrowser.tsx:282` (`fade`→conditional), `LocationPicker.tsx:99` (`slide`→conditional), `LocationTreeModal.tsx:40` (`slide`→conditional), `QuickAddModal.tsx:101` (`fade`→conditional), `SearchBar.tsx:76` (`fade`→conditional), `UpgradeModal.tsx:24` (`fade`→conditional).
4. Run a final grep for `animationType="fade"` and `animationType="slide"` (as bare string literals, not inside a ternary) across `components/*.tsx` to confirm all 12 were converted and none were missed.

## Boundaries

- Do NOT touch `SwipeableRow.tsx`'s desktop-web branch (`Platform.OS === 'web' && !hasTouchInput()`, lines 58-76) — it renders static clickable buttons with no gesture or spring motion to reduce in the first place.
- Do NOT add a `Platform.OS` branch inside `use-reduced-motion.ts` — the whole point of using `AccessibilityInfo` is that `react-native-web` already unifies this; adding a branch would be redundant and is a sign something else went wrong (STOP and report if `AccessibilityInfo.isReduceMotionEnabled` genuinely doesn't exist on the installed `react-native-web` version — verify via `node_modules/react-native-web/src/exports/AccessibilityInfo/index.js` before assuming so).
- Do NOT change `SWIPE_SPRING_CONFIG`'s `dampingRatio` or `duration` values — only add the new `reduceMotion` key.
- Do NOT attempt to give `Modal` a custom fade-only (opacity-preserved) reduced-motion mode — `animationType="none"` is the correct, final target per this plan; RN's `Modal` has no finer-grained control, and building a custom modal wrapper to get one is out of scope.
- If any of the 12 line numbers cited above have drifted (file edited since the commit this plan is stamped with), STOP and re-locate the `<Modal` tag by searching for `animationType=` in that file rather than guessing.

## Verification

- **Mechanical**: `npx tsc --noEmit` — zero errors. `npx expo export --platform web --clear` — build succeeds.
- **Feel check** (device or simulator with a way to toggle reduced motion — iOS Settings → Accessibility → Motion → Reduce Motion; on desktop web, Chrome DevTools → Rendering tab → "Emulate CSS media feature prefers-reduced-motion: reduce"):
  - With reduced motion OFF: swipe a row in `LocationBrowser` past the action-button boundary and confirm the existing rubber-band resistance still visibly happens (this plan must not regress the non-reduced-motion experience).
  - With reduced motion ON: swipe the same row past the boundary — confirm the row's edge stops flush against the boundary with no overshoot-and-settle wobble, and releasing the drag snaps instantly to open/closed with no visible spring easing.
  - With reduced motion ON: open any modal (e.g. `UpgradeModal` by hitting the free-tier item limit, or `LanguagePicker` from the header globe icon) — confirm it appears instantly with no slide-up or fade-in.
  - With reduced motion OFF again: reopen the same modal — confirm the original fade/slide animation is back (proves the conditional, not a hardcoded regression).
- **Done when**: every one of the 12 `Modal` usages responds to the OS/browser reduced-motion toggle, `SwipeableRow`'s rubber-band and spring both respect it, `tsc` and the web build pass, and toggling reduced motion off restores the original animations exactly.
