# Verification

Automated suite: `motion/` in [animaxxing-skills-test](https://github.com/johnpolacek/animaxxing-skills-test) type-checks every recipe straight from this skill and runs its checks in Chromium (`pnpm test:motion`). Run it after changing any recipe. Keep usage snippets under a `## Wiring` heading or starting with `// Example` so the suite skips them, and head each separate module's section with its file name, such as `## field.ts`.

Reference demo: [Animaxxing](https://github.com/johnpolacek/animaxxing) exercises the recipes with `style-animaxxing`, which is not a required design. Check visual quality there or in the consuming app, alongside the framework skill's checks.

## Portability

- An effect-only request keeps the app's fonts, palette, layout, and component styling; copying a recipe needs no style tokens or fonts.
- Particle color follows the canvas's computed `color`, including theme changes, with enough contrast on the actual background.
- Weight effects run on a loaded variable face within its axis, at the target's resting weight. A static face gets transform-only effects.
- Timing, spread, intensity, and stagger suit the actual surface and viewport. Layout boxes stay stable.
- In a data-driven app, run the framework's data-readiness checks: no guest or empty content flashes before the effect, and reserved regions keep siblings still.

## Motion

- Entrance splits revert at settled; only an active wave or speak-in finishes keep markup, until their cleanup boundary.
- Kill a parent timeline of split runners mid-way: `revertText` restores each target, and a new runner starts from clean markup.
- A setup that throws leaves GSAP's global context untouched: later tweens are not recorded by the failed context.
- Scramble runners visibly scramble, end on the real words, and restore them when killed.
- Highlight runners leave no bar behind at settled or when killed, and bars span each line's words, not the full line box, in LTR and RTL.
- Ellipse runners show whole lines at settled, with descenders and accents unclipped at both endpoints.
- No inline `transform`, `will-change`, or `transition` remains on route items at settled.
- If the controller uses `data-transition-state`, it reports `entering → idle` and `exiting → waiting`, never completion while a timeline runs.
- Particle canvases: one per treated element, at `-bleed`, `pointer-events: none`, `aria-hidden`, colored from the canvas `color`. The ticker drops a field once its particles are gone and no emitter is attached.
- Mouse hover and keyboard focus share a hot state; leaving one input preserves the other.
- Touch buttons and text fields flare while pressed and cool on release or swipe cancel. Tap-derived focus stays cold.
- Keyboard input after touch restores focus treatment; held keys do not repeat bursts.
- Coarse input thins transient particles but keeps outlines, owned particles, and runner counts.
- At phone width with 4x CPU throttling, lower budgets if idle frame pacing fails.
- Reduced motion (`prefers-reduced-motion: reduce` or `data-motion="reduced"`): entrances land settled at once, exits reach their end state, nothing splits, spawns, or waves, and every completion callback fires.
- A treated element scrolled off screen stops its field ticking.
- `blast()` or `exit()` during a particle entrance leaves no particle alive after a second and stops the ticker; a following `idle()` shows the target whole, unscaled, and unclipped.
- After `destroy()`, the field stays stopped even for delayed callbacks, and the target's inline styles match their pre-attach state.
- A throwing particle factory or observer attachment rolls back target styles, canvas attributes, tweens, and listeners. A throwing treatment cleanup cannot skip the remaining restores; later controls and queued resizes stay inert.
- `blastOff.revert()` preserves authored transforms, filters, and CSS priorities after interruption, full completion, and reduced motion, including repeated teardown.
- The wave, particle controls, and follower hold on `pause()` and continue on `play()` or `resume()`, wired to a page control or motion setting.

## Scroll

- Reload mid-page and restore via back: reveal targets above the fold are visible, never stuck hidden.
- Reveal targets waiting below the fold stay in the accessibility tree and tab order; tabbing into one shows it at once.
- Scroll down and back through every scrubbed effect; each returns exactly to its start values.
- Pinned scenes and runs: no jump entering or leaving the pin; content below lands in place.
- `scrollWaypoints`: the traveller rests in place at the top, covers each marker's box exactly when that marker is centered, and lands again after a resize or a moved marker plus refresh; revert leaves no trigger or inline transform.
- `runDrift` items travel from `-travel` toward `+travel` across the run and never show past their frames; `morphScrub` returns to the authored shape scrolling back up, and to the authored `d` after revert.
- A `drift` curtain leaves no transform on the content wrapper after `reveal()` or `revert`; fixed UI stays in the shell.
- Resize across a breakpoint and refresh: pin lengths and run distance recompute; nothing overlaps.
- Tab through a horizontal run: each focused item scrolls into view without the section scrolling itself. A mouse click on an item does not scroll the page.
- Tearing down a pinned scene restores only what its tweens animated; other effects' inline values survive.
- Tear down mid-pin: the spacer is removed, inline styles and `overflow` restore, and page scroll works.
- A pop-in reveal starts at its given scale and rotation and clears every inline transform once revealed.
- A footer parallax with `end: "bottom bottom"` completes its travel at the bottom of the page.
- `navTheme`: the header's `data-nav-theme` matches the section under its middle, scrolling both ways and on a mid-page load; teardown restores the header's own attribute.
- `scrollDirection`: small reversals under the threshold keep the direction; `data-scroll-started` turns false back at the top; a focused header stays visible in CSS.
- Reduced motion: no pins, splits, or scrubbing; static fallbacks read; the progress rule, nav theme, and scroll direction still track.
- With a custom scroller, every trigger receives it and cleanup leaves the app's proxy intact.

## Pointer

- Magnetic, tilt, and follower respond to the mouse, ignore touch and pen, and never stick after a tap.
- Leaving the target returns it exactly to rest; teardown leaves no inline transform or `--pointer-*`.
- The follower appears at the pointer, never sliding in from a corner, and hides when the mouse leaves the window.
- Drag a track of links: it moves and snaps without following the link; a plain click follows it.
- On touch, horizontal drags move the track and vertical swipes scroll the page.
- Keyboard focus slides the focused item into view; a mouse press does not.
- Revert during a throw: the track stops and its inline styles and the viewport's `overflow` restore.
- Image trail: images spawn only after `spacing` px of mouse travel, never more than `max` at once; each is `aria-hidden` with empty `alt` and no id, and all are gone after their life and on teardown. Touch and pen spawn nothing.
- Cursor label: over `[data-cursor-text]` the dot hides and the label scrolls two copies of the text seamlessly; leaving hides it and pauses the loop; teardown restores the label's track and styles.
- Momentum hover: a fast sweep throws and spins the struck targets, which settle to rest; hit areas never move. A still pointer entering an item does nothing.
- Proximity: the nearest item reaches the peak scale and neighbors grow less; items past `radius` stay at 1; hit areas never move; leaving the window or the radius settles everything; `axis` ignores the other axis.
- Reduced motion: no magnetic, tilt, follower, momentum hover, or proximity; the track drags and lands on the nearest item without a throw.

## Endless drag

- Clones are `aria-hidden` and `inert` with no ids; each real item is announced once and Tab visits only real items.
- `dragLoop`: a drag past either end wraps with no gap across the viewport and lands on an item; a sideways wheel moves the same position and lands; a vertical wheel scrolls the page.
- Tab brings each real item into view in the loop, including after a clone set wraps and while a wheel snap or throw is pending, and centers each tile in the grid; the viewport's own scroll stays 0.
- A drag or throw over a link never follows it; a plain click does.
- Drift holds on hover, focus inside, drag, off screen, and `pause()`, and resumes after each; a visible control drives `pause` and `play`.
- `dragGrid` with fewer tiles than the viewport holds covers it with no gap before and after a drag, and after resizing the viewport larger.
- The grid's wheel pans sideways only, unless it captures both axes; then vertical wheels pan it and the page stays still.
- On touch, vertical swipes over the loop and an x-capturing grid scroll the page.
- Revert mid-throw: the throw stops, and the markup, including `style` attributes, matches its pre-build state exactly.
- Reduced motion: both still drag, with no throw and no drift; the loop still lands on an item.
- A registered CustomEase name passed as `ease` shapes the landing, like every recipe's `ease` option.
- `flickCards`: the front card is the only card not `inert`; neighbors mirror on both sides; far cards are hidden.
- A drag past the threshold or a fast flick deals the next card; a short slow drag springs back. One card per gesture.
- Arrow keys on the deck, `next`, `prev`, and `toIndex` take the shortest way round; focus in a card leaving the front moves to the deck.
- A click on a leaning card deals it; a click on a link in the front card follows it; a drag over that link does not.
- Revert mid-deal restores the markup, `style` attributes, and each card's `inert` exactly. Reduced motion deals at once.

## Physics

- Every piece is `aria-hidden`, without ids, inside the layer, and removed when its flight ends; `finished` resolves then.
- `stop()` removes every piece at once and is safe twice; the layer itself is never created or removed.
- Live pieces across runs never exceed the budget; ended runs free it.
- Rain pieces start above the layer and fall out the bottom; burst pieces rise from the origin before falling.
- Reduced motion spawns nothing and `finished` is already resolved; the triggering action is never delayed.

## SVG, counters, and marquees

- Drawn strokes start hidden without a flash and end at the SVG's own appearance after revert.
- A morphed icon returns to its original `d` on revert; `set()` after revert does nothing.
- Counted figures keep prefix, suffix, separators, and decimals and end on the exact source text. Test three or more decimals, such as `99.999%`, and the page locale's decimal mark.
- While counting, neighbors do not shift and assistive technology finds only the final value.
- Marquee clones are `aria-hidden` and `inert` with no duplicate ids; each item is announced and focused once.
- The marquee loops seamlessly, slows on hover, and pauses on focus, off screen, and on `pause()`.
- Resizing rebuilds the clones to fill; revert restores the original markup exactly.
- Logo cycle: one cell swaps at a time, never the same cell twice running; every logo exists once, in a cell or the pool. It holds on `pause()`, hover, focus inside, and off screen, and revert returns every logo to its original place with its `style` attribute exact.
- Reduced motion: strokes whole, figures final, no follower, marquee static; completion callbacks fire.

## Smooth scroll, covers, and layout

- Smooth scroll: wheel and trackpad ease; keyboard, scrollbar, find-in-page, and touch stay native. `stop()` holds the page; `scrollTo(..., { immediate: true })` still lands while stopped. ScrollTrigger effects fire at the eased position. `destroy()` removes the engine's classes, styles, and ticker callback. Reduced motion creates nothing.
- Curtain with `tilt`: panels lean in, sit square while covered, and tip the other way out. With `title`: the text shows only while covered and restores on revert.
- Curve cover: mid-sweep the edge's middle leads its corners; covered, the path fills the viewBox and takes clicks; revealed, it is hidden, empty, and click-through. A cover mid-reveal or reveal mid-cover turns the edge back. Reduced motion never shows it; revert restores the `<svg>` style and the path's `d`.
- Curtain: at rest the panels are hidden and the page takes clicks; covered, the panels take them. A cover requested mid-reveal turns back from where the panels are. Reduced motion never shows a panel, and both timelines complete.
- Preloader: the count follows reported progress forward only, `aria-valuenow` matches it, and `finish()` leaves it hidden and out of the accessibility tree.
- Layout Flip: survivors slide, entering items grow in, leaving items shrink out while still displayed, and no target keeps an inline transform. The app's inline styles survive. A shared element morphs from the old box onto the new element, never onto a hidden original.
- Use the framework skill's `references/smooth-scroll.md` and `references/transition-archetypes.md` checks for navigation, history, and recovery.

## Media, components, and hover

- Menu: links are out of the tab order at rest; `close()` mid-open turns the wipe back from where it is; revert leaves no inline style.
- Enter and exit: the closed state paints at build, before GSAP's first tick; `close()` from the open rest plays the exit, not the entrance reversed; `close()` mid-entrance reverses without reaching the exit, and `open()` mid-exit returns to the pause; each rest fires its callback once; `easeReverse` changes the reversed curve; revert restores inline styles.
- Dialog: focus lands inside through `showModal()` and returns to the trigger natively; Escape runs the exit while `open` stays true, then closes; `close(value)` sets `returnValue`.
- Disclosure: hidden or closed-`<details>` panels are collapsed at build; `open()` ends at the exact content height with no inline `height` or `overflow`; an interrupted open shrinks from its current height.
- Tab indicator: its own box never changes; it lands within half a pixel of the tab, in RTL and after a sibling tab resizes.
- A waiting `onScroll` image reveal is clipped yet visible and in the accessibility tree; focus inside it opens it without scrolling.
- The hover preview appears at the pointer, crossfades between items, hides on leave, ignores touch and pen, and a tap still follows the link.
- Scrub video builds nothing before metadata and returns `currentTime` to 0 at the top. The frame sequence loads nothing until its section nears, draws the nearest loaded frame when others fail, and teardown aborts loads.
- Roll, sweep, and zoom answer the mouse and `:focus-visible` and ignore touch and pen; focus left by a tap or click does not hold them.
- `textRoll` keeps the control's box and accessible name, its copy is `aria-hidden` without duplicated ids, and tight `line-height` crops no ascenders or descenders.
- Reduced motion: reveals complete unclipped with callbacks, preview and video build nothing, the sequence draws one still, no roll or zoom, and the underline appears without moving.

## Paging and sound

- Pager: one trackpad flick with a long inertia tail moves exactly one section; the next flick after a rest moves again.
- Swipes page on touch, pinch-zoom still works, and swipes inside `data-pager-ignore` scroll that element.
- Arrow, Page, Home, End, and Space keys page from the body; fields, tablists, and Space on a control keep their keys.
- Tabbing into a parked section shows it at once; neither the pager nor the document scrolls.
- `disable()` stops gestures and keys; revert restores the scrolling layout and the document's `overflow`.
- Sound: no audio context exists until the toggle is pressed; a stored "on" unlocks on the first gesture.
- Repeated cues respect the gap and voice cap; cues on reversed timelines stay silent.
- Hiding the tab suspends audio; turning sound off fades, then suspends; revert closes the context.
- Reduced motion: the pager swaps instantly with `onChange` still firing; sound follows only its toggle.

## Effect failure and restoration

- Throw before writes, after initial styles, and after a split or particle resource exists. Partial setup rolls back even without a returned handle.
- Owned timelines, delayed calls, tickers, observers, and listeners stop before restoration. Teardown twice stays safe and recreates no motion.
- After rollback, original nodes, text, links, ARIA, and app-owned inline styles match. Check hidden ancestors and masks, not just opacity.
- Inline-style comparisons include both values and `getPropertyPriority()`; authored `!important` declarations survive restoration across all snapshot helpers.
- Deferred font or media work resolving after recovery starts no new split, hidden frame, or decorative completion.
- Use the framework skill's `references/initialization.md` failure matrix for disabled JavaScript, blocked bundles, deadlines, navigation, and completion ownership. Repeat these checks with another brand's fonts and CSS.

## SplitText cleanup stability

Apply [stable typography](text-stability.md#stable-typography-for-character-animation) and measure with the actual font, tracking, text, and container width:

1. Capture the unsplit baseline after fonts load and target CSS applies. Record computed font, variation, and feature settings, tracking, leading, kerning, and ligatures.
2. At the completion boundary, measure just before revert, just after, and on the next frame, capturing both painted states at equal scale. Holding at that boundary is fine; removing cleanup is not.
3. Compare non-space character positions with DOM `Range` rectangles, re-querying text nodes after revert. Check heading height, line membership, and glyph edges, dots, and descenders. Wrapper rectangles cannot separate mask padding from glyph movement.
4. Repeat at desktop and mobile widths, near a line-break threshold, with reduced motion, and with interruption. Separate intended weight or tilt changes from cleanup movement. Accessible text and nested controls survive.
5. With expanded masks, inspect both hidden reveal endpoints and the exit endpoint for ink leakage. Keep timing fixed; adjust travel only when leakage appears.

Record viewport, browser, font readiness, maximum position deltas, height, wrapping, and visual observations, without rounding to whole pixels. A repeatable multi-pixel snap fails even with stable height; invisible subpixel rounding does not.

## Report

Say which checks ran in a browser and which were static review. Never claim animation behavior was verified from code alone.
