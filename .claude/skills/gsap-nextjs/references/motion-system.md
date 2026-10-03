# Lifecycle implementation

Read this to implement the five phases for pages and components without layout shift.

## The contract

**mount → initial state → intro → settled → outro → end state → unmount**

One controller owns a node from mount to unmount and exposes one current phase:

1. **Initial state.** Mounted, final size reserved, measured, start values applied, not yet shown.
2. **Intro.** One timeline from initial values to settled.
3. **Settled.** Visible, stable, interactive, and controlled by normal CSS.
4. **Outro.** Still mounted while one timeline moves it toward removal.
5. **End state.** Still mounted, final values applied, completion run once. Safe to unmount.

The user's request defines how each phase looks. If it only describes an intro or outro, implement the other phases as the minimum needed to enter and leave cleanly.

Store the current phase in state, a ref, or a data attribute. Do not infer it from opacity, DOM presence, or timeline progress.

## Setup and React lifecycle

Create one client-only module that imports GSAP, `useGSAP`, and only the plugins the project uses, and registers them once. Other modules import from it.

Use `useGSAP` in components:

- Pass a root ref as `scope`.
- Use refs for single targets and scoped selectors for repeated ones.
- Add dependencies only when the animation must rebuild. Set `revertOnUpdate` when a rebuild needs full cleanup first.
- Wrap callbacks and event handlers that create GSAP work in `contextSafe`.
- Return a teardown for listeners and other non-GSAP resources.

Never run GSAP or plugin code during server rendering. Keep the client boundary small; the rest of the page can stay server-rendered.

Do not call another component's `contextSafe` synchronously inside `useGSAP`: its context becomes a child and dies on the outer revert. Hand shared-controller work off through a microtask, effect, or event.

Write setup so it is correct when it runs more than once on the same node. React development checks do this, and with `cacheComponents` a hidden route runs cleanup on hide and setup again on re-show with its settled DOM intact. Async work started by the first run can still be in flight when the second run starts, so anything a setup triggers outside its own context, such as a shared cover, must be safe to request twice. So: explicit initial writes (`set` or `fromTo`) rather than `from` tweens that trust a fresh node, and cleanup that leaves the node readable. Use a ref guard only for work that should happen once per visit rather than once per setup.

## Initial state

Build the final layout with normal CSS first. The initial state changes appearance, not layout. The element that owns geometry must exist before the animated node mounts.

- Mount content before measuring or animating it.
- Give images and media dimensions or an aspect ratio.
- Reserve async regions with a wrapper when their size is known.
- Prefer transforms, `autoAlpha`, masks, or clipping, which keep the layout box.

If the effect changes width, height, or position:

- Animate a transform on an inner element while an outer wrapper holds the settled size.
- For a real expand or collapse, measure start and end sizes first, animate the wrapper, and decide how surrounding content moves.
- For layout-to-layout changes, use Flip: capture the old state, apply the new layout, animate.
- When old and new content share one region, reserve the parent and overlap the children so only the parent affects layout.

Content must stay readable without JavaScript. Any pre-paint hiding rule needs a no-script path.

## Layout changes with Flip

For a filter, reorder, or expand driven by React state, use `captureLayout` from the `animaxxing` skill's `references/recipes/layout-flip.md` and keep the capture and the play on either side of one commit:

- Capture in the event handler, wrapped in `contextSafe`, then commit the state with `flushSync` from `react-dom`, then `play()`. The synchronous commit means the DOM holds the new layout when `play()` measures it. The alternative is to keep the captured state in a ref and play from a layout effect keyed on the state, which also runs before paint.
- Keys must survive the change. React moves a node only when its key stays the same; a remounted item is a leave plus an enter, not a move.
- Items that leave must stay rendered, hidden with `display: none` or a leaving flag, until the Flip completes, or they vanish. Use a presence controller for that.
- StrictMode double-runs the effect path, not the handler path. A layout-effect play needs a ref guard that clears the pending state after the first play. Under `cacheComponents`, capture only while the route is visible; a hidden route measures zero.

## Data-ready entrances

Apply the shared [data-readiness contract](initialization.md#data-readiness-and-layout-stability) before selecting page or region boundaries.

- Trace the queries and authentication states that choose each branch, including nested client components. A parent's first result does not prove its child subscriptions are ready. Start independent reads together and include dependent reads in the chosen owner's readiness signal.
- When identity and backend authentication settle separately, wait for the backend's confirmed state before subscribing to personal data. Include any required app-user synchronization. Use the installed client's supported query-skip mechanism; a deliberately skipped query is not a required pending dependency.
- Mount the page's content/ready marker only when the selected structure can enter. `loading.tsx` covers router/Suspense work, but does not automatically cover client subscription or authentication loading. Give those branches an explicit loading state. Preserve server-rendered content where available.
- Keep a late component's wrapper mounted with appropriate geometry. Register its entrance when the resolved content mounts; an empty wrapper's mount-only effect cannot animate children that arrive afterward. Forward animation attributes through wrappers and ensure nested boundaries do not animate the same target twice.
- Keep the ready signal about structural readiness, not object identity. Refreshed scores, countdowns, and query snapshots should update settled content without replaying its entrance. Invalidate pending preparation on route changes and recheck ownership after awaited fonts or data.

## Initialization and recovery

Apply the [initialization contract](initialization.md) whenever content starts hidden. It includes recovery ordering, indexing/performance limits, and failure checks.

- Put the early marker and independent deadline in the root document before streamed content can paint. Use the installed Next.js script/CSP integration; verify emitted HTML, ordering, and hydration. A client effect is too late. Keep meaningful content in Server Components or SSR output.
- In `useGSAP`, register rollback before initial writes or splits. Catch synchronous setup and async callback failures. Keep the initialization timer through preparation; `contextSafe` tracks GSAP resources but does not reject stale promises.
- Store the visit's recovery decision in the persistent boundary, outside disposable effect setup. React's setup/cleanup replay must not reset it. Streamed or Suspense regions that arrive after recovery stay readable; give separately animated regions their own bounded owner.
- With `cacheComponents`, invalidate work on hide and scope recovery to the active route. Never reveal a preserved `<Activity>` subtree. A real route re-show can start a new visit; a repeated setup cannot. Keep persistent shell recovery separate and release only the matching cover/focus request.

## Intro and settled

Write reusable intro and outro builders only when behavior repeats. Each returns a timeline so the controller can compose, kill, reverse, or await it.

- Make settled the source of truth. It must not depend on a paused timeline.
- Clear temporary transform, visibility, transition, and `will-change` styles once settled.
- Run intro completion and settled callbacks once, including under reduced motion.
- On rapid state changes, replace, kill, or reverse the active timeline. Do not stack conflicting tweens.
- Update assistive text and state immediately. Animate the visual, not the meaning.

## Outro and end state

Start the outro from current rendered values. Keep the node mounted, laid out, and owned until the timeline completes.

- Reject duplicate outro requests or define which wins.
- If an intro is running, reverse it only when the outro is its exact inverse. Otherwise kill it and build the outro from current values.
- Disable pointer events when the visual can no longer support them, without removing the layout box.
- Run end-state work once. Only then unmount, replace, hide, or hand off.
- Kill the active timeline on cleanup, but do not erase state the route cover still needs.
- No `display: none`, conditional removal, or DOM replacement before the outro completes.

## Conditional show and hide

React unmounts conditional content before an outro can play. Add a presence controller where that matters. It should:

- Mount into initial state before the intro.
- Stay mounted through settled and outro.
- Keep the active timeline.
- On re-show during an outro, reverse only if that gives the intended intro. Otherwise kill, set from current values, and build a fresh intro.
- Remove the node only after the end-state callback.
- Keep all five phases under reduced motion.

When content in a shared region changes size, decide who owns the region's geometry before mounting either child. Overlap old and new inside a reserved wrapper, or animate a measured wrapper between known sizes. Do not let unmount then mount push surrounding content twice.

Do not use presence for content that can simply appear, or for routes the transition boundary already manages.

- Focus a panel when its intro completes, not when it mounts. An element at `visibility: hidden` refuses focus silently, and `autoAlpha: 0` is exactly that. Reduced motion jumps to completion synchronously, so the focus still lands.
- When the outro ends and React is asked to unmount the children, clear only `will-change` from the wrapper. The unmount is queued, not immediate; clearing the collapsed height or visibility in the same tick flashes the content at full size for a frame.

An intercepting-route modal is a presence controller with the router as its unmount. Its close plays the outro and only then calls `router.back()`. Under `cacheComponents` the intercepted page is hidden, not unmounted, so the setup runs again on re-show and everything the modal changed outside itself (scroll lock, key listener, focus, header state) is undone in the effect teardown, which is the only thing that runs on a hide. Treat opening it as an overlay navigation: no outro on the page underneath, no cover, no request lock.

## Reduced and responsive motion

The OS preference is the default. Add an app override only if the product needs one.

Every effect needs initial, settled, and end states under reduced motion. Do not just shorten a disorienting effect. Skip travel, rotation, scale, parallax, and scrambling unless essential. A zero-duration timeline or an immediate `set` still fires completion for anything that depends on it.

Use `gsap.matchMedia()` for responsive and reduced-motion variants that must rebuild when conditions change. Revert it through the owning component. Do not nest a second GSAP context for the same setup.

An app-level override is not a media query, so `matchMedia` cannot see it. Read it in a shared `prefersReducedMotion()` helper that every timeline consults, mirror it as a root attribute so CSS can key on it, and for setups that live inside a `matchMedia` block either gate the block on the store through a hook dependency or accept that the block follows the OS alone and say so.

## Scroll

Use `gsap-scrolltrigger` for the API; these rules cover route lifetime and measurement.

- Create triggers in document order. Refresh after fonts, images, or dynamic content change layout.
- Create triggers inside the owning context. Do not kill all triggers globally when one page leaves.
- A route hidden by `<Activity>` measures zero. Create triggers once visible and refresh on re-show after scroll restoration settles. Refresh once more when the page settles if anything above the trigger changed height during the intro.
- A `useGSAP` context revert calls `revert()` on each trigger with no arguments, which ScrollTrigger treats as `kill(true)`: the pin spacer is removed and the pinned element's original inline styles are restored. Leaving a route mid-pin under `cacheComponents` needs no extra cleanup for the pin itself. `gsap.matchMedia()` created inside the same setup registers with that context and is reverted with it; it is not a second context for the same setup.
- Reverting a scrubbed trigger's animation can leave start values inline on its targets, such as a zeroed `transform`, `opacity: 1`, or `visibility: inherit`. It always does with `invalidateOnRefresh` and can for a plain `to()` in a pinned timeline. When a re-show, a reused page, or another effect needs the targets clean, record their inline motion properties at setup and restore them after the revert; `clearProps` also resets GSAP's cached transform.
- A `will-change` written from an `onToggle` callback is outside the context and survives its revert. Write it as a plain style and undo it in the matchMedia cleanup, or write it before the trigger is created.

Under reduced motion, go straight from initial to settled without unnecessary triggers. Keep outro and end callbacks that control navigation or unmount.

## Text

Use SplitText when the effect needs per-character, word, or line targets.

- For character splits, keep scoped `font-kerning: none; text-rendering: optimizeSpeed` before, during, and after revert, including reduced motion. Wrappers disrupt kerning and can cause horizontal snapping; use words/lines if natural kerning is essential. See [SplitText limitations](https://gsap.com/docs/v3/Plugins/SplitText/#tips--limitations).
- Apparent weight changes can be clipped ink: check computed fonts/readiness, then mask edges, punctuation, and descenders. For confirmed clipping, add scoped mask padding with compensating negative margins; verify spacing and both hidden endpoints before trying compositing workarounds.
- Keep reading accessible with the plugin's ARIA support. If text contains links or controls, keep an unsplit accessible version instead of hiding them.
- Use word-aware wrapping for character animation. Use auto re-split for line animation that must survive width or font changes.
- When line measurement needs fonts, bound the wait or auto-split preparation by the [initialization deadline](initialization.md#bound-initialization-not-choreography). Reserve settled height before splitting if wrappers could shift layout.
- Keep a handle to the split's animation so re-split and cleanup can dispose of it. With `autoSplit`, build the animation inside `onSplit` and return it: the plugin records its playhead before a re-split and restores it on the new lines, and `revert()` undoes the tween's values. With line splitting and `autoSplit`, the plugin waits for fonts itself; no separate font wait is needed.
- A split heading inside a page takes its timing from the page phase, not its own clock. Hold at initial while the page is initial, rise when the page enters, drop when it leaves. Give it its own pre-paint rule rather than marking it as a page target, or the page's stagger and the split's rise fight over one element.
- Revert splits on interruption and unmount. Do not leave wrapper spans in stale content.

Revert when the owning phase no longer needs the split. Compare glyph appearance, character positions, wrapping, and height immediately before/after cleanup at desktop/mobile widths, with reduced motion and interruption. Stable boxes alone do not prove stable ink; distinguish subpixel rounding from visible movement.

## Interaction

Pointer motion needs keyboard parity. Pair hover with focus on interactive elements. Do not animate a non-interactive element like a control.

Keep gestures bounded, provide a non-gesture path, and dispose of interaction plugins with their owner. See `gsap-plugins` for Draggable, Observer, and Flip APIs.

## Layout stability and performance

- Prefer `x`, `y`, scale, rotation, and `autoAlpha` over layout properties.
- Use `clip-path`, filters, and variable-font axes deliberately; they can cost paint or shift layout.
- Batch reads before writes.
- The stable wrapper's box should not jump between mount, initial, settled, outro, end, and unmount. Intentional transforms move pixels; layout boxes do not.
- Set `will-change` just before animating and clear it after. Do not promote everything.
- Do not animate hundreds of nodes at once. Reduce targets, batch, or virtualize.
- Do not add a CSS transition on a property GSAP controls.
