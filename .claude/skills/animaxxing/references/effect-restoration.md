# Effect restoration

Apply when adapting any recipe. Each recipe rolls back its own setup when construction throws (`guarded` or `own`) and reverts on interruption where its return shape allows; keep that when copying. The `gsap-<framework>` skill owns initialization deadlines, visit tokens, navigation, and recovery timing; its controller needs rollback registered before setup, not only a handle returned after.

## Builder guarantees

- Capture original values only for properties and DOM the effect changes. Preserve existing inline styles, accessible text, nested links, and controls.
- Acquire resources inside a guarded setup block and register each disposer immediately, before the next operation can throw. A split made before a later tween fails still needs reverting.
- On a construction exception, stop acquired work, undo partial changes, and rethrow for the framework to settle. Attempt every disposer even if one fails; never wait for an `onComplete` that will not run.
- Return an idempotent teardown or register one with the controller. Timeline-only builders need context ownership plus explicit teardown for non-GSAP resources; `timeline.kill()` alone does not restore the DOM.
- Stop writers before restoring values: timelines, delayed calls, tickers, resize/font observers, and pointer/focus listeners. The controller invalidates async work before teardown.
- Revert nested splits inside out; use plugin revert handles on isolated text leaves. SplitText revert rebuilds descendants from saved HTML, losing node identity and listeners, so keep framework-bound children and controls outside the split target or animate a separate visual copy. Never restore a framework subtree from your own saved `innerHTML`. Restore ARIA changes without duplicating accessible text.
- Undo effect-owned masks, clipping, child opacity, transforms, weight, pinned widths, and suspended CSS transitions. Preserve normal hidden states and unrelated styles; avoid `clearProps: "all"` on shared targets.
- A disposer only restores its changes. It never navigates, releases route locks, moves focus, replays ambient effects, or picks the visible page; the controller applies the settled or end state afterward.

## Recipe-specific resources

| Recipe | Teardown must cover |
|---|---|
| Split entrances / route letters | Timelines, every split, masks, original item styles, and any suspended CSS transition. |
| Speak-in | Nested word/character splits, persistent tilt/weight finishes, widths, and timeline callbacks. |
| Wave | Scheduled next cycles, active tweens, splits, pinned glyph widths, and inline weight. |
| Scroll effects | Triggers, pin spacers, splits, scrubbed and reveal tweens, the settle tween, focus listeners, the run's `overflow`, the header's `data-nav-theme` and the root's scroll direction attributes, and inline motion values a pinned revert leaves behind. Inner `containerAnimation` triggers first. |
| Pointer effects | Listeners, `quickTo` values and inertia throws left inline, every trail image, the cursor label's track children and loop, `--pointer-*` properties, the `Draggable` and any throw in flight, its inline touch and selection styles, observers, and the viewport's `overflow`. |
| SVG effects | Draw timelines, stroke dash styles, the original `d` of a morphed path, the follower's transform and origin, and any morph in flight. |
| Counters and marquees | The count tween, original text, reserved width, the counting and visually hidden spans, the marquee strip and clones, observers, listeners, and the hover ease; the logo cycle's swap and timer, each logo's original parent and order, and its exact `style` attribute. |
| Blast-off | Tweens and splits across the composition, including container transforms and button changes. |
| Smooth scroll | The engine's ticker callback and scroll listener, its classes and inline styles on the document or wrapper, and a stopped state. |
| Page covers | The running sweep, panel transforms and visibility, pointer blocking, the title's text and styles, and the preloader's count, bar, `aria-valuenow`, and position. |
| Media effects | Reveal timelines and their inline clip and transform, preview layers and `aria-hidden`, `quickTo` values, the video's `muted` and `playsInline` and its deferred tween and trigger, the sequence's observer, in-flight image requests, and canvas width and height attributes. |
| Component motion | The timeline in flight; the menu panel's `visibility` and `clip-path` and its links' opacity and transforms; the dialog's `cancel` and `close` listeners, opacity, transform, and `--dialog-backdrop`; the disclosure's inline `height` and `overflow`; the indicator's transform, origin, and observer. Never the dialog's `open`, `hidden`, or ARIA. |
| Hover effects | Listeners, tweens started from them, the roll's mask and copy with the label's original nodes moved back, the underline span and the link's position, the image's transform and the frame's overflow. |
| Endless drag | The throw or deal in flight and the velocity tracker, the Draggable, landing tweens, the wheel's rest call, the drift ticker, observers, listeners, every clone, item and tile transforms and sizes, the grid's `data-drag-grid`, the deck's `data-flick` and each card's `inert`, and every `style` attribute under the viewport exactly as it was, including none. |
| Physics effects | The run's timeline and every spawned piece, and its share of the live budget. Never the shared layer. |
| Section pager | The move in flight, the Observer, key and focus listeners, section transforms and `z-index`, the container's `data-pager`, and the document's `overflow` and `overscroll-behavior`. |
| Sound cues | Gesture and visibility listeners, in-flight file loads, every sounding source, and the audio context. Never the toggle or stored preference. |
| Layout Flip | A running Flip: `revert()` jumps it to the end and clears its inline styles; `kill()` alone leaves them. |
| Particle field/effects | Ticker callbacks, emitters, particles/tweens, delayed calls, observers, event listeners, effect-owned canvas/wrapper styles, and the target's inline opacity, visibility, transform, and clip. |

Reduced motion completes normally without creating split or particle resources. Teardown must be safe after an early return or a completed run. The controller decides whether essential completion still runs once.
