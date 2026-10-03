<!-- Generated from shared/initialization.md; run scripts/sync_initialization.py. -->

# Invisible intros, recovery, and first load

Read this whenever an entrance hides meaningful content. The matching framework skill owns initialization, navigation, recovery, and interruption. Motion recipes own teardown and restoration of their changes. Styles select the look and pacing only.

## Keep the successful intro

Build readable, settled HTML and CSS first. Preserve invisible-to-visible entrances with a small early script and scoped pre-paint CSS:

```css
html[data-motion-boot="pending"] [data-motion-owner][data-phase="initial"][data-intro],
html[data-motion-boot="pending"] [data-motion-owner][data-phase="initial"] [data-intro] {
  visibility: hidden;
}
```

Names are examples. Use separate attributes for boot status, motion preference, and lifecycle phase. Rename a `data-motion="js"` boot example if the app already uses `data-motion="full|reduced"` for preference. Opt in only targets intended to enter visibly, including hidden ancestors, shell, cards, and footer. Give independent owners their own readiness records. One ready page must not cancel a footer's protection.

- Run the marker before content can paint, using the framework's document integration and CSP nonce/hash support. Arm its recovery timer before setting the marker. It must work without GSAP or the application bundle. If the marker is blocked, content stays readable.
- Never emit the active marker in server HTML. JavaScript disabled means no marker and readable HTML. A `noscript` override alone does not cover JavaScript enabled with a failed bundle.
- Skip hiding under reduced motion. Preserve completion, focus, navigation, and removal semantics through the instant path.
- Before releasing CSS hiding, prepare all required start values and attach the entrance's completion/interruption handlers. Start the timeline in the same turn. Do not flip the phase early to claim readiness: that can flash settled content.
- Do not hide server content through unconditional CSS, inline styles, client-only wrappers, or a hidden ancestor that the fallback cannot restore.

## Data readiness and layout stability

A mounted node or the first query response does not mean the visible layout is ready. Have the application's data layer tell the framework controller when each owner has the state that determines its content and geometry. Keep this separate from animation initialization.

- Distinguish unresolved authentication from signed out, a pending query from a resolved empty result, and an initial connection handshake from a sustained disconnect. Do not enter guest prompts, empty lists, zero scores, or reconnect warnings just because those values have not arrived yet. Include browser-restored state when it changes the initial controls or content.
- Identify dependent queries before choosing the reveal boundary. If several sections insert above or resize one another, reveal that group after its structural dependencies resolve. Fetch independent dependencies concurrently. If sections can load independently without moving visible content, give each a reserved region and its own entrance; do not delay the primary heading for unrelated below-fold data.
- Keep the geometry owner outside conditional loading/content branches. Use matched skeletons or minimum sizes where dimensions are predictable; reserve authentication controls, image/avatar dimensions, and status rows. When the final size is unknown, use a quiet loading region until it is known instead of displaying a false final layout. Resolve genuinely absent sections without leaving permanent empty space.
- Include persistent chrome in the audit. A footer can flash near the top before a long page arrives; a late sign-in control can move every navigation tab. Keep their positions stable or coordinate their reveal with the region that determines their position.
- Do not label a normal initial handshake as a reconnect. Delay brief status notices when appropriate, and use a reserved slot or an unobtrusive overlay for sustained connection notices so they do not push the page. Preserve useful offline/error feedback and an accessible loading status.
- Prepare initial styles for the resolved content before releasing its gate. Give elements present at first reveal one entrance owner, including initially open conditional panels. Later data updates do not replay the whole page; a newly appearing region may own its own entrance.

An animation recovery timeout must restore the application's **current valid state**. If data is still pending, expose its usable loading/error state, not a guessed guest or empty state. Keep the application's request cancellation, retry, and error handling; a motion deadline neither completes a query nor permits indefinitely hidden content. Once data arrives, the controller uses that owner's current visit/recovery decision before entering or settling it.

## Bound initialization, not choreography

Give each incoming owner an initialization deadline, measured from its first pre-paint hiding. Choose and document a short budget; roughly one second is a starting point, not a universal performance target.

The early timer covers bundle delivery and hydration. Register recovery before any setup work, including plugin registration, selectors, initial writes, and splits. Keep the deadline armed through required font/media preparation and timeline construction. Registration or a `live` flag is not readiness. Handing off timers must leave no unprotected interval and must not restart the budget.

A successful handoff occurs only when the prepared intro can run with its handlers attached. Cancel the initialization timer then. A deliberate hold or stagger inside that timeline belongs to animation duration, even if it exceeds the initialization budget. Handle runtime exceptions and interruptions separately; if a running timeline needs a watchdog, derive it from its planned duration, delay, repeats, and pause policy. Never cut a healthy intro short with the boot timer. Recheck deadlines on return from a suspended tab; timers cannot recover a blocked main thread.

Wait only for dependencies the effect needs. Bound font readiness, image load/decode, SplitText auto-split preparation, and frame waits. Prefer reserved image dimensions and a fallback font or unsplit heading over waiting for every font, image, or window `load`. A timed-out promise may still resolve: racing it does not cancel its continuation.

## Recover one owner

Track an owner, a visit/generation token, and a terminal recovery decision outside disposable effect setup. Use boot status such as `pending`, `running`, `recovered`, `disposed` separately from the framework's lifecycle phases. A recovery is permanent for that visit; a genuine later navigation may create a new visit. Repeated setup is not a new visit.

On timeout, rejection, setup exception, or failed entrance:

1. Verify the captured owner and generation are still current and intended to be visible. Invalidate the generation first. Mark it recovered so reentrant handlers cannot restart it.
2. Abort preparation where supported. Cancel queued frames, timers, event listeners, observers, and subscriptions that can recreate motion. Kill owned timelines, delayed calls, triggers, and ambient effects before restoring content. Do not kill unrelated GSAP work globally.
3. Run registered effect teardown in reverse order. Each builder must roll back partial changes if it throws before returning a handle. Continue other cleanup if one disposer throws; always reach the final readable fallback.
4. Revert split wrappers, masks, cloned accessibility text, and plugin DOM changes. Preserve framework-owned nodes and nested links/controls; never overwrite their subtree with a stale HTML snapshot. SplitText revert can reconstruct descendants: split a dedicated text leaf or visual copy when controls, state, or framework bindings must survive. Restore only owned inline properties to their original values, then apply the owner's readable settled state. A marker removal or `autoAlpha: 1` alone cannot undo clipping, transforms, child opacity, or a hidden parent. Avoid `clearProps: "all"` on application-owned styles.
5. Release only this owner's hiding, cover, busy/inert state, and navigation lock. Apply essential settled completion once, including appropriate focus and transition `done`. Do not replay decorative effects or call an outgoing navigation callback as entrance completion.

The bootstrap must retain a terminal recovery record even before the bundle arrives. With no application changes yet, it can release its CSS gate alone. Once setup starts, it must invoke the registered rollback as well. Releasing a shared document gate must not expose other still-preparing owners; use per-owner gates or transfer every owner's initial values before releasing it.

Every async continuation and controller entry point checks its captured token **before any DOM write or effect creation**, including `set`, `fromTo`, `onSplit`, resize/font callbacks, and `contextSafe` callbacks. Context ownership does not cancel promises. Catch failures inside those callbacks too. Late controller registration reads the terminal boot record and settles without hiding or splitting. Do not infer recovery only from an absent marker that navigation can later recreate.

On navigation, deactivate the outgoing owner's entrance recovery before the outro. Cancel stale work without revealing that owner. Recovery must exclude outgoing/end-state pages, cached hidden routes, closed dialogs, inactive tabs/panels, and decorative clones. Restore the outgoing page only if navigation itself is cancelled and that page becomes current again. Persistent shell elements keep separate visits. Dispose obsolete recovery timers on removal; never let them unlock or focus a newer route.

## Rendering and indexing

Keep primary text, headings, and meaningful links in server-rendered or prerendered HTML where supported. Preserve real `a[href]` links and independently accessible route URLs. Client-only rendering cannot reveal HTML that was never sent; provide a useful static shell/fallback and report that limit. Do not turn an entire page client-only to facilitate animation.

Google renders JavaScript and uses rendered HTML for indexing. An automatic intro does not inherently prevent indexing; that is an inference from Google's rendering model, not a guarantee for a particular page. Check rendered output when indexing is in question. Static hiding rules alone do not establish production indexing failures. See [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

Do not require a click, scroll, or hover to load primary indexable content. Keep primary hero media eagerly discoverable; reserve lazy loading for appropriate offscreen content. See [Google's lazy-loading guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading).

## First-load performance

Initially hidden primary content can delay Largest Contentful Paint. LCP concerns eligible visible content painted in the viewport, not the end of a GSAP timeline. A heading or hero may become a candidate before the remaining stagger, footer, or ambient animation completes. Browser eligibility and candidate changes matter; do not calculate LCP from total timeline duration. See [Largest Contentful Paint](https://web.dev/articles/lcp).

Reveal primary headings and hero imagery without waiting for unrelated plugins, particle setup, below-fold media, or every font weight. Keep ambitious motion where requested; reduce unnecessary preparation and deliberate blank holds before weakening the effect. Never serve crawler-specific content or use near-zero opacity tricks to manipulate metrics.

Measure cold first loads separately from client-side transitions. Record the LCP element and timestamp, resource timing, layout shift, and a filmstrip under representative network/CPU conditions. Compare normal and reduced motion; use field data when available. Smooth route transitions do not prove fast document loads. Better performance does not promise ranking or indexing outcomes. See [Google's page-experience guidance](https://developers.google.com/search/docs/appearance/page-experience).

## Failure verification

Use the framework's production build and actual rendering mode. For every supported failure, assert meaningful text, usable links, restored owned styles/DOM, and absence of stale cover, lock, focus, or completion effects. Check page and shell owners separately.

| Case | Required observation |
|---|---|
| JavaScript disabled | Server/static content and native links work. Client-only routes get their documented static fallback, not invented SSR content. |
| Bundle blocked after marker | Prove the early marker executed; let its deadline expire. Content becomes readable without application cleanup. |
| Setup throws before initial writes | Readable settled state; no unresolved completion or navigation wait. |
| Setup throws after styles or split DOM | Timelines stop, original text/links return, temporary styles and masks disappear. |
| Fonts/media stall or reject | Bounded fallback. Resolve them afterward and confirm no new hiding or splitting. |
| Initialization arrives after recovery | Observe multiple frames after release and beyond the old timeline/deadline. No hidden frame or duplicate completion. |
| Successful delayed startup within budget | Hidden first frame, then full intended intro. No flash of settled content; intentional duration may exceed the boot budget. |
| Authentication and personal data resolve separately | No guest, empty, or zero-value content appears before its state is known. Test signed-in and signed-out visits. |
| Primary query resolves before dependent sections | The chosen group enters with its final structure, or reserved regions enter independently without moving visible siblings. |
| Initial handshake, brief disconnect, sustained disconnect | No startup warning flash; persistent feedback remains usable without shifting navigation or page content. |
| Motion deadline expires while data is pending | Recovery shows the current loading/error state. Late data cannot expose a stale branch or restart a recovered owner's animation. |
| Reduced motion | Readable first paint, functional links, normal completion semantics without travel. |
| Navigation during preparation or intro | One correct destination; stale recovery cannot reveal outgoing/hidden content or unlock/focus the new visit. |
| Repeated setup, history, and preserved nodes | No duplicate wrappers, listeners, callbacks, or replay after recovery within the same visit. |

Block only application resources in the bundle test, not the early script or stylesheet. Distinguish an intentionally delayed intro from stalled preparation. Record what ran, rendering limitations, and remaining browser/production gaps; these checks do not prove Google indexed the page or establish field LCP.
