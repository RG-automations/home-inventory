# 001 — Fix press feedback silently doing nothing on iOS/Android

- **Status**: DONE
- **Commit**: b2dddbb
- **Severity**: HIGH
- **Category**: Performance / Interruptibility (uses CSS-only style props on native)
- **Estimated scope**: 2 files (`lib/press.ts`, `components/AnimatedPressable.tsx`), no other files need edits

## Problem

`lib/press.ts:8-12` defines a "transition" using CSS-only style properties that
React Native's native style engine does not recognize:

```ts
// lib/press.ts:8-12 — current
export const pressTransition = {
  transitionProperty: 'transform',
  transitionDuration: 120,
  transitionTimingFunction: 'ease-out',
} as ViewStyle;
```

The file comment claims "nowa architektura RN rowniez rozpoznaje te
wlasnosci" (the New Architecture also recognizes these properties) — this is
incorrect. `transitionProperty`, `transitionDuration`, and
`transitionTimingFunction` do not appear anywhere in React Native's native
`StyleSheetTypes` and are silently dropped by the native style resolver on
iOS and Android. They only work through `react-native-web`, which translates
them to real CSS transitions in the browser.

This token is applied via `components/AnimatedPressable.tsx:24-29` to every
pressable in the app that uses `AnimatedPressable` (~70 buttons across 13
files, per the earlier press-feedback rollout), plus manually via
`...pressTransition` in `AppHeader.tsx`, `LocationBrowser.tsx`,
`QuickActions.tsx`, `QuickAddFab.tsx`, and `SwipeableRow.tsx`'s web branch.

**User-facing effect**: on the web build, pressing a button smoothly scales
it down over 120ms. On iOS and Android — the actual target platforms for
this inventory app — the `scale` transform still applies (RN Pressable's
`pressed` state works everywhere), but it snaps instantly with no
interpolation, because there is no native equivalent transition running.
The feedback is abrupt on-device instead of the smooth, deliberate motion
the rest of the codebase already achieves in `SwipeableRow.tsx` via
Reanimated's `withSpring`.

## Target

Two things change:

1. `lib/press.ts` gets a native-safe animated equivalent using Reanimated
   (already a project dependency, used in `SwipeableRow.tsx`), driven by a
   shared value that flips on `pressIn`/`pressOut`, with the exact same
   perceptual timing: **120ms, ease-out**. Reanimated's `withTiming` accepts
   a bezier easing directly.

2. `AnimatedPressable.tsx` switches its rendering to use this native-safe
   animation instead of the CSS-only style object, while keeping the exact
   same public API (`pressedScale` prop, same default `0.96`).

Target `lib/press.ts`:

```ts
// lib/press.ts — target
import { Easing } from 'react-native-reanimated';

/**
 * Konfiguracja czasu trwania i krzywej dla feedbacku na dotkniecie —
 * uzywana przez AnimatedPressable (Reanimated withTiming). 120ms/ease-out
 * to ten sam budzet co reszta drobnych interakcji w apce (patrz
 * SWIPE_SPRING_CONFIG w SwipeableRow.tsx dla wiekszych gestow).
 */
export const PRESS_TIMING_CONFIG = {
  duration: 120,
  easing: Easing.out(Easing.ease),
} as const;
```

Target `components/AnimatedPressable.tsx`:

```tsx
// components/AnimatedPressable.tsx — target
import { useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PRESS_TIMING_CONFIG } from '../lib/press';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  /** O ile zmniejszyc element na dotkniecie. Domyslnie 0.96 — subtelne, nie zaklocajace layoutu. */
  pressedScale?: number;
};

/**
 * Pressable z wbudowanym feedbackiem na dotkniecie (apple-design zasada #1:
 * odpowiedz natychmiast na pointer-down, nie na puszczenie). Uzywa
 * Reanimated (nie CSS-transition-only stylow), wiec animacja dziala
 * identycznie na web, iOS i Android — RN natywnie ignoruje transitionProperty
 * i podobne klucze CSS, wiec ta wersja jest jedynym sposobem na plynny
 * feedback na telefonie.
 */
export default function AnimatedPressable({ style, pressedScale = 0.96, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback<NonNullable<PressableProps['onPressIn']>>(
    (event) => {
      scale.value = withTiming(pressedScale, PRESS_TIMING_CONFIG);
      onPressIn?.(event);
    },
    [scale, pressedScale, onPressIn],
  );

  const handlePressOut = useCallback<NonNullable<PressableProps['onPressOut']>>(
    (event) => {
      scale.value = withTiming(1, PRESS_TIMING_CONFIG);
      onPressOut?.(event);
    },
    [scale, onPressOut],
  );

  return (
    <AnimatedPressableBase
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    />
  );
}
```

Note the API shape changes slightly: `style` prop callers currently pass
either a static style object or (in a few call sites) rely on the
`({pressed}) => [...]` function form via the wrapped `Pressable`. Check every
call site (see Steps) — `AnimatedPressable`'s existing usages all pass a
plain static `StyleProp<ViewStyle>` (verified: no call site in the codebase
passes a function to `AnimatedPressable`'s `style` prop, only to raw
`Pressable` elsewhere), so the plain-array style target above is a safe,
non-breaking replacement.

## Repo conventions to follow

- Reanimated is already imported the same way in `components/SwipeableRow.tsx:5-10` (`useAnimatedStyle`, `useSharedValue`, `withSpring` from `'react-native-reanimated'`) — follow that import style, using `withTiming` and `Easing` instead.
- `lib/press.ts` is the single source of truth for the press-feedback duration/curve token — keep it that way, just change its shape from a `ViewStyle` object to a timing config object.
- Comments in this codebase are Polish, explain *why* not *what*, and are one or two lines — match that (see the existing comment in `lib/press.ts` and doc comments in `AnimatedPressable.tsx`).

## Steps

1. Rewrite `lib/press.ts`: replace the `pressTransition` `ViewStyle` export with the `PRESS_TIMING_CONFIG` object shown in Target. Delete the old JSDoc comment (it describes a mechanism that no longer exists) and replace with the one shown above.
2. Rewrite `components/AnimatedPressable.tsx` to the Target code above.
3. `lib/press.ts` no longer exports a `ViewStyle` — it exports `PRESS_TIMING_CONFIG`, a plain config object, which is NOT spreadable into a style (`...pressTransition` becomes meaningless). Five other files still do `...pressTransition` or `import { pressTransition }`:
   - `components/AppHeader.tsx`
   - `components/LocationBrowser.tsx`
   - `components/QuickActions.tsx`
   - `components/QuickAddFab.tsx`
   - `components/SwipeableRow.tsx` (web branch, `styles.webActionButton`)

   These five files are the exact subject of plan 002 (`002-consolidate-press-scale-tokens.md`), which converts all of them to use `AnimatedPressable` directly. **Do not fix them in this plan** — that would duplicate plan 002's work and risk the two plans conflicting. Instead, to keep the repo compiling after this plan lands on its own:
   - In each of the 5 files, delete the `import { pressTransition } from '../lib/press'` line and delete every `...pressTransition,` line inside their `StyleSheet.create({...})` calls. Leave the `pressed &&` conditional scale-only styles (e.g. `buttonPressed: { transform: [{ scale: 0.92 }] }`) exactly as they are — do not touch those values or delete those style keys.
   - This is a deliberate, temporary no-op on native (these five files' press feedback was already instant-snap on iOS/Android before this plan, since `pressTransition` never worked there) and a minor, temporary regression on desktop web only (loses the CSS transition smoothing until plan 002 lands). Note this tradeoff in the PR/commit description if one is written.

## Boundaries

- Do NOT touch the 13 files that consume `AnimatedPressable` as a component (`AccountSettingsModal.tsx`, `AddItemModal.tsx`, `AllItemsModal.tsx`, `EditItemModal.tsx`, `EditLocationModal.tsx`, `LanguagePicker.tsx`, `LocationBreadcrumb.tsx`, `LocationPicker.tsx`, `LocationTreeModal.tsx`, `LocationTreeNode.tsx`, `QuickAddModal.tsx`, `UpgradeModal.tsx`) — they get the fix automatically once `AnimatedPressable.tsx` itself is fixed, since its public API is unchanged.
- Do NOT change the default `pressedScale` value (0.96) or any call site that passes an explicit `pressedScale`.
- Do NOT consolidate the divergent scale values in `AppHeader.tsx`/`LocationBrowser.tsx`/`QuickActions.tsx`/`QuickAddFab.tsx`/`SwipeableRow.tsx` (0.92, 0.95, 0.97, 0.94, 0.90) — that is plan 002's job.
- Do NOT add a new animation library — Reanimated is already a dependency.
- If `Animated.createAnimatedComponent(Pressable)` does not accept `onPressIn`/`onPressOut` cleanly in this Reanimated version (4.5.1), STOP and report instead of working around it with an untyped cast.

## Verification

- **Mechanical**: `npx tsc --noEmit` — zero errors. `npx expo export --platform web --clear` — build succeeds.
- **Feel check**:
  - On an iOS device (or PWA in Safari on iPhone — confirmed working test rig per prior session), press and hold any button using `AnimatedPressable` (e.g. the "Zapisz" button in `EditItemModal`). Confirm the button visibly shrinks smoothly over ~120ms rather than snapping instantly to the pressed scale.
  - Release and confirm it grows back over the same ~120ms, not instantly.
  - Repeat on desktop web (mouse) — confirm no visual regression from today's CSS-transition behavior.
  - Rapidly tap the same button multiple times in a row — confirm the scale animation never gets stuck at a partial value (Reanimated's `withTiming` interrupts and retargets cleanly by default, so this should just work; explicitly re-check it does).
- **Done when**: pressing any `AnimatedPressable`-based button on a real iOS or Android device shows a smooth ~120ms scale transition, not an instant snap; `tsc` and the web build both pass.

## Execution notes

- `tsc` after Steps 1-2 revealed a 6th file with `...pressTransition` that the original audit missed: `app/login.tsx` (2 usages, both scale-only `buttonPressed`/no equivalent — same pattern as the 5 files listed in Step 3). Fixed identically: removed the import and both `...pressTransition,` spreads, left the `pressed &&` conditional scale styles untouched. This file is now also implicitly in scope for plan 002 (it has the same `buttonPressed: { transform: [{ scale: 0.97 }] }` pattern as `LocationBrowser.tsx`'s `modalSave` — not convertible to `AnimatedPressable` due to a combined `buttonDisabled` conditional, same as documented in plan 002's Step 2 for `modalSave`).
- `tsc --noEmit` and `npx expo export --platform web --clear` both passed with zero errors after all edits.
