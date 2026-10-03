# Motion vocabulary

Select and adapt effects. Recipes hold the code; existing design or a selected style decides which surfaces receive them.

## Tokens

Editable starting points; reuse the app's motion values where they exist. Durations and distances: micro 0.14s / 4px, component 0.2s / 8px, page 0.28s / 16px. Eases: entrance `power2.out`, exit `power2.in`, shift `power2.inOut`. Display sequences may run longer. Timeline defaults: `{ overwrite: "auto" }`.

### Signature curves

A brand curve belongs to the app, not to a recipe. Register it once with [CustomEase](https://gsap.com/docs/v3/Eases/CustomEase/) (free since GSAP 3.13), in the client module that registers plugins, before any builder runs:

```ts
// Example: one named curve for the whole site, registered at startup.
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(CustomEase);
CustomEase.create("signature", "M0,0 C0.2,0 0.1,1 1,1");
```

- Every recipe `ease` option takes the registered name as a string: `disclosure(panel, { ease: "signature" })`, `playShared(state, target, { ease: "signature" })`, `dragLoop(viewport, track, { ease: "signature" })`.
- Recipe constants such as `EASE`, `ROLL`, and `FOLLOW_EASE` accept it too, in the copied module.
- Recipe defaults stay the plain GSAP eases above; the app opts in per surface.
- Name curves by role (`signature`, `signature-exit`), keep one or two, and register before the first build: an unregistered name falls back to GSAP's default ease.
- Reduced motion is unaffected: a curve shapes motion that runs, and reduced paths set end states.

Animate only transforms, `autoAlpha`, `clip-path`, blur, and `fontWeight`; never `width`, `height`, `top`, `left`, `color`, or `display`. The sole exception is [`disclosure`](recipes/component-motion.md#disclosure), which tweens one panel's `height`.

Reduced motion `set()`s the documented entrance or exit state, so timelines complete and callbacks fire.

```ts
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
```

`data-motion="full"` or `"reduced"` on `<html>` is an optional app override for reviewing reduced motion; builders read it at build time. Use the project's existing helper if it has one. Another `data-motion` value, such as a `js` boot marker, falls through to the media query; rename one if the app needs both.

## The shelf: paired entrances and exits

In/out pairs from one factory. Try them, then promote the one a screen uses under a name for its purpose.

```ts
import gsap from "gsap";

type MotionOptions = { delay?: number; stagger?: number; onComplete?: () => void };
type MotionTarget = gsap.TweenTarget;
type Pair = (target: MotionTarget, options?: MotionOptions) => gsap.core.Timeline;

function build(options: MotionOptions): gsap.core.Timeline {
  const tl = gsap.timeline({ delay: options.delay ?? 0, defaults: { overwrite: "auto" } });
  if (options.onComplete) tl.eventCallback("onComplete", options.onComplete);
  return tl;
}

/** Builds an in/out pair from vars, with the reduced path handled once. */
function pair(from: gsap.TweenVars, to: gsap.TweenVars, settledIn: gsap.TweenVars, outVars: gsap.TweenVars): [Pair, Pair] {
  const entrance: Pair = (target, options = {}) => {
    const tl = build(options);
    if (prefersReducedMotion()) return tl.set(target, { autoAlpha: 1, ...settledIn });
    return tl.fromTo(target, from, { ...to, stagger: options.stagger ?? 0 });
  };
  const exit: Pair = (target, options = {}) => {
    const tl = build(options);
    if (prefersReducedMotion()) return tl.set(target, { autoAlpha: 0 });
    return tl.to(target, { ...outVars, stagger: options.stagger ?? 0 });
  };
  return [entrance, exit];
}

const SETTLED = { x: 0, y: 0, scale: 1, rotationX: 0, filter: "blur(0px)" };
```

| Pair | From | In | Out | When |
|---|---|---|---|---|
| `fadeIn` / `fadeOut` | `{ autoAlpha: 0 }` | `{ autoAlpha: 1, duration: 0.2, ease: "power2.out" }` | `{ autoAlpha: 0, duration: 0.14, ease: "power2.in" }` | The plainest thing there is. |
| `riseIn` / `riseOut` | `{ autoAlpha: 0, y: 8 }` | `{ autoAlpha: 1, y: 0, 0.2, power2.out }` | `{ autoAlpha: 0, y: -4, 0.14, power2.in }` | The workhorse: anything just committed. |
| `dropIn` / `dropOut` | `{ autoAlpha: 0, y: -8 }` | `{ y: 0, 0.2, power2.out }` | `{ y: 4, 0.14, power2.in }` | Things that interrupt: a status, a banner. |
| `slideInLeft` / `slideOutLeft` | `{ autoAlpha: 0, x: -16 }` | `{ x: 0, 0.2, power2.out }` | `{ x: -8, 0.14, power2.in }` | A pane from the left edge. Mirror for right. |
| `scaleIn` / `scaleOut` | `{ autoAlpha: 0, scale: 0.96 }` | `{ scale: 1, 0.2, power2.out }` | `{ scale: 0.98, 0.14, power2.in }` | Reads as focus, not zoom. |
| `popIn` / `popOut` | `{ autoAlpha: 0, scale: 0.4 }` | `{ scale: 1, 0.2, "back.out(2.4)" }` | `{ scale: 0.6, 0.14, "back.in(2)" }` | Small and infrequent. |
| `wipeUp` / `wipeDown` | `{ clipPath: "inset(0% 0% 100% 0%)" }` | `{ clipPath: "inset(0% 0% 0% 0%)", 0.28, power2.out }` | `{ clipPath: "inset(100% 0% 0% 0%)", 0.2, power2.in }` | The most editorial. Settled vars: the open inset. |
| `wipeAcross` / `wipeBack` | `{ clipPath: "inset(0% 100% 0% 0%)" }` | same, 0.28 | `{ clipPath: "inset(0% 0% 0% 100%)", 0.2 }` | Rules, bars, code lines. |
| `flipIn` / `flipOut` | `{ autoAlpha: 0, rotationX: -60, transformPerspective: 800, transformOrigin: "50% 0%" }` | `{ rotationX: 0, 0.28, power2.out }` | `{ rotationX: 25, 0.2, power2.in }` | The loudest. Almost never. |
| `focusIn` / `focusOut` | `{ autoAlpha: 0, filter: "blur(8px)" }` | `{ filter: "blur(0px)", 0.28, power2.out }` | `{ filter: "blur(6px)", 0.2, power2.in }` | Costly to paint; one element at a time. |
| `weightIn` / `weightOut` | `{ autoAlpha: 0, fontWeight: 400, y: 4 }` | `{ fontWeight: 800, y: 0, 0.28, power2.inOut }` | `{ fontWeight: 400, 0.2, power2.inOut }` | Type that gains its weight as it arrives. Settled: `{ fontWeight: 800, y: 0 }`. |

Cells abbreviate `duration` and `ease`; they are not copyable literals. Entrances merge `autoAlpha: 1` into the destination and exits merge `autoAlpha: 0`, except wipes, which hold `autoAlpha: 1` and animate only the clip. Pass the matching settled vars to `pair`.

## Split families

Character effects are for display type. Keep reading text immediately readable; speak-in is for short display copy only.

| Family | Split | Move | Role |
|---|---|---|---|
| `charsRiseIn` | chars, masked | `yPercent: 115 → 0`, 0.5s, `power3.out`, stagger 0.03 | Masked character reveal. Check [mask ink clearance](text-stability.md#apparent-weight-change-from-clipped-glyph-ink) for tight type. |
| `charsSpringIn` | chars, unmasked | `yPercent: 115`, `autoAlpha`, 1.1s, `elastic.out(1, 0.5)` | An elastic character entrance. Unmasked because the overshoot would clip. |
| `charsCascadeIn` / `Out` | chars | `y: -18`, random `rotation ±14`, `back.out(1.8)`, stagger 0.02 from random | A dealer flicking cards. |
| `charsFlipIn` / `Out` | chars | `rotationX: -90` about the top edge | Each letter tips over. |
| `charsScatterIn` / `Out` | chars | random `x ±120`, `y ±60`, `rotation ±45`, `scale 0.6`, `power3.out`, stagger from center | Letters converge from wherever they were thrown. The route version scales the spread to the viewport. |
| `charsWeightWave` | chars, widths pinned | `fontWeight` dips to the far end of the axis and back, stagger 0.03 | A wave of weight through a line. |
| `wordsSlideIn` / `Out` | words | `x ±40` alternating sides, `power2.out`, stagger 0.05 | Words zip together. |
| `linesMaskIn` / `Out` | lines, masked | `yPercent: 110 → 0`, 0.28s, `power3.out`, stagger 0.05 | Whole lines wiped up behind masks. |
| `linesEllipseIn` / `Out` | lines, masked | mask `clip-path: ellipse(20% 0%)` swells to cover the line from its bottom edge while the line rises `yPercent 40 → 0`, 0.8s, `power3.out`, stagger 0.05 | A softer, rounder line reveal for display copy. |
| `linesHighlightIn` / `Out` | lines, words | a `--line-highlight` bar sweeps `scaleX 0 → 1` over each line's words, the words appear, the bar retracts toward the line end; 0.12s between lines | A marker pass across a statement or pull quote. |
| `scrambleIn` / `Out` | none | ScrambleText over `01{}/<>()=;` | Text resolving out of noise. Display only; needs ScrambleTextPlugin. |

Split runners use `aria: "auto"`, revert on completion, and never split under reduced motion. Weight moves pin each character to its width at the heaviest weight it reaches (`inline-block`, centered) so the axis moves without reflow. Code: [split-entrances.md](recipes/split-entrances.md).

## Route grammar

Page-transition items opt in with `data-page-transition`; no particular layout is required. The intro runs in document order, the outro in reverse. A page with no marked items animates as one item. The controller sets swap timing.

| Value | Entrance | Exit |
|---|---|---|
| `""` (standard) | `autoAlpha 0, y 16 → 0`, 0.42s, `power3.out`, stagger 0.09. Starts at `enter+=0.89` when the page has letters, else at `enter`. | `autoAlpha 0, y -8`, 0.22s, `power2.in`, each item 0.055s after the previous. |
| `letters` | Split to chars. Each starts at random `x ±60vw`, `y ±60vh`, `rotation ±90`, `scale 0.5`, hidden. After a 0.75s hold, 0.75s `power4.out`, stagger 0.02 from random. | Chars fly back out to the same spread at `scale 1.6`, 0.28s, `power2.in`, stagger 0.012 from edges, 0.1s after the standard items start. |
| `letters-sides` | Chars alternate from `x ∓60vw`, no vertical spread. 0.6s `power4.out`, stagger 0.012 from center, starting 0.14s after the letters. | Same sides, 0.24s, stagger 0.008 from center. |
| `slide-horizontal` | `autoAlpha 0, x -16 → 0`, 0.2s, `power2.out`, 0.09s after the standard items. Its own CSS transition is suspended for the tween. | `x 8`, 0.14s, `power2.in`. |

Reduced motion sets items to `autoAlpha: 1` on enter and `0` on exit. Code: [route-letters.md](recipes/route-letters.md).

### Transition state

The page container can report its phase on `data-transition-state`:

| Value | Framework phase | Meaning |
|---|---|---|
| `entering` | intro | The intro timeline is running. Surface effects that play alongside it start here. |
| `idle` | settled | Intro complete, splits reverted, temporary styles cleared. Effects that need the letters back (the wave) start here. |
| `exiting` | outro | The outro is running. Every effect winds down. |
| `waiting` | end state | The outro finished. The page is sealed until the framework swaps it. |

The labels are optional mirrors of the controller's phase state. The controller calls surface controls directly; recipes never observe them.

### Pre-paint hiding

The controller's pre-paint/no-script mechanism hides recipe targets (`data-page-transition`, `data-speak-intro`, `data-hero-actions`, `data-particle-card`, and any shell/logo/footer intro hooks) only until their initial values are set; `autoAlpha: 1` reveals them. A hidden particle wrapper needs its own reveal.

Register rollback before hiding or splitting; removing a CSS marker does not undo partial changes ([effect restoration](effect-restoration.md)). The framework skill's `references/initialization.md` owns deadlines, late-work guards, and any `waiting` swap barrier. Add no unconditional hiding CSS or readiness mechanism here.

## Scroll grammar

Scroll effects follow reading position, not page phase. Use at most one scrubbed treatment per viewport; reading text never moves with scroll. Code: [scroll-effects.md](recipes/scroll-effects.md).

| Effect | Move | Role |
|---|---|---|
| `revealOnScroll` | `opacity 0, y 16 → 0`, 0.42s, `power3.out`, stagger 0.09, batched, once | The workhorse below the fold: sections, cards, figures. |
| `scrubStatement` | words `opacity 0.15 → 1`, scrubbed through the reading zone | One display statement filling in as it is read. |
| `parallax` | `y ∓ data-parallax` px, scrubbed across the section | Depth between media and captions. Small travel. |
| `pinnedScene` | caller's timeline, pinned for `length` section heights | Steps, a product reveal, a diagram assembling. The loudest; one per page. |
| `horizontalRun` | track `x → -overflow`, pinned | A gallery or timeline run sideways. Native scroller when skipped. |
| `runDrift` | `[data-run-drift]` items `x ∓ travel` px as each crosses the run's viewport | Depth inside a horizontal run: images slide within their frames. |
| `scrollWaypoints` | one element `Flip.fit`s onto each later `[data-waypoint]` marker, scrubbed so it lands as the marker reaches the viewport's middle | A product shot docking beside each feature. One traveller per page. |
| `scrollProgress` | `scaleX 0 → 1` from the left edge | A hairline reporting position. Runs under reduced motion. |
| `velocitySkew` | `skewY` up to ±8°, springs back in 0.8s | Ambient energy on media columns. Never on reading text. |
| `navTheme` | Header `data-nav-theme` follows the `[data-nav-theme]` section under its middle; CSS transitions the colors | Light type over a dark hero, dark over a light page. Runs under reduced motion. |
| `scrollDirection` | Root `data-scroll-direction` flips after 8px of travel the other way; `data-scroll-started` past 50px | A header that hides going down and returns going up, in CSS. Runs under reduced motion. |

Two presets need no builder of their own. **Plop-in**: `revealOnScroll` with `scale: 0`, `rotation: -20`, `y: -32`, and `elastic.out(1, 0.72)`, for stickers and badges. **Footer reveal**: a sticky footer under the content plus `parallax(footer, { end: "bottom bottom" })` on a layer inside it. Both are in [scroll-effects.md](recipes/scroll-effects.md).

Scrubs smooth with `scrub: 0.6`; parallax locks to the scrollbar. Build phases: [controller contract](recipes/scroll-effects.md#controller-contract).

## Figures, marquees, and SVG

| Effect | Move | Role |
|---|---|---|
| `drawIn` / `drawOut` | DrawSVG `0% → 100%`, 0.8s, `power2.inOut`, stagger 0.12 | Lines, diagrams, and signatures drawing themselves. |
| `morphToggle` | MorphSVG to the alternate shape, 0.35s, `power2.inOut` | Menu to close, play to pause. Follows the control's state. |
| `followPath` | MotionPath along a path, 6s a lap, linear | A mark tracing a route. Ambient. |
| `morphScrub` | MorphSVG toward the alternate shape, scrubbed from `top bottom` to `top top` | A curved section edge flattening as the section arrives. |
| `countUp` | 0 to the element's own value, 1.6s, `power3.out` | Statistics landing on their figure. Width reserved. |
| `marquee` | Row loops by its own width at 60px/s | Logos, tags, or a running headline. Needs a pause control. |
| `logoCycle` | Every 2s one cell's logo slides out `yPercent -100` as the next from the pool slides in, 0.6s `power3.inOut` | A client wall with more logos than cells. Needs a pause control. |
| `dragLoop` | Row wraps endlessly under drag, throw, and sideways wheel; lands on an item in 0.6s, `power3.out`; optional drift | A throwable gallery with no ends. Drift needs a pause control. |
| `dragGrid` | Tiles wrap on both axes under drag, throw, and wheel; focus centers a tile | A pannable canvas of work, often full screen. |
| `flickCards` | Front card `0`, neighbors `xPercent ±25/±45`, `rotation ±10/±15`, `scale 0.9/0.8`; a drag or flick deals the next card, 0.8s `elastic.out(1, 0.8)` | A deck of featured work or testimonials. Only the front card is reachable; pair with previous and next buttons. |

Code: [svg-effects.md](recipes/svg-effects.md), [counters-and-marquees.md](recipes/counters-and-marquees.md), [endless-drag.md](recipes/endless-drag.md).

## Covers, layout, and scroll feel

| Effect | Move | Role |
|---|---|---|
| `curtain` | Panels `yPercent 100 → 0 → -100`, 0.6s each way, `power3.inOut`, stagger 0.06 | A full-screen wipe hiding a route swap. From the persistent shell; the loudest transition there is. |
| `curtain` with `tilt` or `title` | Panels lean `tilt°` in, straighten, and tip the other way out; the title fades up once covered and out before the reveal | A page that swings away, or a cover naming the page it opens on. One oversized panel suits a tilt. |
| `curtain` with `wipe` or `drift` | Panels hold still while `clip-path` opens from the entry edge and closes toward the far edge; content travels 20% of the viewport with the sweep | A clean polygon wipe, and a page pushed away then trailing in behind the cover. |
| `curveCover` | One SVG shape sweeps in with its edge's middle bowed up to 30% ahead, flattening as it covers; the reveal carries the trailing edge out the far side, 0.8s `power3.inOut` | A liquid alternative to the curtain for the same route swap. One color. |
| `preloader` | Count eases to reported readiness; lifts `yPercent -100`, 0.7s, `power4.inOut` | First visit only, while real dependencies arrive. |
| `captureLayout` | Flip from old boxes to new, 0.5s, `power2.inOut`; entering items fade and grow, leaving items fade and shrink | Filters, reorders, and panels that open in place. |
| `captureShared` / `playShared` | Flip from one element's box onto its counterpart, 0.7s, `power3.inOut` | A thumbnail becoming the next page's hero. One per navigation. |
| `lenisScroll` / `smootherScroll` | Eased document scrolling | The whole site's feel. Once per document, never per page. |

A curtain or curve cover and a shared-element morph never share a navigation: the cover would hide the morph's element. The framework skill's `references/transition-archetypes.md` and `references/smooth-scroll.md` own their timing. Code: [page-covers.md](recipes/page-covers.md), [layout-flip.md](recipes/layout-flip.md), [smooth-scroll.md](recipes/smooth-scroll.md).

## Media, components, and hover

| Effect | Move | Role |
|---|---|---|
| `menuOverlay` | panel clip inset 100 → 0 from an edge, 0.5s, `power3.inOut`; links `autoAlpha 0, y 16 → 0`, 0.4s, stagger 0.05 | A full-screen menu. Close runs back from wherever the open is. |
| `enterExit` | caller's entrance to a pause, then a different exit; closing mid-entrance reverses at 1.5× speed, reopening mid-exit returns to the pause | A menu that springs in and tumbles out. Pair with `easeReverse` on 3.15+. |
| `dialogMotion` | `--dialog-backdrop 0 → 1`, panel `opacity 0 → 1` with `scale 0.96`, or `xPercent`/`yPercent ±100` for a drawer, 0.3s, `power3.out`; exit 0.21s `power2.in`, then `dialog.close()` | Native `<dialog>` enter and exit. Escape runs the exit. |
| `disclosure` | `height 0 ↔ auto`, 0.3s, `power2.inOut`, `overflow: hidden` only while moving | An accordion panel. The one sanctioned layout tween. |
| `tabIndicator` | `x` and `scaleX` from its own resting box onto the tab, 0.3s, `power3.out` | The selected tab's underline or pill. Re-fits on resize. |
| `imageReveal` | frame `clip-path inset` closed → open, 1s `power3.inOut`; image `scale 1.15 → 1`, `power2.out` | Editorial image entrance; `onScroll` variant for galleries. Clip only, never hidden. A CSS `mask` on the frame opens the image inside a brand shape. |
| `hoverPreview` | one image follows the mouse (`quickTo` 0.35s), 0.25s crossfade on item change | Work lists and indexes. Mouse-only decoration; the link stays the way in. |
| `proximity` | each item's `scale` up to 1.6 and optional `lift` by pointer distance within 160px, shaped by `sine.inOut`, `quickTo` 0.3s | A dock of icons or a thumbnail grid rippling under the cursor. Mouse-only decoration. |
| `imageTrail` | an image every 80px of mouse travel pops in with `back.out(2)`, drifts with the pointer, and shrinks away over 0.9s; at most 10 alive | A hero or work index with images spilling from the cursor. Never over reading text. |
| `cursorFollower` with `label` | over `[data-cursor-text]`, the dot gives way to a pill scrolling that text at 60px/s | "View project" on work links. Restates the link; `aria-hidden`. |
| `scrubVideo` | `currentTime 0 → duration`, scrubbed across a section | A product turn or process read at scroll speed. Poster under reduced motion. |
| `frameSequence` | canvas frame `0 → n-1`, nearest loaded frame, scrubbed | An image sequence with bounded loading; one per page. |
| `textRoll` | label `yPercent 0 → -travel`, copy `travel → 0`, 0.35s, `power3.out` | A button or link label rolling over to itself on hover and focus. Whole label, no split. |
| `underlineSweep` | `scaleX 0 → 1` from the inline start, `1 → 0` toward the inline end, 0.3s, `power2.out` | An injected hairline under a link; `--underline-*` custom properties restyle it. Instant under reduced motion. |
| `imageZoom` | `scale 1 → 1.05`, 0.6s, `power2.out`, inside a clipped frame | A card's image answering the card or its link; never clip the card itself. |

Code: [media-effects.md](recipes/media-effects.md), [component-motion.md](recipes/component-motion.md), [hover-effects.md](recipes/hover-effects.md).

### Interruption

Anything the visitor can toggle gets interrupted. Choose one of two patterns per component.

| Pattern | How | Use when |
|---|---|---|
| Rebuild | Kill the running timeline, then build the next with `to` tweens from current values | The close retraces the open: `menuOverlay`, `dialogMotion`, `disclosure`, `tabIndicator`. |
| Reverse | One timeline, entrance and exit split by `addPause()`; reverse it to take back a half-played move | The exit differs from the entrance: [`enterExit`](recipes/component-motion.md#enterexit). |

- Rebuilt entrances also use `to` from the rest state `set()` at build, so a reopen mid-exit never snaps back to the start.
- A reversed tween runs its ease backwards by default. Overshoot eases (`back`, `elastic`) then linger before they retreat.
- `easeReverse` (GSAP 3.15+) gives the reverse direction its own ease, from wherever the playhead turned. `true` reuses the forward ease; a name picks another. It replaces `yoyoEase`.
- Pairing: `back.out` or `elastic.out` in, `power3.in` or `power2.in` in reverse, so a changed mind gets out of the way. Registered signature curves work here too.
- A faster reverse helps: `timeScale(1.5)` for the reversal only, then back to 1.
- Before 3.15, leave `easeReverse` out. Older GSAP reads it as a property to animate.

## Physics

| Effect | Move | Role |
|---|---|---|
| `burst` / `burstFrom` | Pieces launch 500–900px/s in a 70° cone, fall at 1200px/s², spin, and fade over the last third of 1.4s | Confetti from a pressed button: a vote, a purchase, a finished form. |
| `rain` | Pieces drop from above the layer at 80–240px/s under 900px/s², spread over 1.2s, and fall out the bottom | Emoji or icons falling over a section for a moment. |

Pieces live in one fixed, `aria-hidden` layer from the shell, share a 120-piece budget (60 on coarse pointers), and remove themselves. Never gate an action on a run. Code: [physics-effects.md](recipes/physics-effects.md).

## Paging and sound

| Effect | Move | Role |
|---|---|---|
| `sectionPager` | next section `yPercent ±100 → 0` over the current, which drifts `0 → ∓30`, 0.9s, `power3.inOut`; one move per gesture | A site told in full-screen chapters. Owns the viewport; the stacked page is the no-script state. |
| `soundCues` | Web Audio one-shots with ±40 cent spread, 4 voices, 60ms per-cue gap; beds fade 1.5s | Clicks, rolls, and covers that sound. Off until the visitor opts in. |

A pager replaces page scrolling, so never pair it with smooth scroll or scroll-driven effects on the same page. Sound only doubles what motion or text already says. Code: [section-pager.md](recipes/section-pager.md), [sound-cues.md](recipes/sound-cues.md).

## Resize

Width changes can invalidate split positions and the wave's pinned widths; height-only changes from mobile browser chrome do not. The controller decides whether to rebuild an effect or replay an entrance; recipes supply fresh measurements when called and never reset page state. Particle fields remeasure themselves. Text stays readable throughout, and reduced motion stays settled.

## Input and devices

Particle and pointer effects respond to input; text and scroll effects do not.

- [The field helper](recipes/particle-field.md#input-and-density) combines hover, keyboard focus, and touch presses. Controls work cold.
- [Pointer effects](recipes/pointer-effects.md): `magnetic`, `tilt`, `cursorFollower`, `momentumHover`, `proximity`, and `imageTrail` answer the mouse only and never gate a control. `dragTrack`, `dragLoop`, `dragGrid`, and `flickCards` work with mouse, touch, and keyboard; vertical swipes keep scrolling the page unless a full-screen grid claims both axes.
- Hover effects share one hot state for mouse hover and `:focus-visible`; touch, pen, and click-derived focus never enter it.
- One pointer response per control: magnetic, tilt, a hover effect, or a particle hot state. Momentum hover is for decoration beside controls, never on them. Proximity may scale links, as in a dock, but never replaces their focus style.
- The framework skill's `references/devices.md` owns viewport tiers, orientation, and CPU budgets.

## Ambient motion

Loops that run while a surface idles, such as the wave, button embers, or an outline runner.

- One ambient effect per target; none is required.
- Pause off screen. Particle fields use an `IntersectionObserver`; the wave and follower expose `pause()` for the controller.
- The wave, particle controls, follower, marquee, logo cycle, and drifting `dragLoop` expose `pause` and `play` (`resume` on the wave) for the page's pause control or motion setting.
- On small screens, lower particle density and limit wave character counts.
- Every cycle ends where it started; embers die.
- None under reduced motion: nothing is split or spawned.
