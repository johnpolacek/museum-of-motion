<!-- Generated from shared/transition-archetypes.md; run scripts/sync_initialization.py. -->

# Transition archetypes: curtains, preloaders, shared elements, and persistent canvases

Read this before building a page transition that covers the whole screen, a first-visit preloader, an element that morphs from one page into the next, or a WebGL canvas that outlives each page. Each still runs the lifecycle, **mount → initial state → intro → settled → outro → end state → unmount**, and each adds one rule about what persists across the swap. The framework skill owns timing, locks, and recovery. The `animaxxing` skill supplies the builders: `curtain` and `preloader` in `references/recipes/page-covers.md`, `captureShared` and `playShared` in `references/recipes/layout-flip.md`. The `animaxxing-webgl` skill supplies `holdStage` in `references/recipes/webgl-stage.md`.

## Curtain

A curtain hides the swap behind panels that sweep in during the outro and sweep out during the intro. It replaces the route-area swap cover for that navigation; it does not add a second one.

- **Where it lives.** In the persistent shell, outside the route boundary, fixed over the viewport. A curtain inside the page unmounts with the page it is hiding. The framework skill defines what persists: a root layout, an element the router carries across swaps, or, across full document loads, a cover that closes on one document and opens on the next.
- **Outro.** Start `cover()` with the outro, after or overlapping the item exit. The navigation lock holds until `cover()` completes. Stop any smooth scroller now. The cover belongs to the shell: build it on the shell's timeline or GSAP context, never inside the outgoing page's context, whose revert at unmount would pull the curtain open mid-swap. The page's end state waits for the cover's completion instead of nesting it.
- **End state.** Covered. The outgoing page may now unmount; the router swaps under the curtain. Keep the curtain's pointer blocking on so a second click cannot reach the page underneath.
- **Intro.** Mount the incoming page at its initial state, sized, with split text and media prepared. Then call `reveal()`, overlapping it with the page's own intro if the design wants items to arrive as the curtain leaves. Never reveal onto an unprepared page: that shows the flash the curtain exists to hide.
- **Settled.** Curtain hidden, panels restored to rest. Release the navigation lock and move focus as for any intro.
- **Back and forward.** Intro-only, like every history move: no cover. If the curtain is still closed when the history move arrives, reveal it once the page is prepared.
- **Interruption.** A second navigation during `cover()` joins it: keep covering, change the destination, swap once. A navigation during `reveal()` calls `cover()` again; the recipe turns the panels back from where they are.
- **Recovery.** The curtain is a cover under the initialization contract. When the incoming owner recovers, the recovery path must also reveal or hide the curtain, or the page stays covered forever. Register that with the owner's rollback.
- **Reduced motion.** Skip the curtain: call neither `cover()` nor `reveal()`, leave its phase at rest, and use the ordinary route-area swap cover. The recipe is still safe to call there; it never shows a panel, and its timelines complete on the next frame.

## Preloader

A preloader holds the first visit while real dependencies arrive, then lifts away into the first intro. It is a deliberate hold, and it costs first-load time on every visit that shows it.

- **First visit only.** Decide in the first-paint script, before paint: show it when the session has not seen it. Render the markup only on those visits; under server rendering, where the server cannot know the session, render it hidden and show it only under the first-paint marker. A client navigation never shows it again.
- **Honest progress.** Report readiness from what the first view needs: required fonts, the hero's images decoded, and structural data. Weight them, bound each with the initialization deadline, and never animate a fake count on a timer. A timed-out dependency still counts as done for the preloader; the intro takes its fallback path.
- **The handoff.** The preloader is the prepared intro's first act. Arm the initialization deadline before showing it; cancel it only when the preloader's `finish()` and the page intro are built with their handlers attached, as for any intro. The preloader's own duration then belongs to animation time.
- **Into the intro.** Start the page intro as `finish()` lifts the preloader, or overlap its end. The page underneath must already be at its initial state, not settled; otherwise the lift reveals a finished page that then replays.
- **Accessibility.** The preloader is a `progressbar` with a label while visible. Mark the covered content `aria-busy="true"` and release it at settled. Hidden, the preloader leaves the accessibility tree.
- **Failure.** On recovery, hide the preloader at once, release `aria-busy`, and show the readable page. JavaScript disabled means the preloader never shows.
- **Measure it.** Check the first view's Largest Contentful Paint and interaction readiness with the preloader on and off, on a throttled phone. Keep the hold short enough to be worth it.

## Shared elements

A shared element morphs from its box on the outgoing page into its counterpart on the incoming one, such as a thumbnail into a hero. Both carry the same `data-flip-id`.

- **Capture in the outro.** Call `captureShared` on the outgoing element while it is still laid out, before anything hides or unmounts it. Fade everything else and leave that element lit; the end state is what the user sees during the swap.
- **No cover for this navigation.** A curtain or route cover would hide the element the morph needs. Use the morph or the curtain, not both.
- **Hand off the state.** Keep it in a small handoff object owned by the persistent shell, keyed by destination with trailing slashes normalized. Reading it must not consume it: development double-mounts read twice. Clear it when the navigation settles, is cancelled, or is replaced by another.
- **Play in the intro.** Once the incoming target has rendered at its final size and is visible, and after the router's scroll has landed, call `playShared(state, target)` with the target explicitly. The recipe corrects for a scroll change between capture and play, not for one that lands during the morph. Some routers keep the old element in the DOM, hidden, and Flip would otherwise animate that copy; the explicit target costs nothing where they do not. Keep the target out of the page's stagger and pre-paint hiding.
- **Back and forward.** A history move has no outro and therefore no captured state. The incoming page takes its intro-only path without travel, such as a fade, so the thumbnail appears in its own box rather than rising into it; no ancestor of a shared element travels either. Do not replay a stale handoff. Where the framework runs the same leave hooks for history moves, its skill says how to recognize that path and skip the capture.
- **Reduced motion.** `playShared` shows the target at once and still completes.
- **Cross-document navigations** lose the state in the full page load. Use a cross-document View Transition with `view-transition-name` for that case, and keep GSAP off the named element.

## Persistent WebGL canvas

WebGL image planes draw on one fixed canvas per document. Creating a context per page costs a shader compile and a texture upload on every navigation, and browsers cap live contexts, so keep one canvas across client-side routes.

- **Where it lives.** The persistent shell holds the stage once, outside the route boundary, like a curtain. Pages build and revert their planes; the canvas and context stay. Across full document loads nothing persists: each document holds its own stage.
- **Outro.** Planes keep drawing through the page's exit, including a wipe `exit()`. Revert the outgoing page's planes at unmount, after its end state, so their images never flash back first.
- **Intro.** Build the incoming page's planes once their images are mounted and laid out. An intro that depends on a plane awaits its `ready` within the initialization deadline; on `false` or timeout, the `<img>` is already the readable page.
- **Swap order.** When the router overlaps pages, the outgoing planes follow their images wherever the router moves them; revert them before the outgoing page is detached, since a detached image has no box.
- **Recovery and reduced motion.** No stage exists under reduced motion or without WebGL, and the shell's hold returns `null`; nothing else changes. A recovery path reverts the page's planes like any effect. Release the shell's hold only when the shell itself unmounts.

## Verify

- Curtain: the chrome and the swap never flash; a click during the cover goes nowhere; back and forward show no cover; a recovery leaves no curtain behind.
- Preloader: shows once per session, tracks real readiness, lifts into an intro that has not already played, and releases `aria-busy`. Disabled JavaScript and a blocked bundle both show the readable page.
- Shared element: the morph starts at the old element's exact box, ends in the new element's settled layout with no inline styles, and a history move afterwards does not replay it.
- Persistent canvas: after several navigations there is still one `canvas[data-webgl-stage]`, the same element, and each visited page's images show again the moment their planes revert.
