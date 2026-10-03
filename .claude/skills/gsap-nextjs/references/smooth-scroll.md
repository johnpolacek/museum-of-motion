<!-- Generated from shared/smooth-scroll.md; run scripts/sync_initialization.py. -->

# Smooth scrolling across navigation

Read this when the site uses Lenis, GSAP's ScrollSmoother, or another scroller that eases the page. The framework skill owns when the scroller is created, stopped, moved, and destroyed. The `animaxxing` skill's `references/recipes/smooth-scroll.md` supplies the engine controls: `stop`, `start`, `scrollTo`, `resize`, `destroy`. Check the installed engine's version and docs before trusting option names.

Smoothing is optional. Add it only when requested; it changes how every page feels and costs a frame loop on every device.

## One scroller per document

- Create the scroller once, from the persistent shell or root layout, before any page creates a ScrollTrigger. ScrollSmoother must exist before the triggers it drives; Lenis must be stepping before triggers measure.
- Never create or destroy it in a page or route component. A page remount would reset the scroll, drop the easing mid-flight, and duplicate ticker callbacks.
- Where the router replaces the whole body on each swap, only a window-level engine such as Lenis survives. A wrapper-based engine such as ScrollSmoother must be recreated with each body; prefer Lenis there. Full-document navigations create one scroller per document.
- Destroy it when the shell itself unmounts: a full reload, hot module replacement, or a test harness teardown. In development, React StrictMode and HMR run setup twice; the second create must follow a completed destroy.
- Skip smoothing under reduced motion, including the app's own motion setting. The recipe returns native controls, so the controller calls the same methods either way. Recreate the scroller when the motion setting changes.
- Keep native scroll semantics: keyboard, scrollbar, find-in-page, focus, and touch. Mark nested scroll areas, such as menus and code blocks, so the engine leaves them alone.
- Lenis scrolls the window: the document must be the scroll container, not a fixed-height shell with its own `overflow`. Import its stylesheet once from the shell's global styles. A stopped Lenis clips the root's overflow, which hides a classic scrollbar and reflows the page on every outro; give `html` `scrollbar-gutter: stable`.

## Through a navigation

Scroll position is part of the swap. The router, the engine, and ScrollTrigger must agree on it at every phase.

| Phase | Scroller |
|---|---|
| First load | Create it before the first intro. If the intro hides content, keep it stopped and `start()` at that intro's settled, as after any navigation. The page's controller exposes that settled moment. |
| Outro | `stop()`, so the user cannot scroll the outgoing page out from under its exit or a closing curtain. |
| End state and swap | Stays stopped. Let the router, or the browser, reset or restore the native position. A stopped ScrollSmoother pushes that native scroll back on its next scroll event, so with ScrollSmoother the sync below must run in the same task, such as a microtask after the router's commit. |
| Router scroll landed | `scrollTo(window.scrollY, { immediate: true })` so the engine's target matches the native position: the top for a new visit, the saved position on back and forward, the anchor for a hash. Most routers scroll as the page mounts; some only during the intro, so sync whenever it lands. When nothing scrolls for you, move to that position here instead. |
| Intro built | Once the incoming page's triggers exist and the scroll has landed, `resize()` refreshes ScrollTrigger. The recipe's immediate `scrollTo` already re-measures the engine, so this call is for the triggers. Refresh once, after the last trigger, not per component. |
| Settled | `start()`. |

- Back and forward take the intro-only path. Restore the saved position immediately, never with an eased scroll from the previous page's position.
- The sync matters most for ScrollSmoother, which would otherwise ease its content from the old position to the new one. Lenis 1.3 follows native jumps on its own, even while stopped; the sync is harmless there.
- In-page hash links: many router links treat them as navigations and scroll to the anchor themselves. To ease them, follow the framework skill's interception path, then `scrollTo(hash)`. Lenis's own `anchors` option suits pages where the browser handles hash clicks; where a router intercepts them, it double-handles the click. Either way, move focus to the target for keyboard and screen reader users.
- Every path that ends a navigation without reaching settled, such as a failure, a cancellation, or a ready timeout, also calls `start()`. A stopped scroller left behind freezes the page.
- Interrupting an intro mid-way still leaves the scroller in a known state: stopped until the replacement settles.
- If the router or the browser restores scroll, leave it on and sync the engine afterwards. If you take restoration over (`history.scrollRestoration = "manual"`), save and restore positions per history entry yourself; never leave both fighting.

## ScrollTrigger with a smoother

- Lenis moves the window, so triggers use the default scroller. ScrollSmoother registers itself as the default, so triggers need no `scroller` either. A custom scroller element passes the same `scroller` to every trigger.
- Pins and ScrollSmoother: `position: fixed` inside the smoothed content breaks, because the content moves with a transform. Keep fixed UI, including the header and any curtain, outside the smoothed wrapper, and pin with ScrollTrigger instead of CSS `fixed` inside it.
- Refresh after anything changes page height: fonts, images, streamed regions, accordions, and route swaps. With Lenis, call its `resize()` too; the recipe's `resize()` does both.
- Page effects tear down their own triggers on unmount. The scroller survives, so a stale trigger from the old page keeps firing against the new page until it is killed.

## Verify

- Wheel, trackpad, keyboard, and scrollbar all scroll; touch stays native unless requested otherwise.
- During an outro the page cannot be scrolled; after the swap it starts at the router's position with no visible jump.
- Back and forward land on the saved position immediately, and the next wheel continues from there, not from the previous page.
- Pinned sections and reveals on the new page trigger at the right positions after a navigation, a resize, and late image loads.
- Reduced motion: no smoothing, and every control still works.
- Hot reload and StrictMode leave exactly one scroller and one ticker callback.
