---
name: animaxxing
description: "Build GSAP motion without restyling, as single effects or the full treatment. For \"we're animaxxing\", every element enters from a blank page, rests, and leaves. Effects: split-text entrances, scattering headlines, speak-in, letter waves, scroll reveals, scrubbed statements, parallax, pinned scenes, horizontal runs, scroll waypoints, smooth scrolling, curtain, curve, and preloader covers, Flip layout and shared-element morphs, image reveals, hover previews, video and frame scrubbing, menu, dialog, accordion, tab, enter/exit motion, label rolls, underline sweeps, magnetic buttons, tilt cards, cursor followers, image trails, momentum and proximity hover, drag-and-throw tracks, endless drag loops, wrapping grids, flick card stacks, CustomEase curves, section paging, sound cues, SVG draws and morphs, count-up figures, marquees, confetti, emoji rain, particle controls, blast-off exits, and hover stuck on touch. Pair with the matching GSAP framework skill. Not for branding, redesign, routing, or GSAP API questions."
license: MIT
metadata:
  short-description: Reusable GSAP text, scroll, pointer, layout, SVG, and particle motion for any brand
---

# Animaxxing

Portable vanilla TypeScript and GSAP effect recipes. Keep the project's fonts, colors, layout, and component styling; no style skill, token, or font is required.

Load the matching `gsap-<framework>` skill first (`gsap-vanilla` for plain sites), installing it if missing. It owns **mount → initial state → intro → settled → outro → end state → unmount**, initialization, navigation, recovery, interruption, and cleanup timing. This skill supplies builders its controller calls; do not invent lifecycle guidance here.

## Choose the scope

- **Full treatment.** "We're animaxxing", "animax this", or "full treatment" means every element on every screen animates, keeping the brand. Each element starts from a blank first paint, enters (intro), rests static or ambient (settled), and leaves (outro) on every requested navigation. Content below the fold enters when it is scrolled or tabbed to. Mark every element as a page item ([route letters](references/recipes/route-letters.md)) or give it a pair from [the shelf](references/motion-vocabulary.md#the-shelf-paired-entrances-and-exits); the framework skill keeps the first paint blank. Record the decision in the project's plan or notes so later sessions keep it.
- **Single effects.** A named effect gets only that effect. A particle button does not imply a page transition, font change, or hero sequence.
- **Unclear.** Ask once before building: "Full treatment on every element, or only <effect>?"
- The full treatment still follows reduced motion, no-script readability, and the framework skill's initialization and lifecycle.

## Setup and adaptation

- Read the installed GSAP version and types. Every plugin used is free since 3.13; SplitText recipes need 3.13+ (`SplitText.create`, `smartWrap`, `mask`, `aria`); `easeReverse` needs 3.15+. Each recipe lists its dependencies; register only those used. Use the official GSAP skills for API details.
- Recipes register plugins at module scope, which is server-safe, but import them only from client code. Drop a copy's registration when the project registers plugins centrally.
- Add only requested effects unless the full treatment applies; see [Choose the scope](#choose-the-scope).
- Recipe constants are editable defaults, not brand rules. Tune timing, stagger, spread, and intensity to the surface; expose more constants only if the app needs runtime configuration.
- Weight effects need a loaded variable weight axis, not a specific font. Match endpoints and resting weight to the face (examples use 400–800), or use transform-only effects.
- Particle canvases take their CSS `color`; use an existing brand color with enough contrast. Keep control geometry and focus styling.
- Use `style-animaxxing` only when its look is requested; it selects and configures these recipes.

## Read only what you need

| Task | Reference |
|---|---|
| Choose in/out effects, configure defaults, coordinate with the controller | [Motion vocabulary](references/motion-vocabulary.md) |
| A brand's signature curve for every `ease` option | [Signature curves](references/motion-vocabulary.md#signature-curves) |
| Loading flashes, auth-dependent content, or layout shifts | Matching installed framework skill's `references/initialization.md`, **Data readiness and layout stability** |
| Character animation: font readiness, kerning, masks, stable split/revert | [Text stability](references/text-stability.md) |
| Character, word, line, or scramble entrances/exits, ellipse line reveals, highlighter line sweeps | [Split entrances](references/recipes/split-entrances.md) |
| Page items, including scattering headlines | [Route letters](references/recipes/route-letters.md) |
| Short display copy arriving at speaking pace | [Speak-in](references/recipes/speak-in.md) |
| Ambient headline ripple | [Wave](references/recipes/wave.md) |
| Scroll reveals and pop-ins, scrubbed statements, parallax and footer reveals, pinned scenes, horizontal runs and drift inside them, an element traveling between section waypoints, progress, velocity skew, header theme per section, hide-on-scroll headers | [Scroll effects](references/recipes/scroll-effects.md) |
| Magnetic buttons, tilt cards, cursor follower and its scrolling label, momentum hover, proximity scaling and dock effects, image trails, drag-and-throw tracks | [Pointer effects](references/recipes/pointer-effects.md) |
| Endless drag galleries: a wrapping loop with snap, wheel, and drift; a 2D grid that wraps on both axes; a fanned card stack dealt by drag or flick | [Endless drag](references/recipes/endless-drag.md) |
| Full-screen sections changing on a wheel flick, swipe, or key | [Section pager](references/recipes/section-pager.md) |
| Opt-in sound on interactions and timelines, ambient beds | [Sound cues](references/recipes/sound-cues.md) |
| Line drawing, icon morphs, a mark following a path, a section edge that morphs with scroll | [SVG effects](references/recipes/svg-effects.md) |
| Count-up figures, looping marquees, logo walls that cycle | [Counters and marquees](references/recipes/counters-and-marquees.md) |
| Eased page scrolling with Lenis or ScrollSmoother | [Smooth scroll](references/recipes/smooth-scroll.md) |
| Curtain page transitions, tilted, titled, clip-path wipe, or drifting covers, curved SVG swipe covers, first-visit preloaders | [Page covers](references/recipes/page-covers.md) |
| Filter, reorder, and expand layouts; shared-element morphs across pages | [Layout Flip](references/recipes/layout-flip.md) |
| Image wipe reveals, hover image previews, scroll-scrubbed video, canvas frame sequences | [Media effects](references/recipes/media-effects.md) |
| Label rolls, underline sweeps, image zoom on hover and focus | [Hover effects](references/recipes/hover-effects.md) |
| Menu overlays, interruptible enter/exit with reverse easing, dialog enter and exit, accordion height, sliding tab indicators | [Component motion](references/recipes/component-motion.md) |
| Dispersal on a call to action | [Blast-off](references/recipes/blast-off.md) |
| Confetti bursts and emoji rain thrown under gravity | [Physics effects](references/recipes/physics-effects.md) |
| Particle buttons, cards, links, or command fields | [Particle effects](references/recipes/particle-effects.md) plus [field/attach helpers](references/recipes/particle-field.md) |
| Touch, focus, stuck hover, mobile particle budgets | [Input and devices](references/motion-vocabulary.md#input-and-devices) |
| Roll back partial setup and restore modified content | [Effect restoration](references/effect-restoration.md) |
| Verify effects and reuse on another brand | [Verification](references/verification.md), then the framework's relevant checks |

## Recipe contract

Copy only the selected recipe and its named local helpers. Return shapes differ per recipe (timelines, `{ timeline, revert }`, stop functions, particle controls); assume no universal interface.

| Framework phase | Effect responsibility |
|---|---|
| initial state | Targets prepared under the framework's pre-paint/no-script mechanism |
| intro | Entrance builder or `enter(delay)` |
| settled | Clear temporary styles; optional `idle()` or wave |
| outro | Exit builder, `exit()`, or `blastOff(...)` |
| end state | Notify completion; controller decides the next action |
| unmount | Controller calls the recipe's stop, `destroy`, or `revert` handle |

- Apply [effect restoration](references/effect-restoration.md) when copying a recipe, including failure before a handle returns.
- Builders never navigate, mount, subscribe to page lifecycle, or decide when they run. The controller calls them and owns phase state.
- An invisible start does not make incomplete data ready. The controller supplies resolved targets or reserved regions; never use an entrance to disguise guest or empty content.
- Keep split markup only while an effect needs it (speak-in finishes and an active wave persist). Revert at the controller's cleanup boundary; preserve accessible text and nested controls.
- Use `overwrite: "auto"`; clear temporary styles and `will-change` when their phase ends.
- Reduced motion reaches the documented settled or exit state and still fires completion callbacks; no ambient motion. Use the project's preference helper, including any app override. Builders read it when they build; on a change, the controller tears down and rebuilds.
- Killing a parent timeline never reaches a nested builder's interrupt callback. Kill the parent, then call each builder's revert, such as `revertText` for split runners.
- One effect per target: two owners must never write one element's transform. Stop pointer and ambient effects before an outro moves their target.
- Ambient effects expose controls so the owner can pause them off screen and stop them on exit. Loops past five seconds need a user-facing pause ([WCAG 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)).
- Particle input and density follow the [field contract](references/recipes/particle-field.md#input-and-density). Controls work without hover.
- Width changes can invalidate split measurements ([resize](references/motion-vocabulary.md#resize)). The controller decides whether to rebuild; recipes never remount pages.
