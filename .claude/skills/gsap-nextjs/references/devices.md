<!-- Generated from shared/devices.md; run scripts/sync_initialization.py. -->

# Devices and input

The framework skill owns device tiers, measurements, and budgets. Motion recipes consume them.

## One capability query

Use capability queries, not user-agent strings. Check installed GSAP docs before adapting:

```ts
const mm = gsap.matchMedia();
mm.add(
  {
    all: "all", // Run even when every capability query is false.
    reduce: "(prefers-reduced-motion: reduce)",
    hover: "(hover: hover)",
    coarse: "(pointer: coarse)",
    narrow: "(max-width: 767px)",
  },
  (ctx) => {
    const { reduce, hover, coarse, narrow } = ctx.conditions!;
    // Build this tier's timelines. Return cleanup for non-GSAP resources.
  },
);
```

- Preserve app-level reduced-motion overrides; `matchMedia` sees only OS preferences. Rebuild when the override changes.
- Queries describe the primary input. Use each event's `pointerType` for hybrid-device interactions.
- Tier changes revert and rebuild GSAP effects. Preserve settled content; never replay entrances. Revert `mm` at the owner's cleanup boundary.

## Viewport and orientation

- Debounce root-width changes; rebuild affected splits and refresh pin measurements. Ignore browser-chrome height changes for text splitting.
- On orientation changes during intro, settle before rebuilding; do not replay.
- Full-height covers use supported `dvh` or `svh`, with a `vh` fallback.
- Reserve stable geometry at every breakpoint.

## Touch and scroll

- Preserve native scrolling and `touch-action`; decoration must not capture gestures.
- Controls work without hover. Touch presses end on `pointerup`, `pointercancel`, or `pointerleave`.
- Track keyboard versus pointer input. `:focus-visible` alone cannot distinguish them on text fields.
- Use the official `gsap-scrolltrigger` skill for scrub, pinning, and scroll normalization.

## Budgets

- Coarse or narrow tiers: fewer visible targets, shorter intros, and bounded staggers.
- Prefer transforms and `autoAlpha`; measure filters and large clip-path tweens before using them.
- Reduce particle `density` and wave character counts. Cap canvas pixel ratio at 2.
- Treat `hardwareConcurrency` and `deviceMemory` as optional hints that can only lower budgets.

## Backgrounded pages

Hidden tabs can suspend frame callbacks. Bound frame and timeline waits with timeouts; settle stalled phases.

## Verify

- Phone width: readable text, stable boxes, no horizontal overflow.
- Touch buttons and text fields: release and swipe cancellation leave no lingering hot state.
- Keyboard focus and mouse hover still work, including after touch input.
- No capability queries match: default phase setup still runs.
- Rotate during intro and at settled: rebuild without flashes or replay.
- Throttle CPU 4x: lower budgets if idle frame pacing fails.
- Reduced motion on coarse input: same settled state and completion callbacks.
- Test momentum scrolling and browser-chrome resizing on a real device when practical.

Report device tests separately from emulation.
