# 002 — Consolidate divergent press-feedback scale values into one token

- **Status**: DONE
- **Commit**: b2dddbb
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 5 files (`AppHeader.tsx`, `LocationBrowser.tsx`, `QuickActions.tsx`, `QuickAddFab.tsx`, `SwipeableRow.tsx`)

## Problem

Six near-identical hand-typed press-feedback scale values exist across the
codebase, all implementing the same "shrink slightly on press" feedback that
`components/AnimatedPressable.tsx` already centralizes as a `pressedScale`
prop defaulting to `0.96`:

```tsx
// components/AppHeader.tsx:136 — current
buttonPressed: { transform: [{ scale: 0.92 }] },
```

```tsx
// components/LocationBrowser.tsx:346 — current
upButtonPressed: { transform: [{ scale: 0.95 }] },
```

```tsx
// components/LocationBrowser.tsx:416 — current
buttonPressed: { transform: [{ scale: 0.97 }] },
```

```tsx
// components/QuickActions.tsx:79 — current
iconButtonPressed: { transform: [{ scale: 0.92 }] },
```

```tsx
// components/QuickAddFab.tsx:61 — current
fabPressed: { transform: [{ scale: 0.94 }] },
```

```tsx
// components/SwipeableRow.tsx:192 — current
webActionPressed: { transform: [{ scale: 0.9 }], backgroundColor: theme.colors.surfaceAlt },
```

Values found: `0.90`, `0.92` (×2), `0.94`, `0.95`, `0.97` — six variations of
the same interaction with no functional reason to differ, none matching the
`AnimatedPressable` default of `0.96`. Two of them (`0.90`, `0.92`) sit
outside this project's own established range once `AnimatedPressable` is
taken as the convention. Each of these five files also manually reimplements
the `Pressable` + `style={({pressed}) => [...]}` wiring that `AnimatedPressable`
already does once, correctly, in one place.

This finding depends on plan 001 (`001-native-press-feedback.md`) landing
first, because plan 001 rewrites `AnimatedPressable.tsx` to use Reanimated
instead of the non-functional CSS-only `pressTransition` token, and this
plan's fix is to route all five files through that same `AnimatedPressable`.
If plan 001 has not landed, `AnimatedPressable` still exists with a working
public API (`pressedScale` prop) even before its internals are fixed, so this
plan's structural changes (swapping `Pressable` for `AnimatedPressable`) are
valid either way — but do the motion feel-check in Verification only after
plan 001 has also landed, since before that the transition will still snap
instantly on native.

## Target

All six call sites converge on `AnimatedPressable`'s existing `pressedScale`
prop, explicit at each call site (do not silently change any button's feel —
pick the closest existing value per component, listed below), and stop
duplicating the `pressed &&` conditional-style pattern.

Example target for `components/AppHeader.tsx`'s back button (currently lines
~68-74 render + line 136 style):

```tsx
// components/AppHeader.tsx — target (back button)
<AnimatedPressable
  style={styles.backButton}
  pressedScale={0.92}
  onPress={handleBack}
  hitSlop={8}
  accessibilityLabel={t('common.back')}
>
  <Text style={styles.backIcon}>‹</Text>
</AnimatedPressable>
```

```tsx
// components/AppHeader.tsx — target (createStyles, buttonPressed style deleted entirely)
backButton: {
  width: 36,
  height: 36,
  borderRadius: theme.radius.full,
  backgroundColor: theme.colors.surfaceAlt,
  alignItems: 'center',
  justifyContent: 'center',
},
// buttonPressed: DELETED — AnimatedPressable now owns the pressed-scale transform
```

Per-file target `pressedScale` values (preserve each component's existing
feel exactly, just move it into the prop):

| File | Style key removed | `pressedScale` to pass |
| --- | --- | --- |
| `components/AppHeader.tsx` | `buttonPressed` (used by back button + 2 tool buttons) | `0.92` |
| `components/LocationBrowser.tsx` | `upButtonPressed` (up button, 1 usage: line 151) | `0.95` |
| `components/LocationBrowser.tsx` | `buttonPressed` (3 usages: `fabSecondary` line 238, `fab` line 245 — both convertible; `modalSave` line 307 — NOT convertible, see Steps) | `0.97` for the 2 convertible usages |
| `components/QuickActions.tsx` | `iconButtonPressed` (3 icon buttons: 🌐, theme toggle, ⚙️) | `0.92` |
| `components/QuickAddFab.tsx` | `fabPressed` | `0.94` |
| `components/SwipeableRow.tsx` | `webActionPressed` (2 web-only action buttons: ✏️ and 🗑) | `0.9` — **also drop the `backgroundColor: theme.colors.surfaceAlt` half of this style; see Steps 5 for how to preserve it** |

## Repo conventions to follow

- `AnimatedPressable` is already the established wrapper (`components/AnimatedPressable.tsx`), consumed by 13 other files with the plain `<AnimatedPressable style={...} onPress={...}>children</AnimatedPressable>` shape and optional `pressedScale` override — e.g. `components/UpgradeModal.tsx`'s close button, which passes no `pressedScale` (uses the `0.96` default). Follow that exact shape.
- Do not introduce a new prop name or wrapper — `pressedScale` is the established name.

## Steps

1. **`components/AppHeader.tsx`**: Replace the 3 `Pressable` elements that use `style={({ pressed }) => [X, pressed && styles.buttonPressed]}` with `AnimatedPressable style={styles.X} pressedScale={0.92}`. Delete the `buttonPressed` key from `createStyles`. Remove the `import { pressTransition } from '../lib/press'` line if plan 001 already removed the `...pressTransition` usage here (it should have — confirm no remaining reference before deleting the import) and remove the `Pressable` import from `react-native` if no other `Pressable` usage remains in the file (check first).
2. **`components/LocationBrowser.tsx`**: Confirmed exact usages by direct inspection (do not re-derive — use this list):
   - Line 151, `upButton` → convert to `AnimatedPressable pressedScale={0.95}`. Delete `upButtonPressed` (line 346) once converted.
   - Line 238, `fabSecondary` → convert to `AnimatedPressable pressedScale={0.97}`.
   - Line 245, `fab` → convert to `AnimatedPressable pressedScale={0.97}`. Once both line 238 and 245 are converted, delete the `buttonPressed` style key (line 416) — but only after confirming line 307 (below) no longer references it either, or handling line 307 first.
   - Line 307, `modalSave` — **do NOT convert**. Its style array is `[styles.modalSave, (isSaving || !newLocationName.trim()) && styles.buttonDisabled, pressed && styles.buttonPressed]`: it combines a *third* conditional style (`buttonDisabled`, driven by save-in-progress/empty-input state, not by press) with the press-scale. `AnimatedPressable` has no mechanism for an additional external conditional style layered with its own internal pressed-scale. Leave this `Pressable` exactly as-is, manual, unconverted. This means `buttonPressed` (line 416) CANNOT be deleted until this usage is also migrated in a future plan — leave the style key in place after converting lines 238/245, do not delete it in this plan.
   - Line 196 and 214, both `row` (location row / item row) → uses `rowPressed` (line 371), which is `{ backgroundColor: theme.colors.surfaceAlt }` — **no scale at all**. Leave both as manual `Pressable`, unconverted; out of scope (this plan only consolidates scale-based feedback).
   - Line 295, `modalCancel` → uses `modalCancelPressed` (line 451), also `{ backgroundColor: theme.colors.surfaceAlt }` only, no scale. Leave as manual `Pressable`, unconverted.
3. **`components/QuickActions.tsx`**: Replace all 3 `Pressable` icon buttons with `AnimatedPressable style={styles.iconButton} pressedScale={0.92}`. Delete `iconButtonPressed`.
4. **`components/QuickAddFab.tsx`**: Replace the single FAB `Pressable` with `AnimatedPressable style={styles.fab} pressedScale={0.94}`. Delete `fabPressed`.
5. **`components/SwipeableRow.tsx`** (web-only branch, `Platform.OS === 'web' && !hasTouchInput()`): The two `Pressable` elements here combine a scale change AND a `backgroundColor` change on press (`webActionPressed: { transform: [{ scale: 0.9 }], backgroundColor: theme.colors.surfaceAlt }`). `AnimatedPressable`'s `pressedScale` prop only handles scale — it does not handle a simultaneous background color swap. Two valid options, pick whichever keeps the diff smaller:
   - (a) Leave these two `Pressable` elements as manual `style={({pressed}) => [...]}` (unchanged), since they combine two different visual properties and are out of `AnimatedPressable`'s single-purpose scope. This is the recommended option — it matches the guidance in Step 2 for `rowPressed`/`modalCancelPressed`.
   - (b) If choosing to convert anyway: wrap in `AnimatedPressable style={[styles.webActionButton, {backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent'}]} pressedScale={0.9}` — but `AnimatedPressable` does not expose a `pressed` render-prop today, so this would require extending its API, which is out of this plan's scope (see Boundaries). **Use option (a).**
6. After all edits, grep the whole `components/` directory for `pressed &&` and `pressTransition` to confirm no dangling references or unused imports remain in the 5 files this plan touches.

## Boundaries

- Do NOT touch any of the 13 files that already call `AnimatedPressable` correctly (`AccountSettingsModal.tsx`, `AddItemModal.tsx`, `AllItemsModal.tsx`, `EditItemModal.tsx`, `EditLocationModal.tsx`, `LanguagePicker.tsx`, `LocationBreadcrumb.tsx`, `LocationPicker.tsx`, `LocationTreeModal.tsx`, `LocationTreeNode.tsx`, `QuickAddModal.tsx`, `UpgradeModal.tsx`) or `SearchBar.tsx`'s `resultRow` (its background-color-on-press pattern is a deliberate, different, and already-correct feedback style for list rows — do not convert it).
- Do NOT extend `AnimatedPressable`'s API to support combined scale+color feedback — leave `rowPressed`, `modalCancelPressed`, and `webActionPressed` (SwipeableRow web branch) as manual `Pressable` usages per Step 2/5.
- Do NOT change any of the six numeric scale values — they are being relocated into `pressedScale` props verbatim, not redesigned. (A future, separate finding could argue for actually unifying them to one value; this plan only removes the duplication of *mechanism*, not the numbers themselves.)
- If `LocationBrowser.tsx`'s `buttonPressed`/`rowPressed` keys are used by more call sites than listed above once you read the full file, STOP and report the discrepancy rather than guessing which ones are safe to convert.

## Verification

- **Mechanical**: `npx tsc --noEmit` — zero errors. `npx expo export --platform web --clear` — build succeeds.
- **Feel check** (do this after plan 001 has also landed, so the underlying transition mechanism is real):
  - Press and release the back button in `AppHeader` — confirm it still shrinks to roughly 92% of its size (a visibly tighter shrink than the app's other `0.96`-default buttons, e.g. "Zapisz" in `EditItemModal`).
  - Press the 3 icons in `QuickActions` (🌐, theme toggle, ⚙️) — same ~92% shrink as the back button (both now share `pressedScale={0.92}`).
  - Press the floating "+" button (`QuickAddFab`) — confirm a visibly slightly larger shrink than the header buttons (94% vs 92%), matching its pre-existing feel.
  - Press the "↑ Do góry" button in `LocationBrowser` — confirm ~95% shrink.
  - On desktop web only, hover-and-click the ✏️/🗑 buttons revealed by `SwipeableRow`'s web branch — confirm they still shrink to ~90% AND still show the `surfaceAlt` background tint (both effects, since Step 5 chose option (a) and left this pattern manual).
- **Done when**: `grep -rn "upButtonPressed:\|iconButtonPressed:\|fabPressed:" components/*.tsx` returns zero results (these three fully-scale-only tokens are gone). `buttonPressed:` in `LocationBrowser.tsx` is EXPECTED to still exist (kept for the unconverted `modalSave` usage at line 307 — this is correct, not a leftover). `tsc` and the web build both pass, and every feel-check above matches its pre-existing per-component scale value.
