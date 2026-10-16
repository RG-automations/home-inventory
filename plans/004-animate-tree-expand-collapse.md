# 004 — Animate location tree expand/collapse instead of teleporting

- **Status**: DONE
- **Commit**: b2dddbb
- **Severity**: LOW
- **Category**: Missed opportunities (state change that teleports)
- **Estimated scope**: 1 file (`components/LocationTreeNode.tsx`)

## Problem

`components/LocationTreeNode.tsx` renders a recursive, indented tree of
locations (used inside `LocationTreeModal`). Expanding or collapsing a node
with children is a plain conditional render with zero transition:

```tsx
// components/LocationTreeNode.tsx:56-59 — current
{isExpanded &&
  node.children.map((child) => (
    <LocationTreeNode key={child.id} node={child} depth={depth + 1} onSelect={onSelect} />
  ))}
```

```tsx
// components/LocationTreeNode.tsx:38 — current
<Text style={styles.disclosureIcon}>{isExpanded ? '▼' : '▶'}</Text>
```

Tapping the disclosure triangle makes an entire subtree of rows instantly
appear or disappear — for a location with many children (e.g. a room full of
labeled boxes), this is a visible jump in the modal's content height with no
transition to explain what just happened. This matches the audit's
"state change that teleports (content swaps, layout jumps)" pattern under
Missed Opportunities. The disclosure icon itself also snaps between `▼`/`▶`
with no rotation, despite this being exactly the kind of small rotation
affordance most native tree/disclosure UIs use to reinforce the state
change.

This is a **rare, low-frequency interaction** (a user expands/collapses tree
nodes occasionally while browsing their location hierarchy, not dozens of
times per session), which per the audit's frequency table ("Occasional →
Standard animation") justifies adding motion here, unlike a hover state hit
constantly.

## Target

Two independent, additive changes — neither touches the tree's data logic,
only its presentation:

1. **Layout transition on expand/collapse**: React Native's built-in
   `LayoutAnimation` API (no new dependency — it ships with `react-native`
   itself) animates the height change when children mount/unmount, using a
   spring-like preset. This is the RN-native equivalent of the audit's
   "brief transition to prevent a jarring change" guidance, and is the
   standard, zero-dependency tool for exactly this case (animating a
   conditional-render layout change, as opposed to a controlled numeric
   value, which is what `LayoutAnimation` is for and what `Animated`/Reanimated
   are not well-suited for without manually measuring heights).

2. **Disclosure icon rotation**: replace the `▼`/`▶` character swap with a
   single `▶` character that rotates 90° via a Reanimated-driven
   `rotate` transform when `isExpanded` toggles, using the same
   **120ms/ease-out** timing token this app already established in
   `lib/press.ts` (via plan 001 — this plan depends on plan 001 having
   defined `PRESS_TIMING_CONFIG` in `lib/press.ts`, since this plan reuses
   that exact token rather than inventing a new duration).

```tsx
// components/LocationTreeNode.tsx — target (imports, add to existing)
import { useEffect } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PRESS_TIMING_CONFIG } from '../lib/press';

// Android requires this opt-in call once per app lifecycle for LayoutAnimation
// to work at all (iOS has it enabled by default) — see Steps for exact placement.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
```

```tsx
// components/LocationTreeNode.tsx — target (inside the component function, replaces line 20's useState line and adds new logic)
const [isExpanded, setIsExpanded] = useState(depth === 0);
const rotation = useSharedValue(isExpanded ? 90 : 0);

useEffect(() => {
  rotation.value = withTiming(isExpanded ? 90 : 0, PRESS_TIMING_CONFIG);
}, [isExpanded, rotation]);

const disclosureIconStyle = useAnimatedStyle(() => ({
  transform: [{ rotate: `${rotation.value}deg` }],
}));

function toggleExpanded() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setIsExpanded((current) => !current);
}
```

```tsx
// components/LocationTreeNode.tsx — target (disclosure button, replaces lines 30-39)
<AnimatedPressable
  hitSlop={8}
  onPress={(e) => {
    e.stopPropagation();
    toggleExpanded();
  }}
  style={styles.disclosure}
>
  <Animated.Text style={[styles.disclosureIcon, disclosureIconStyle]}>▶</Animated.Text>
</AnimatedPressable>
```

Note the disclosure icon changes from a plain `Text` swapping between two
different glyphs (`▼`/`▶`) to a single `▶` glyph that physically rotates 90°
clockwise to visually become a downward-pointing triangle — this is the
standard native disclosure-triangle idiom (iOS Settings, macOS Finder) and
removes the glyph-swap entirely in favor of one animated rotation.

## Repo conventions to follow

- `lib/press.ts` is this repo's single source of truth for the "small UI feedback" timing token (`PRESS_TIMING_CONFIG`, defined in plan 001) — reuse it here rather than defining a second, slightly different duration/easing pair for what is functionally the same class of "small deliberate UI motion."
- `AnimatedPressable` (already used at `components/LocationTreeNode.tsx:25` and `:30` per the current file) is the established wrapper for anything pressable in this codebase — keep using it for the disclosure button, just add the animated rotation content inside it.
- Reanimated's `useAnimatedStyle` + `useSharedValue` + `withTiming` triplet is already established in `components/SwipeableRow.tsx` for UI-thread-driven style changes — follow that exact import and usage shape.

## Steps

1. Add the `LayoutAnimation`/`UIManager`/`Platform` imports and the Android opt-in `if` block shown in Target, placed at module scope (top of the file, after existing imports, before the component definition) — this must run once, not per-render, so it must NOT be inside the component function body.
2. Add the Reanimated imports (`Animated`, `useAnimatedStyle`, `useSharedValue`, `withTiming`) and the `PRESS_TIMING_CONFIG` import from `../lib/press` (this import path assumes plan 001 has landed and exports `PRESS_TIMING_CONFIG` from that file — if plan 001 has not landed yet, STOP and either land it first or substitute the literal `{ duration: 120, easing: Easing.out(Easing.ease) }` inline with an explicit `import { Easing } from 'react-native-reanimated'`, noting the temporary duplication).
3. Inside the component function, add the `rotation` shared value, the sync `useEffect`, the `disclosureIconStyle` animated style, and the `toggleExpanded` function exactly as shown in Target, placed after the existing `const hasChildren = ...` line (line 21).
4. Replace the inline `onPress={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}` (lines 32-35) to call `toggleExpanded()` instead (which now also triggers the `LayoutAnimation`), per the Target code for the disclosure button.
5. Replace the disclosure `Text` (line 38, `{isExpanded ? '▼' : '▶'}`) with the single-glyph `Animated.Text` shown in Target.
6. Confirm `disclosureIcon` style (line 80, `{ fontSize: theme.fontSize.xs, color: theme.colors.textMuted }`) still applies correctly to the new `Animated.Text` — no change needed to the style object itself, just confirm the `Animated.Text` component accepts the same `style` shape (it does; `Animated.Text` from Reanimated is a drop-in animated version of RN's `Text`).

## Boundaries

- Do NOT touch `LocationTreeModal.tsx` — this plan is scoped to the recursive node component only.
- Do NOT add a stagger between sibling children appearing — `LayoutAnimation.configureNext` animates the overall layout shift as one unit; adding per-child stagger would require abandoning `LayoutAnimation` for a fully custom Reanimated list-entrance approach, which is a different, larger change out of this plan's scope.
- Do NOT change `LocationTreeModal`'s or any parent's `ScrollView` behavior — `LayoutAnimation` on children inside a `ScrollView` works without special handling in RN, verify this holds in Verification below but do not preemptively add scroll-position-preservation logic unless the feel check reveals a real problem.
- If `UIManager.setLayoutAnimationEnabledExperimental` does not exist on the installed React Native version (New Architecture builds sometimes remove or no-op this call), STOP and report rather than wrapping it in a broader try/catch — the module-level `if` guard already checks for the method's existence, so a missing method should simply no-op silently on that platform, which is acceptable; only stop if `LayoutAnimation.configureNext` itself throws.

## Verification

- **Mechanical**: `npx tsc --noEmit` — zero errors. `npx expo export --platform web --clear` — build succeeds.
- **Feel check**:
  - Open `LocationTreeModal`, find a location with children, tap its disclosure triangle. Confirm the children's rows animate into view (sliding/fading in as the container grows) rather than snapping into existence instantly.
  - Confirm the triangle itself visibly rotates from pointing right to pointing down over the same brief duration, not an instant glyph swap.
  - Collapse the same node — confirm the reverse: children animate out, triangle rotates back to pointing right.
  - Rapidly tap the disclosure triangle multiple times in quick succession — confirm the rotation never gets stuck at a partial angle and the layout animation does not visibly glitch or overlap incorrectly.
  - Test on both iOS/Android (LayoutAnimation) and web (react-native-web's LayoutAnimation support — if the layout animation silently no-ops on web, that is acceptable per RN's own web limitations, but the rotation animation MUST still work on web since it's pure Reanimated).
- **Done when**: expanding/collapsing a tree node with children shows a smooth layout transition (or gracefully no-ops on any platform where `LayoutAnimation` is unsupported, without erroring) and the disclosure icon rotates rather than swaps glyphs, on all three platforms; `tsc` and the web build both pass.
