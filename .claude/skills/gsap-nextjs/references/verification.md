# Verification

Check in proportion to what changed. Do not turn a focused animation task into a full audit.

## Always

- Run the repo's type, lint, format, and test commands where they exist.
- Confirm settled content is visible, interactive, and free of leftover GSAP inline styles.
- Confirm timelines, triggers, listeners, and plugin DOM changes are cleaned up.
- Test reduced motion: the same settled state, every completion callback fired.
- At phone width: readable text, stable boxes, no horizontal overflow.
- Touch-treated controls release after taps. For device changes, run the [device checks](devices.md#verify).

## Initially hidden content

Run the [failure verification matrix](initialization.md#failure-verification) when adding or changing hiding, preparation, or recovery. It covers disabled JavaScript, a blocked bundle after the marker, throws before/after styles and splits, stalled fonts/media, late initialization, no-flash success, reduced motion, and interruption/repeated setup. Assert text and native links, not opacity alone. Include shell/footer and intentionally hidden content.

Use this framework's [integration rules](motion-system.md#initialization-and-recovery) for rendering and navigation expectations. Measure document-load LCP separately from transitions when first-load behavior changes; report measured results and untested paths.

## Runtime changes

For loading changes, stagger authentication, the first query, dependent queries, and font delivery. Inspect frame-by-frame on cold desktop/mobile loads. Assert the correct branch at first reveal, stable navigation/footer positions, and no entrance replay on ordinary data updates. Record layout shifts as well as filmstrip observations; zero CLS alone does not prove that no temporary content flashed. Cover signed-in and signed-out states, resolved empty results, reduced motion, and navigation while data is pending. Label mocked auth checks separately from authenticated browser sessions.

Check the changed lifecycle in a real browser when practical:

- Initial state is applied before reveal.
- Intro ends in one settled state.
- Outro keeps the node mounted until completion runs.
- Rapid or interrupted input ends in one coherent state.
- Layout boxes do not jump.

For route navigation, test the paths the change affects: an ordinary internal link, back and forward, and a rapid double navigation. Confirm URL, visible route, focus, history, and scroll agree.

With `cacheComponents` on, also navigate away and back. The returning route must re-run initial state and intro on its preserved DOM with no doubled tweens, and scroll triggers must measure correctly after re-show. Use visibility-aware selectors in browser tests, such as role queries or an explicit visible filter, since hidden routes stay in the DOM.

When both `<ViewTransition>` and GSAP are involved, confirm no element is animated by both and that clicks land during a running transition.

For conditional components, test show, hide, and one interruption. Confirm unmount happens after the outro.

## Smooth scrolling and transition archetypes

Run the checks in [Smooth scrolling](smooth-scroll.md#verify) and [Transition archetypes](transition-archetypes.md#verify) when the change touches them. In the App Router also confirm:

- After a link the page starts where Next.js put it: the top of the first page element, the hash target, or unchanged with `scroll={false}`. After back and forward, the browser's restored position, with no eased travel from the old page and no jump when `start()` runs.
- Fast Refresh on the boundary's file and StrictMode leave one scroller and one ticker callback.
- A ready timeout under a closed curtain reveals the page, and a `POP` during a covered swap ends uncovered.
- With `cacheComponents`, the shared-element morph moves the visible target rather than the Activity-hidden copy, and a re-shown route never shows the preloader.

## Builds and wider checks

Run a production build for changes to routes, Next config, dependencies, server and client boundaries, or anything release-facing. Run wider browser, accessibility, responsive, streaming, and performance checks only when the change touches them or the user asks for a full audit.

Report which checks ran and which could not. Do not claim runtime behavior was verified when only static review was possible.
