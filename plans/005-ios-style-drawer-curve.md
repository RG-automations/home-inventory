# 005 — Replace RN's built-in slide animation with an iOS-style drawer curve on bottom sheets

- **Status**: DONE
- **Commit**: b2dddbb
- **Severity**: LOW
- **Category**: Easing & duration / Cohesion & tokens
- **Estimated scope**: 4 files (`AccountSettingsModal.tsx`, `AllItemsModal.tsx`, `LocationPicker.tsx`, `LocationTreeModal.tsx`) + 1 new shared component

## Problem

Four modals in this app behave as bottom-sheet-style full-screen or
near-full-screen panels and use React Native's built-in
`animationType="slide"`:

```tsx
// components/AccountSettingsModal.tsx:78 — current
<Modal visible={visible} animationType="slide" onRequestClose={onClose}>
```

```tsx
// components/AllItemsModal.tsx:89 — current
<Modal visible={visible} animationType="slide" onRequestClose={onClose}>
```

```tsx
// components/LocationPicker.tsx:99 — current
<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
```

```tsx
// components/LocationTreeModal.tsx:40 — current
<Modal visible={visible} animationType="slide" onRequestClose={onClose}>
```

RN's built-in `"slide"` animation type uses the platform's default modal
transition curve — on iOS this is a system-level linear-ish slide (not
`cubic-bezier(0.32, 0.72, 0, 1)`, the curve iOS's own native sheet
presentations use, which is more decelerated and "settles" more
convincingly at the end), and on Android it is a different system default
entirely. Per the audit's guidance, a drawer/bottom-sheet-feeling panel
should use `cubic-bezier(0.32, 0.72, 0, 1)` — described in the audit as
"iOS-like drawer curve" — rather than either platform's generic system
default, for a more premium, consistent feel across iOS and Android.

**This is intentionally the lowest-priority finding of the five in this
audit.** Fixing it properly requires replacing RN's built-in `Modal`
component's animation with a fully custom-built sheet (Reanimated-driven
`translateY` + a backdrop `Animated.View`, since `Modal`'s `animationType`
prop is a fixed enum with no custom-curve escape hatch) for these 4 call
sites specifically, while the other 8 `Modal` usages in the app (which use
`animationType="fade"` for small centered dialogs) are correctly left alone
— fade dialogs are not drawers and should not gain this curve.

## Target

A new shared component, `components/BottomSheetModal.tsx`, that wraps RN's
`Modal` with `animationType="none"` (disabling RN's own animation
entirely) and drives its own `translateY` slide-up/down using Reanimated
with the exact curve and duration the audit specifies:

```css
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);     /* iOS-like drawer curve */
```

Reanimated's `withTiming` accepts a `Easing.bezier(x1, y1, x2, y2)` curve
directly — confirmed via `node_modules/react-native-reanimated/lib/typescript/animation/easing.d.ts`
containing an `Easing.bezier` factory. Duration: per the audit's table,
"Modals, drawers" budget is **200–500ms**; use **300ms** (the mid-point,
matching this app's existing `SWIPE_SPRING_CONFIG`'s `duration: 350` in
`SwipeableRow.tsx` closely enough to feel like the same design language
without copying a gesture-spring duration onto a discrete open/close
transition).

```tsx
// components/BottomSheetModal.tsx — new file, target
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View, type ModalProps } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../lib/theme-context';

// Krzywa jak natywne arkusze na iOS — mocniej wyhamowuje pod koniec
// niz standardowy ease-out, dzieki czemu \"osiada\" bardziej przekonujaco.
const DRAWER_EASING = Easing.bezier(0.32, 0.72, 0, 1);
const DRAWER_TIMING = { duration: 300, easing: DRAWER_EASING } as const;

type Props = Omit<ModalProps, 'animationType' | 'transparent'> & {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Modal pelnoekranowy/bottom-sheet z wlasna animacja wjazdu (Reanimated),
 * zamiast wbudowanego animationType="slide" z RN — to pozwala uzyc tej
 * samej krzywej (--ease-drawer) na kazdym z 4 arkuszy w apce, zamiast
 * systemowej krzywej platformy (rozna na iOS/Android, mniej "osiadajaca"
 * niz natywne arkusze iOS).
 */
export default function BottomSheetModal({ visible, onClose, children, ...modalProps }: Props) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const translateY = useSharedValue(height);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : height, DRAWER_TIMING);
  }, [visible, height, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} {...modalProps}>
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <Animated.View style={[styles.sheet, sheetStyle]}>{children}</Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  sheet: { flex: 1 },
});
```

Each of the 4 call sites replaces `<Modal visible={visible} animationType="slide" onRequestClose={onClose}>...</Modal>` with `<BottomSheetModal visible={visible} onClose={onClose}>...</BottomSheetModal>`, keeping their existing inner content (header, list, etc.) completely unchanged.

## Repo conventions to follow

- New shared UI wrapper components live directly in `components/`, default-exported, one per file — follow the exact pattern of `components/AnimatedPressable.tsx` (a thin wrapper around a React Native primitive with a narrowed, purpose-specific prop surface).
- `useTheme()` from `../lib/theme-context` is this repo's established way to read `theme.colors.overlay` for modal backdrops — see `components/UpgradeModal.tsx`'s `overlay: { backgroundColor: theme.colors.overlay }` style for the exact color token to reuse.
- Reanimated's `useSharedValue` + `useAnimatedStyle` + `withTiming` triplet is established in `components/SwipeableRow.tsx` — follow that import/usage shape exactly, using `Easing.bezier` (new to this codebase, but the standard Reanimated API) instead of a spring.

## Steps

1. Create `components/BottomSheetModal.tsx` with the exact content shown in Target.
2. In `components/AccountSettingsModal.tsx`: replace the `<Modal visible={visible} animationType="slide" onRequestClose={onClose}>` opening tag (line 78) and its matching `</Modal>` closing tag with `<BottomSheetModal visible={visible} onClose={onClose}>` / `</BottomSheetModal>`. Remove the `Modal` import from `react-native` if no other `Modal` usage remains in the file (check first — there is only the one in this file). Add `import BottomSheetModal from './BottomSheetModal';`.
3. Repeat step 2's pattern for `components/AllItemsModal.tsx:89`.
4. Repeat step 2's pattern for `components/LocationTreeModal.tsx:40`.
5. For `components/LocationPicker.tsx:99`, the current tag is `<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>` — note it already passes `transparent`, which `BottomSheetModal` hardcodes internally, so simply drop the `transparent` prop when swapping (it's redundant, not conflicting — `BottomSheetModal`'s internal `Modal` always renders `transparent`). Apply the same swap pattern as step 2.
6. In each of the 4 files, verify the modal's inner content (currently a direct child of `Modal`, e.g. `<View style={styles.container}>...</View>`) does not itself rely on `Modal`'s own full-bleed sizing behavior in a way that conflicts with `BottomSheetModal`'s `sheet: { flex: 1 }` wrapper `View` — since `BottomSheetModal` wraps children in an extra `Animated.View` with `flex: 1`, a child that already sets `flex: 1` (check `AccountSettingsModal.tsx`'s `container` style, `AllItemsModal.tsx`'s `container` style, `LocationTreeModal.tsx`'s `container` style — all three currently use `{ flex: 1, backgroundColor: theme.colors.background }` per the recon) should compose fine as a nested `flex: 1`, but confirm no double-background or sizing artifact appears in the feel check.
7. For `LocationPicker.tsx` specifically: its current content is NOT a full-screen `View` — it's a bottom-anchored `sheet` style (`maxHeight: '80%', minHeight: '50%'`) inside an `overlay` that uses `justifyContent: 'flex-end'` (per the file's existing `createStyles`). This is a **different sheet-sizing pattern** than the other 3 files' full-screen containers. `BottomSheetModal`'s `overlay`/`sheet` styles (both `flex: 1`) will conflict with `LocationPicker`'s own partial-height overlay/sheet styles. **Do not force `LocationPicker` into `BottomSheetModal`'s full-screen `flex: 1` sheet shape.** Instead, for this one file only: keep its own `overlay`/`sheet` `View` structure exactly as it is today, and only swap the outer `<Modal animationType="slide">` for `<Modal animationType="none">` plus wrap the existing `sheet` `View` in an `Animated.View` with a Reanimated `translateY` driven by the same `DRAWER_TIMING`/`DRAWER_EASING` constants (export those two constants from `BottomSheetModal.tsx` for reuse, or move them to a small shared file such as `lib/drawer-motion.ts` if that reads cleaner — prefer the shared file to avoid a component-file import for constants). Do NOT use the `BottomSheetModal` wrapper component itself for `LocationPicker.tsx` — only reuse its timing constants.

## Boundaries

- Do NOT touch any of the other 8 `Modal` usages in the app that use `animationType="fade"` (`AddItemModal.tsx`, `EditItemModal.tsx`, `EditLocationModal.tsx`, `LanguagePicker.tsx`, `LocationBrowser.tsx`, `QuickAddModal.tsx`, `SearchBar.tsx`, `UpgradeModal.tsx`) — these are small centered dialogs, not drawers, and the audit is explicit that "Modals are exempt" from origin/curve changes when they are centered, not edge-anchored.
- Do NOT change `LocationPicker.tsx`'s existing partial-height sheet layout (the `maxHeight: '80%'`/`minHeight: '50%'` sizing) — only its animation mechanism, per Step 7.
- Do NOT add reduced-motion handling in this plan — if plan 003 has landed first, revisit `BottomSheetModal.tsx` and `LocationPicker.tsx`'s new Reanimated-driven translateY to also respect `useReducedMotion()` (skip the slide, jump to final position) as a fast follow, but that is out of this plan's explicit scope; note it as a TODO comment in the new code if plan 003 has not landed yet.
- If `AccountSettingsModal.tsx`, `AllItemsModal.tsx`, or `LocationTreeModal.tsx`'s content structure has changed since this plan was stamped (commit `b2dddbb`) such that the `flex: 1` composition in Step 6 visibly breaks, STOP and report rather than force-fitting extra style overrides.

## Verification

- **Mechanical**: `npx tsc --noEmit` — zero errors. `npx expo export --platform web --clear` — build succeeds.
- **Feel check**:
  - Open `AccountSettingsModal` (Settings icon in header) — confirm it slides up from the bottom with a curve that decelerates more noticeably near the top of its travel than the app's previous default slide (compare side-by-side with a `git stash` of this plan if unsure — the difference is subtle but should be perceptible in slow motion).
  - Open `AllItemsModal` (📋 icon), `LocationTreeModal` (🗂️ icon), and `LocationPicker` (via "Wybierz miejsce" inside any add/edit form) — confirm all four now share the exact same slide-up feel (same duration, same curve), where before they may have subtly differed by platform default.
  - Close each via its own close button — confirm the reverse animation (slide back down) is symmetric in duration/curve to the opening animation, not instant or differently-timed.
  - Rapidly open and close the same modal multiple times in a row — confirm the `translateY` value doesn't visibly jump or glitch (Reanimated's `withTiming` retargets from the current value automatically, so this should just work — confirm it does).
  - Specifically re-check `LocationPicker` retains its bottom-sheet partial height (does NOT become a full-screen sheet) — this is the one file with different sizing per Step 7.
- **Done when**: all 4 target modals share one consistent iOS-style drawer curve and 300ms duration, `LocationPicker` keeps its partial-height layout unchanged, the other 8 fade-dialog modals are untouched, and `tsc`/the web build both pass.

## Execution notes

- Plan 003 had already landed, so reduced-motion support was wired in immediately rather than left as a TODO (per the Boundaries note allowing this): `BottomSheetModal.tsx` and `LocationPicker.tsx`'s custom `translateY` both call `useReducedMotion()` and jump straight to the target position (skip `withTiming`) when enabled.
- Timing constants were extracted into `lib/drawer-motion.ts` (`DRAWER_TIMING`) as the plan's Step 7 preferred, so `LocationPicker.tsx` could reuse them without importing from a component file.
- `tsc --noEmit` and `npx expo export --platform web --clear` both passed with zero errors.
