# Recipe: scroll effects

Fourteen scroll-linked effects: reveals, a scrubbed statement, parallax, a pinned scene, cards that stack as they pin, a zoom through to the next layer, a horizontal run with optional item drift, an element that travels between waypoints, a progress rule, a velocity skew, a header theme that follows the section beneath it, a scroll direction state, a header that shrinks to a slim bar, and a header label that names the current section.

Lifecycle: the framework controller builds these once the owner is measurable, refreshes ScrollTrigger when fonts, media, data, or scroll restoration change layout, and calls each idempotent teardown on unmount. Builders never kill triggers they did not create. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Route changes and scroll memory: ScrollTrigger remembers the scroll position and puts it back after each refresh. It records that position when a `gsap.matchMedia()` sets up and at the start of a refresh, but not while its triggers are reverted, which is the state between the old page's cleanup and the new page's setup. So after a client route change, the first refresh can put back the previous page's position, clamped to the new page's height: leaving a long page at 1400px for a short one lands the short one at its bottom. The same memory can make Back look right by accident. In an app that changes pages without a reload, keep one position per page or history entry yourself, restore it once the new page is drawn, and reapply it after each `refresh` event until the visitor scrolls; call `ScrollTrigger.clearScrollMemory()` on `popstate`. A link visit starts at the top or its hash target, as the router decides.

Dependencies: `gsap`, `gsap/ScrollTrigger`. `scrubStatement` also needs `gsap/SplitText`; `scrollWaypoints` needs `gsap/Flip`.

Setup: `scrubStatement` with `by: "chars"` needs [stable typography](../text-stability.md#stable-typography-for-character-animation); words keep natural kerning. Verify the revert with the [cleanup checks](../verification.md#splittext-cleanup-stability).

Nested scrollers: `scroller` points every builder at an element that scrolls on its own, such as a panel or a demo window. The browser scrolls that element before any script runs, and ScrollTrigger pins inside it with a transform set a frame later, so a pinned section hops on every wheel step and scrubbed moves trail the content. Drive the element with [smooth scroll](smooth-scroll.md#scrolling-an-element)'s `lenisScroll({ wrapper, content })` so the scroll and the pin land in the same frame. `ScrollTrigger.normalizeScroll` is built for the document and does not fix a nested scroller. Touch stays native unless `syncTouch` is set; check pins on a phone. Pins on the document's own scroll use fixed positioning and do not hop.

```ts
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(ScrollTrigger, SplitText, Flip);

/* Swap for the project's helper if it has one. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Seconds the scrubbed playhead takes to catch up with the scrollbar. `true` locks it. */
const SCRUB = 0.6;
/** Where a reveal fires: the item's top crosses this line of the viewport. */
const REVEAL_START = "top 85%";
/** Opacity of unread words in a scrubbed statement. */
const UNREAD = 0.15;
/** Largest velocity skew, degrees. */
const MAX_SKEW = 8;
/** Scroll velocity (px/s) per degree of skew. */
const SKEW_PER = 300;

export type Teardown = () => void;
export type Scroller = Element | string | undefined;

type Register = (fn: () => void) => void;

/**
 * Runs setup in its own GSAP context, which reverts its tweens, triggers, pins, and splits (SplitText 3.13+).
 * Returns a once-only teardown that also rolls back a throw. `dispose` stops writers before the revert; `after` restores after it.
 */
function own(setup: (dispose: Register, after: Register) => void): Teardown {
  const ctx = gsap.context(() => {});
  const disposers: Array<() => void> = [];
  const restores: Array<() => void> = [];
  let done = false;
  const teardown = () => {
    if (done) return;
    done = true;
    let failure: unknown;
    const attempt = (fn: () => void) => {
      try {
        fn();
      } catch (error) {
        failure ??= error;
      }
    };
    disposers.splice(0).reverse().forEach(attempt);
    attempt(() => ctx.revert());
    restores.splice(0).reverse().forEach(attempt);
    if (failure) throw failure;
  };
  let failure: { error: unknown } | undefined;
  // Catch inside add: GSAP restores its current context only when add returns.
  ctx.add(() => {
    try {
      setup((fn) => disposers.push(fn), (fn) => restores.push(fn));
    } catch (error) {
      failure = { error };
    }
  });
  if (failure) {
    teardown();
    throw failure.error;
  }
  return teardown;
}

/** Inline properties a scrubbed scene may leave behind. */
const SCENE_PROPS = ["transform", "translate", "rotate", "scale", "opacity", "visibility", "filter", "clip-path"];

/**
 * Records these inline properties and returns a restore. Reverting a scrubbed, pinned
 * timeline can leave start values inline; `clearProps` also resets GSAP's cached transform.
 */
function snapshotStyles(elements: HTMLElement[], props = SCENE_PROPS): () => void {
  const saved = elements.map((element) => props.map((prop) =>
    [element.style.getPropertyValue(prop), element.style.getPropertyPriority(prop)] as const));
  return () =>
    elements.forEach((element, i) => {
      gsap.set(element, { clearProps: props.join(",") });
      props.forEach((prop, j) => {
        const [value, priority] = saved[i]?.[j] ?? ["", ""];
        if (value) element.style.setProperty(prop, value, priority);
        else element.style.removeProperty(prop);
      });
    });
}
```

## revealOnScroll

Items rise in batches as they cross into view, once by default. With `repeat`, scrolling back up past an item sends it out again, quick and straight, and it rises again on the way back down. Items already past `start` (reload, restored scroll) reveal at once. Waiting items are transparent, not hidden, so they stay in the accessibility tree and tab order; focus reveals one at once.

```ts
export type RevealOptions = {
  start?: string;
  /** Rise distance in px. */
  y?: number;
  /** Starting scale, such as 0 for a pop; omitted leaves scale alone. */
  scale?: number;
  /** Starting rotation in degrees; omitted leaves rotation alone. */
  rotation?: number;
  duration?: number;
  stagger?: number;
  /** Accepts a registered CustomEase name. */
  ease?: string;
  /** Hide again when scrolled back above `start`, and reveal again on the way down. */
  repeat?: boolean;
  scroller?: Scroller;
};

export function revealOnScroll(
  targets: gsap.DOMTarget,
  { start = REVEAL_START, y = 16, scale, rotation, duration = 0.42, stagger = 0.09, ease = "power3.out", repeat = false, scroller }: RevealOptions = {},
): Teardown {
  const items = gsap.utils.toArray<HTMLElement>(targets);
  if (!items.length || prefersReducedMotion()) return () => {};
  return own((dispose) => {
    // Reveal tweens start later, outside the context, so they are tracked here.
    const live = new Set<gsap.core.Tween>();
    dispose(() => live.forEach((tween) => tween.kill()));
    // Opacity only: visibility would drop waiting items from the accessibility tree and the tab order.
    const from: gsap.TweenVars = { opacity: 0, y };
    const to: gsap.TweenVars = { opacity: 1, y: 0 };
    if (scale !== undefined) {
      from.scale = scale;
      to.scale = 1;
    }
    if (rotation !== undefined) {
      from.rotation = rotation;
      to.rotation = 0;
    }
    gsap.set(items, from);
    ScrollTrigger.batch(items, {
      start,
      once: !repeat,
      scroller,
      // Leaving is quicker than arriving, straight, with no overshoot.
      onLeaveBack: repeat
        ? (batch) => {
            const tween = gsap.to(batch, {
              ...from,
              duration: duration * 0.6,
              stagger: { each: stagger * 0.4, from: "end" },
              ease: "power2.in",
              overwrite: "auto",
              onComplete: () => live.delete(tween),
            });
            live.add(tween);
          }
        : undefined,
      onEnter: (batch) => {
        const tween = gsap.to(batch, {
          ...to,
          duration,
          stagger,
          ease,
          overwrite: "auto",
          onComplete: () => {
            live.delete(tween);
            gsap.set(batch, { clearProps: "transform,opacity" });
          },
        });
        live.add(tween);
      },
    });
    // Focus can reach an item before it crosses the line; a focused item is never invisible.
    const onFocus = (event: FocusEvent) => {
      const item = event.currentTarget as HTMLElement;
      // Only the reveal's own properties; other effects on the item keep running.
      gsap.killTweensOf(item, "opacity,y,scale,rotation");
      gsap.set(item, { clearProps: "transform,opacity" });
    };
    items.forEach((item) => item.addEventListener("focusin", onFocus));
    dispose(() => items.forEach((item) => item.removeEventListener("focusin", onFocus)));
  });
}
```

Stickers and badges can plop in instead of rising. Leave room around them: the overshoot grows past their boxes.

```ts
// Example: a sticker pops in from above with an elastic overshoot.
revealOnScroll(".sticker", { y: -32, scale: 0, rotation: -20, duration: 0.7, stagger: 0.12, ease: "elastic.out(1, 0.72)" });
```

## scrubStatement

A display statement fills in word by word through the reading zone and empties on the way back. Display copy only; reading text must not depend on scroll position.

```ts
export type StatementOptions = { by?: "words" | "chars"; scrub?: number | boolean; scroller?: Scroller };

export function scrubStatement(
  element: HTMLElement,
  { by = "words", scrub = SCRUB, scroller }: StatementOptions = {},
): Teardown {
  if (prefersReducedMotion()) return () => {};
  return own(() => {
    const split = SplitText.create(element, { type: by === "chars" ? "words,chars" : "words", aria: "auto" });
    const pieces = (by === "chars" ? split.chars : split.words) as HTMLElement[];
    gsap.fromTo(
      pieces,
      { opacity: UNREAD },
      {
        opacity: 1,
        ease: "none",
        stagger: 0.1,
        // clamp(): a statement near the page's end finishes at the bottom of the scroll instead of never.
        scrollTrigger: { trigger: element, start: "clamp(top 80%)", end: "clamp(bottom 45%)", scrub, scroller },
      },
    );
  });
}
```

## parallax

Layers drift at different rates while their section crosses the viewport. `data-parallax` sets each layer's travel in px (negative moves against the scroll); the section is the trigger.

```html
<section class="hero-media">
  <img data-parallax="-40" src="…" alt="…" />
  <p data-parallax="24">…</p>
</section>
```

```ts
export type ParallaxOptions = {
  scrub?: number | boolean;
  /** Trigger bounds; the default spans the section's whole pass through the viewport. */
  start?: string;
  end?: string;
  scroller?: Scroller;
};

export function parallax(
  section: HTMLElement,
  { scrub = true, start = "top bottom", end = "bottom top", scroller }: ParallaxOptions = {},
): Teardown {
  const layers = gsap.utils.toArray<HTMLElement>("[data-parallax]", section);
  if (!layers.length || prefersReducedMotion()) return () => {};
  return own(() => {
    layers.forEach((layer) => {
      const travel = Number(layer.dataset.parallax) || 0;
      gsap.fromTo(
        layer,
        { y: -travel },
        {
          y: travel,
          ease: "none",
          scrollTrigger: { trigger: section, start, end, scrub, scroller },
        },
      );
    });
  });
}
```

Clip the section's overflow when travel would show past its edge. Keep reading text inside its box.

A section at the end of the page never reaches `bottom top`; pass `end: "bottom bottom"` so its travel completes. For a footer the page lifts away to uncover, pin it under the content in CSS and let a layer inside it settle as it appears:

```css
/* The content scrolls up off a footer held at the bottom of the viewport. */
main { position: relative; z-index: 1; background: Canvas; }
.site-footer { position: sticky; bottom: 0; }
```

```ts
// Example: the footer's inner layer rises into place as the page uncovers it.
parallax(footer, { end: "bottom bottom" }); // footer markup: <div data-parallax="-80">…</div>
```

A footer taller than the viewport cannot be held; skip the sticky footer there.

## pinnedScene

Pins a section and scrubs a timeline the caller builds, such as swapping steps or an assembling diagram. `length` is the pinned distance in section heights.

```ts
export type SceneOptions = { length?: number; scrub?: number | boolean; scroller?: Scroller };

export function pinnedScene(
  section: HTMLElement,
  build: (timeline: gsap.core.Timeline, section: HTMLElement) => void,
  { length = 1, scrub = SCRUB, scroller }: SceneOptions = {},
): Teardown {
  if (prefersReducedMotion()) return () => {};
  return own((_dispose, after) => {
    const saved = new Map(gsap.utils.toArray<HTMLElement>("*", section).map((element) => [element, snapshotStyles([element])]));
    let animated: Set<unknown> | undefined;
    // Restore only what the scene animates; other effects inside it keep their inline values. A failed build restores all.
    after(() => saved.forEach((restore, element) => (!animated || animated.has(element)) && restore()));
    const timeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${section.offsetHeight * length}`,
        pin: true,
        scrub,
        scroller,
        anticipatePin: 1,
      },
    });
    build(timeline, section);
    animated = new Set(timeline.getChildren(true, true, false).flatMap((tween) => (tween as gsap.core.Tween).targets()));
  });
}
```

```ts
// Example: three stacked steps; each fades up as the previous one leaves.
pinnedScene(section, (tl, root) => {
  const steps = gsap.utils.toArray<HTMLElement>("[data-step]", root);
  steps.slice(1).forEach((step, i) => {
    tl.to(steps[i], { autoAlpha: 0, y: -24 }).from(step, { autoAlpha: 0, y: 24 }, "<");
  });
}, { length: 2 });
```

Write the static CSS as the readable fallback, all steps stacked and visible; `build` positions them with tweens the context reverts. Animate transforms, opacity, filter, and clip-path only: teardown restores those on the scene's tween targets and leaves other effects' inline values alone.

## horizontalRun

Pins a section and translates its track sideways as the page scrolls. The static CSS is a native horizontal scroller, the fallback without JavaScript. Keyboard focus in the track scrolls the page to that item.

```html
<section class="run"><div class="run-track">…cards…</div></section>
```

```css
.run { overflow-x: auto; }
.run-track { display: flex; width: max-content; }
```

```ts
export type RunOptions = { scrub?: number | boolean; scroller?: Scroller };
export type Run = { revert: Teardown; animation: gsap.core.Tween | undefined };

export function horizontalRun(
  section: HTMLElement,
  track: HTMLElement,
  { scrub = SCRUB, scroller }: RunOptions = {},
): Run {
  if (prefersReducedMotion()) return { revert: () => {}, animation: undefined };
  let animation: gsap.core.Tween | undefined;
  const revert = own((dispose, after) => {
    after(snapshotStyles([track]));
    /** The section's content box, so padding stays visible at both ends of the run. */
    const viewport = () => {
      const style = getComputedStyle(section);
      return section.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    };
    const distance = () => Math.max(0, track.scrollWidth - viewport());
    section.scrollLeft = 0;
    gsap.set(section, { overflow: "hidden" });
    animation = gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${distance()}`,
        pin: true,
        scrub,
        scroller,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
    const trigger = animation.scrollTrigger;
    const onFocus = (event: FocusEvent) => {
      const item = event.target as HTMLElement;
      const travel = distance();
      section.scrollLeft = 0;
      // Pressing a card focuses it too; only keyboard focus should scroll the page.
      if (!trigger || !travel || !item.matches(":focus-visible")) return;
      const left = item.getBoundingClientRect().left - track.getBoundingClientRect().left;
      const x = gsap.utils.clamp(0, travel, left - (viewport() - item.offsetWidth) / 2);
      trigger.scroll(trigger.start + (x / travel) * (trigger.end - trigger.start));
    };
    section.addEventListener("focusin", onFocus);
    dispose(() => section.removeEventListener("focusin", onFocus));
  });
  return { revert, animation };
}
```

Nested effects pass `animation` as their `containerAnimation`; create them after the run and revert them first. Narrow or coarse-pointer tiers may keep the native scroller.

### runDrift

Items inside a run drift sideways against the track as they cross the viewport, so the run reads in depth. `data-run-drift` sets each item's travel in px; put it on an inner element, such as a card's image, so the card's own box stays aligned.

```html
<article class="card"><img data-run-drift="48" src="…" alt="…" /></article>
```

```ts
export function runDrift(track: HTMLElement, run: Run, { scrub = true }: { scrub?: number | boolean } = {}): Teardown {
  const items = gsap.utils.toArray<HTMLElement>("[data-run-drift]", track);
  const containerAnimation = run.animation;
  if (!items.length || !containerAnimation || prefersReducedMotion()) return () => {};
  return own((_dispose, after) => {
    after(snapshotStyles(items));
    items.forEach((item) => {
      const travel = Number(item.dataset.runDrift) || 0;
      gsap.fromTo(
        item,
        { x: -travel },
        {
          x: travel,
          ease: "none",
          scrollTrigger: { trigger: item, containerAnimation, start: "left right", end: "right left", scrub },
        },
      );
    });
  });
}
```

Clip each item's frame so the drift never shows past its edge. Revert `runDrift` before the run's own `revert`.

## scrollWaypoints

One element travels the page: it leaves its own place and moves and scales onto a marker in each later section as that marker reaches the middle of the viewport. A traveller above the viewport's middle at load, such as one in a hero, starts moving from the top of the page. A product shot docking beside each feature, a badge settling into each chapter. Markers are empty boxes the app lays out with CSS where the traveller should land; their size sets its scale.

Each leg is a `Flip.fit` onto the next marker, lasting the scroll distance between stops so the traveller keeps pace with the page. Every ScrollTrigger refresh returns the traveller to its place and rebuilds the legs, so resizes, fonts, and late media re-measure.

```html
<section><img data-traveller src="/phone.png" alt="The app" /></section>
<section><div data-waypoint class="dock-left"></div><h2>Plan</h2></section>
<section><div data-waypoint class="dock-right"></div><h2>Share</h2></section>
```

```ts
export type WaypointOptions = {
  scrub?: number | boolean;
  /** Ease of each leg between stops. */
  ease?: string;
  scroller?: Scroller;
};

export function scrollWaypoints(
  traveller: HTMLElement,
  stops: HTMLElement[],
  { scrub = SCRUB, ease = "power1.inOut", scroller }: WaypointOptions = {},
): Teardown {
  if (prefersReducedMotion() || !stops.length) return () => {};
  return own((dispose, after) => {
    after(snapshotStyles([traveller]));
    const view = () => {
      const box = typeof scroller === "string" ? document.querySelector(scroller) : scroller;
      if (!box) {
        const height = window.innerHeight;
        return { top: 0, scroll: window.scrollY, height, max: document.documentElement.scrollHeight - height };
      }
      return { top: box.getBoundingClientRect().top, scroll: box.scrollTop, height: box.clientHeight, max: box.scrollHeight - box.clientHeight };
    };
    let legs: gsap.Context | undefined;
    const build = () => {
      // Back to its place first: every fit and distance is measured from rest.
      legs?.revert();
      legs = gsap.context(() => {
        const v = view();
        /** Scroll position where an element's middle meets the viewport's, clamped to the scrollable range. */
        const arrival = (element: Element) => {
          const rect = element.getBoundingClientRect();
          return gsap.utils.clamp(0, v.max, rect.top - v.top + v.scroll + rect.height / 2 - v.height / 2);
        };
        const at = [traveller, ...stops].map(arrival);
        const timeline = gsap.timeline({ scrollTrigger: { start: at[0], end: at[at.length - 1], scrub, scroller } });
        stops.forEach((stop, i) => {
          // getVars measures from rest, so each leg ends exactly on its marker whatever came before.
          const fit = Flip.fit(traveller, stop, { getVars: true, scale: true }) as gsap.TweenVars;
          // A leg lasts the scroll between its stops, so the traveller lands as its marker reaches the middle.
          timeline.to(traveller, { ...fit, ease, duration: Math.max(at[i + 1]! - at[i]!, 0.001) });
        });
      });
    };
    build();
    ScrollTrigger.addEventListener("refreshInit", build);
    dispose(() => ScrollTrigger.removeEventListener("refreshInit", build));
    dispose(() => legs?.revert());
  });
}
```

```ts
// Example: the hero image docks into each feature section.
scrollWaypoints(document.querySelector<HTMLElement>("[data-traveller]")!, gsap.utils.toArray<HTMLElement>("[data-waypoint]"));
```

- Keep the traveller out of `overflow: hidden` ancestors and give it a `z-index` above the sections it crosses.
- Markers carry no content; the traveller covers them. Match their aspect ratio to the traveller's, or it distorts.
- The traveller's place in the flow stays reserved, so the first section keeps its layout. Keep text beside the markers readable when the traveller lands.

## scrollProgress

A rule that grows with reading progress through the page or one `section`. It reports state, so it runs under reduced motion too.

```ts
export type ProgressOptions = { section?: HTMLElement; scroller?: Scroller };

export function scrollProgress(bar: HTMLElement, { section, scroller }: ProgressOptions = {}): Teardown {
  const reduced = prefersReducedMotion();
  return own(() => {
    gsap.fromTo(
      bar,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: "none",
        transformOrigin: "0% 50%",
        scrollTrigger: section
          ? { trigger: section, start: "top top", end: "bottom bottom", scrub: reduced ? true : 0.3, scroller }
          : { start: 0, end: "max", scrub: reduced ? true : 0.3, scroller },
      },
    );
  });
}
```

Mark the bar `aria-hidden="true"`; it duplicates the scrollbar.

## velocitySkew

Targets lean with scroll speed and spring back when it stops. Ambient: one surface per page, never reading text.

```ts
export type SkewOptions = { max?: number; scroller?: Scroller };

export function velocitySkew(targets: gsap.DOMTarget, { max = MAX_SKEW, scroller }: SkewOptions = {}): Teardown {
  const items = gsap.utils.toArray<HTMLElement>(targets);
  if (!items.length || prefersReducedMotion()) return () => {};
  return own((dispose) => {
    const clamp = gsap.utils.clamp(-max, max);
    const lean = { skew: 0 };
    // Recorded so the context restores each target's original transform.
    gsap.set(items, { skewY: 0, transformOrigin: "50% 50%" });
    const setSkew = gsap.quickSetter(items, "skewY", "deg");
    let settle: gsap.core.Tween | undefined;
    dispose(() => settle?.kill());
    ScrollTrigger.create({
      scroller,
      onUpdate: (self) => {
        const skew = clamp(self.getVelocity() / -SKEW_PER);
        if (Math.abs(skew) <= Math.abs(lean.skew)) return;
        lean.skew = skew;
        settle?.kill();
        settle = gsap.to(lean, {
          skew: 0,
          duration: 0.8,
          ease: "power3.out",
          onUpdate: () => setSkew(lean.skew),
        });
      },
    });
  });
}
```

## navTheme

The header takes the theme of the section beneath its middle, such as light text over a dark hero. Each `[data-nav-theme]` section gets one trigger; the header's `data-nav-theme` mirrors the section it sits over, and CSS does the rest.

```html
<header class="site-header">…</header>
<section data-nav-theme="dark">…</section>
<section data-nav-theme="light">…</section>
```

```css
.site-header { transition: color 0.3s, background-color 0.3s; }
.site-header[data-nav-theme="dark"] { color: white; }
@media (prefers-reduced-motion: reduce) { .site-header { transition: none; } }
```

```ts
export type NavThemeOptions = { sections?: string; scroller?: Scroller };

export function navTheme(header: HTMLElement, { sections = "[data-nav-theme]", scroller }: NavThemeOptions = {}): Teardown {
  return own((_dispose, after) => {
    const original = header.getAttribute("data-nav-theme");
    after(() => {
      if (original === null) header.removeAttribute("data-nav-theme");
      else header.setAttribute("data-nav-theme", original);
    });
    // The header's own `data-nav-theme` is output, never a section.
    const owners = gsap.utils.toArray<HTMLElement>(sections).filter((section) => section !== header && !header.contains(section));
    // Function values re-measure the header on every refresh.
    const line = () => header.offsetHeight / 2;
    owners.forEach((section) => {
      ScrollTrigger.create({
        trigger: section,
        start: () => `top ${line()}`,
        end: () => `bottom ${line()}`,
        scroller,
        onToggle: (self) => {
          if (self.isActive) header.setAttribute("data-nav-theme", section.dataset.navTheme ?? "");
        },
      });
    });
  });
}
```

This changes color state, not motion, so it runs under reduced motion; the CSS drops the transition. Sections must tile the page for the header to always have a theme; where they gap, it keeps the last one.

## scrollDirection

One trigger over the whole page writes `data-scroll-direction` (`up` or `down`) and `data-scroll-started` (`true` past `top` px) on a target, the root by default. CSS hides the header going down and returns it going up.

```css
.site-header { transition: transform 0.4s cubic-bezier(0.2, 0.7, 0.2, 1); }
[data-scroll-direction="down"][data-scroll-started="true"] .site-header:not(:focus-within) { transform: translateY(-100%); }
/* Keep the header reachable while anything inside it has focus. */
.site-header:focus-within { transform: none; }
@media (prefers-reduced-motion: reduce) { .site-header { transition: none; } }
```

```ts
export type ScrollDirectionOptions = {
  /** Scroll distance in px before the page counts as started. */
  top?: number;
  /** Px of travel in the new direction before it flips, so a jittery trackpad does not flicker the header. */
  threshold?: number;
  scroller?: Scroller;
};

export function scrollDirection(
  target: HTMLElement = document.documentElement,
  { top = 50, threshold = 8, scroller }: ScrollDirectionOptions = {},
): Teardown {
  return own((_dispose, after) => {
    const attributes = ["data-scroll-direction", "data-scroll-started"];
    const original = attributes.map((name) => target.getAttribute(name));
    after(() =>
      attributes.forEach((name, i) => {
        const value = original[i];
        if (value === null || value === undefined) target.removeAttribute(name);
        else target.setAttribute(name, value);
      }),
    );
    let direction = "up";
    let turn = 0;
    const write = (y: number) => {
      target.setAttribute("data-scroll-direction", direction);
      target.setAttribute("data-scroll-started", String(y > top));
    };
    const trigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      scroller,
      onUpdate: (self) => {
        const y = self.scroll();
        const next = self.direction === 1 ? "down" : "up";
        // `turn` is the furthest point reached in the current direction.
        if (next === direction) turn = y;
        else if (Math.abs(y - turn) >= threshold) {
          direction = next;
          turn = y;
        }
        write(y);
      },
    });
    turn = trigger.scroll();
    write(turn);
  });
}
```

Runs under reduced motion: the header still hides and returns, without a transition. Pair it with smooth scroll freely; the trigger reads the eased position.

## headerShrink

A tall header condenses into a slim bar over the first stretch of scroll: its backdrop shortens, the wordmark scales down and condenses, and the nav rises to meet it. Every move is a transform or a font axis, scrubbed to the scroll, so it reverses exactly. The header's own box never changes height, so nothing below it reflows.

```html
<header class="site-header" data-header-shrink>
  <i data-header-bg></i>
  <a data-header-mark href="/">Museum of Motion</a>
  <nav data-header-nav>…</nav>
</header>
```

```css
/* A fixed, tall box; only its parts move. The empty part below the slim bar lets clicks through. */
.site-header { position: sticky; top: 0; height: 140px; display: flex; align-items: center; justify-content: space-between; pointer-events: none; }
.site-header > * { pointer-events: auto; }
[data-header-bg] { position: absolute; inset: 0; z-index: -1; background: white; transform-origin: 50% 0; }
[data-header-mark] { transform-origin: 0 50%; }
```

```ts
export type HeaderShrinkOptions = {
  /** Height of the slim bar, in px. */
  compact?: number;
  /** Scroll distance over which the header condenses, in px. */
  distance?: number;
  /** Scale of the wordmark in the slim bar. */
  mark?: number;
  /** The wordmark's width axis in the slim bar; omit to leave it. */
  stretch?: string;
  scrub?: number | boolean;
  scroller?: Scroller;
};

export function headerShrink(
  header: HTMLElement,
  { compact = 56, distance = 160, mark = 0.5, stretch, scrub = true, scroller }: HeaderShrinkOptions = {},
): Teardown {
  return own((_dispose, after) => {
    const bg = header.querySelector<HTMLElement>("[data-header-bg]");
    const wordmark = header.querySelector<HTMLElement>("[data-header-mark]");
    const nav = header.querySelector<HTMLElement>("[data-header-nav]");
    const parts = [bg, wordmark, nav].filter((el): el is HTMLElement => !!el);
    after(snapshotStyles(parts, ["transform", "translate", "scale", "font-stretch"]));
    // The slim bar's middle sits `compact / 2` from the top; contents rise from the tall header's middle to there.
    const lift = () => compact / 2 - header.offsetHeight / 2;
    const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
    if (bg) tl.to(bg, { scaleY: () => compact / header.offsetHeight }, 0);
    if (wordmark) tl.to(wordmark, { scale: mark, y: lift, ...(stretch ? { fontStretch: stretch } : {}) }, 0);
    if (nav) tl.to(nav, { y: lift }, 0);
    if (prefersReducedMotion()) {
      // No scrub: the header is tall near the top and slim anywhere past `distance`, with no motion between.
      ScrollTrigger.create({ start: distance, end: "max", scroller, onToggle: (self) => tl.progress(self.isActive ? 1 : 0) });
    } else {
      ScrollTrigger.create({ start: 0, end: distance, scrub, scroller, animation: tl, invalidateOnRefresh: true });
    }
  });
}
```

The slim bar covers `compact` px; the rest of the header's box is transparent and click-through, so content scrolls up beneath it. Pair with `scrollDirection` to hide the slim bar going down, or with `navTheme`.

## headerSection

The header names the section beneath it. As a new `[data-header-section]` passes under the header, the label rolls to that section's name: up when scrolling down, down when scrolling up. The label is one element holding text; the builder swaps a copy in and the old one out.

```html
<header class="site-header">… <span class="lab" data-header-label aria-hidden="true">Intro</span></header>
<section data-header-section="Intro">…</section>
<section data-header-section="Work">…</section>
```

```css
/* Both names share one cell while they cross, clipped to the line. Anchor them to the label's fixed edge:
   the cell is as wide as the wider name while both show, so on a label at the header's right, start-aligned
   names would jump sideways as a longer or shorter one arrives. */
[data-header-label] { display: inline-grid; justify-items: end; overflow: clip; }
[data-header-label] > * { grid-area: 1 / 1; }
```

Use `justify-items: start` for a label on the header's left, or `center` for one centered in it.

```ts
export type HeaderSectionOptions = {
  sections?: string;
  /** Where the header's bottom edge sits, in px from the top; a section is current once its top passes it. */
  line?: number | (() => number);
  duration?: number;
  scroller?: Scroller;
};

export function headerSection(
  label: HTMLElement,
  { sections = "[data-header-section]", line = () => label.closest("header")?.offsetHeight ?? 64, duration = 0.45, scroller }: HeaderSectionOptions = {},
): Teardown {
  return own((dispose, after) => {
    const original = label.innerHTML;
    after(() => {
      label.innerHTML = original;
    });
    const reduced = prefersReducedMotion();
    const make = (text: string) => {
      const span = document.createElement("span");
      span.textContent = text;
      return span;
    };
    let current = make(label.textContent ?? "");
    label.replaceChildren(current);
    dispose(() => gsap.killTweensOf(label.children));
    const swap = (text: string, direction: number) => {
      if (current.textContent === text) return;
      const outgoing = current;
      // A swap in flight lands at once: only the newest pair is ever moving.
      gsap.killTweensOf(label.children);
      Array.from(label.children).forEach((child) => child !== outgoing && child.remove());
      current = make(text);
      label.append(current);
      if (reduced) {
        outgoing.remove();
        return;
      }
      gsap.to(outgoing, { yPercent: -100 * direction, duration: duration * 0.6, ease: "power2.in", onComplete: () => outgoing.remove() });
      gsap.fromTo(current, { yPercent: 100 * direction }, { yPercent: 0, duration, ease: "back.out(1.6)", delay: duration * 0.15 });
    };
    const at = () => (typeof line === "function" ? line() : line);
    gsap.utils.toArray<HTMLElement>(sections).forEach((section) => {
      ScrollTrigger.create({
        trigger: section,
        start: () => `top ${at()}`,
        end: () => `bottom ${at()}`,
        scroller,
        onToggle: (self) => {
          if (self.isActive) swap(section.dataset.headerSection ?? "", self.direction);
        },
      });
    });
  });
}
```

The label is decorative, so keep it `aria-hidden` and let real headings name the sections. Under reduced motion the name changes with no roll.

## stackCards

Cards pin one below another as the page scrolls, each sliding over the last, and the cards beneath shrink a little so the pile reads as a deck. When the last card arrives the whole deck scrolls away together. Each card pins on its own trigger, so cards may differ in height.

```html
<section class="deck">
  <article data-stack-card>…</article>
  <article data-stack-card>…</article>
  <article data-stack-card>…</article>
</section>
```

```css
/* Positioned, so each later card paints over the pinned ones. Give cards an opaque background. */
[data-stack-card] { position: relative; }
```

```ts
export type StackOptions = {
  /** Px from the viewport top where the first card pins. */
  top?: number;
  /** Px each later card pins below the one before, so the edges of the deck show. */
  offset?: number;
  /** Scale lost per card stacked on top. */
  shrink?: number;
  scrub?: number | boolean;
  scroller?: Scroller;
};

export function stackCards(
  cards: HTMLElement[],
  { top = 80, offset = 16, shrink = 0.05, scrub = SCRUB, scroller }: StackOptions = {},
): Teardown {
  if (prefersReducedMotion() || cards.length < 2) return () => {};
  return own((_dispose, after) => {
    after(snapshotStyles(cards));
    const last = cards[cards.length - 1]!;
    const pinAt = (i: number) => `top top+=${top + i * offset}`;
    cards.slice(0, -1).forEach((card, i) => {
      // Every card holds until the last one lands on the deck, then all of them leave together.
      ScrollTrigger.create({ trigger: card, scroller, start: pinAt(i), endTrigger: last, end: pinAt(cards.length - 1), pin: true, pinSpacing: false });
      const buried = cards.length - 1 - i;
      gsap.to(card, {
        scale: 1 - shrink * buried,
        transformOrigin: "50% 0%",
        ease: "none",
        scrollTrigger: { trigger: cards[i + 1]!, scroller, start: "top bottom", endTrigger: last, end: pinAt(cards.length - 1), scrub },
      });
    });
  });
}
```

The static CSS is a plain column of cards, the fallback without JavaScript and under reduced motion. Keep each card shorter than the viewport minus `top`, or its lower part scrolls under the next card before it can be read.

## zoomThrough

A small thing becomes the whole screen as the page scrolls. The section pins while a timeline scrubs, then releases. Two modes:

- `scale`: `target` grows from a focus point until the viewer passes through it, then fades, uncovering the layer behind it. Point `focus` at the part to fly into, such as the counter of an "O"; its center becomes the transform origin.
- `clip`: `target`, usually an image or video, opens from a small window (`inset`) to full bleed.
- `push`: `target` is one tile in a grid. The camera flies into it: the whole grid scales and slides until the tile fills the section, and its neighbors sweep past the edges.
- `pull`: the reverse. The section opens on one tile filling it, and the camera pulls back until the grid is whole.

```html
<section class="zoom">
  <figure class="zoom-back">…the layer revealed behind…</figure>
  <h2 class="zoom-front">Every way a page can m<span data-zoom-focus>o</span>ve</h2>
</section>
```

```css
.zoom { position: relative; height: 100vh; height: 100svh; overflow: clip; display: grid; place-items: center; }
.zoom > * { grid-area: 1 / 1; }
```

```ts
export type ZoomOptions = {
  mode?: "scale" | "clip" | "push" | "pull";
  /** `scale` mode: the part of `target` to fly into, HTML or SVG. Defaults to its center. */
  focus?: Element;
  /** `scale` mode: the final scale. */
  scale?: number;
  /** `clip` mode: the starting window, as `inset()` arguments. Give all four sides and a radius, so each value tweens to its pair. */
  inset?: string;
  /** `push` and `pull` modes: the grid that holds `target`. Defaults to its parent. */
  grid?: HTMLElement;
  /** Pinned distance, in section heights. */
  length?: number;
  scrub?: number | boolean;
  scroller?: Scroller;
};

export function zoomThrough(
  section: HTMLElement,
  target: HTMLElement,
  { mode = "scale", focus, scale = 30, inset = "30% 34% 30% 34% round 12px", grid, length = 1.5, scrub = SCRUB, scroller }: ZoomOptions = {},
): Teardown {
  if (prefersReducedMotion()) return () => {};
  return own((dispose, after) => {
    after(snapshotStyles([...new Set([target, ...gsap.utils.toArray<HTMLElement>(section.children)])]));
    const behind = Array.from(section.children).filter((child): child is HTMLElement => child !== target && child instanceof HTMLElement);
    const timeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: section, start: "top top", end: () => `+=${section.offsetHeight * length}`, pin: true, scrub, scroller, anticipatePin: 1, invalidateOnRefresh: true },
    });
    if (mode === "clip") {
      timeline.fromTo(target, { clipPath: `inset(${inset})` }, { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "power2.inOut" }, 0);
      return;
    }
    if (mode === "push" || mode === "pull") {
      const plate = grid ?? target.parentElement!;
      after(snapshotStyles([plate]));
      // Where the grid must sit for the tile to fill the section. Measured at rest, before GSAP reads any
      // value: resetting the transform while a tween parses its values splits its scale.
      const measure = () => {
        const held = { x: gsap.getProperty(plate, "x"), y: gsap.getProperty(plate, "y"), scale: gsap.getProperty(plate, "scale") };
        gsap.set(plate, { x: 0, y: 0, scale: 1 });
        const s = section.getBoundingClientRect();
        const t = target.getBoundingClientRect();
        const g = plate.getBoundingClientRect();
        gsap.set(plate, held);
        return {
          x: s.left + s.width / 2 - (t.left + t.width / 2),
          y: s.top + s.height / 2 - (t.top + t.height / 2),
          scale: Math.max(s.width / t.width, s.height / t.height),
          origin: `${t.left + t.width / 2 - g.left}px ${t.top + t.height / 2 - g.top}px`,
        };
      };
      let spot = measure();
      const remeasure = () => (spot = measure());
      ScrollTrigger.addEventListener("refreshInit", remeasure);
      dispose(() => ScrollTrigger.removeEventListener("refreshInit", remeasure));
      const rest = { x: 0, y: 0, scale: 1, transformOrigin: () => spot.origin };
      const filled = { x: () => spot.x, y: () => spot.y, scale: () => spot.scale, transformOrigin: () => spot.origin };
      if (mode === "push") timeline.fromTo(plate, rest, { ...filled, ease: "power2.in" }, 0);
      else timeline.fromTo(plate, filled, { ...rest, ease: "power2.out" }, 0);
      return;
    }
    // The origin is the focus's center within the target, measured at scale 1. It is measured again at
    // each refresh, so a font or layout change after the build still flies into the right spot.
    const origin = () => {
      const current = gsap.getProperty(target, "scale");
      gsap.set(target, { scale: 1 });
      const box = target.getBoundingClientRect();
      const spot = (focus ?? target).getBoundingClientRect();
      gsap.set(target, { scale: current });
      return `${spot.left + spot.width / 2 - box.left}px ${spot.top + spot.height / 2 - box.top}px`;
    };
    // force3D off keeps scaled text crisp: a cached layer would blur at this size.
    timeline
      .fromTo(target, { scale: 1, transformOrigin: origin }, { scale, ease: "power2.in", force3D: false }, 0)
      .to(target, { autoAlpha: 0, duration: 0.15 }, 0.85)
      .fromTo(behind, { scale: 1.15 }, { scale: 1, ease: "power2.out" }, 0);
  });
}
```

For `push` and `pull`, lay the grid out at rest and give the section `overflow: clip`; the grid scales past its edges. Under reduced motion the grid stays whole.

Under reduced motion and without JavaScript, the section shows both layers at rest; design the front layer so the back still reads around it, or hide the back in that state with the pre-paint marker. The front scales from a single point, so text is best kept to a short display line.

## Controller contract

| Builder | Create | Returns | Reduced motion |
|---|---|---|---|
| `revealOnScroll` | Initial state, before paint, for targets that are not route items | teardown | No-op; content visible |
| `scrubStatement`, `parallax`, `velocitySkew` | Settled, once text and media are measurable | teardown | No-op; static |
| `pinnedScene` | Settled, after fonts and media above it have sized | teardown | No-op; stacked fallback |
| `stackCards` | Settled, same as a scene | teardown | No-op; a plain column of cards |
| `zoomThrough` | Settled, same as a scene | teardown | No-op; both layers at rest |
| `horizontalRun` | Settled, same as a scene | `{ revert, animation }` | No-op; native scroller |
| `runDrift` | Settled, right after its run | teardown | No-op; static |
| `scrollWaypoints` | Settled, once the traveller and markers are laid out | teardown | No-op; the traveller stays in its place |
| `scrollProgress` | Settled | teardown | Runs, unsmoothed |
| `navTheme` | Settled, once section heights are final; the header persists, so rebuild per page | teardown | Runs; CSS drops the transition |
| `scrollDirection` | Once per document, from the persistent shell | teardown | Runs; CSS drops the transition |
| `headerShrink` | Once per document, after fonts load, from the persistent shell | teardown | Tall near the top, slim past `distance`; no motion between |
| `headerSection` | Settled, once section heights are final; rebuild per page | teardown | The name changes with no roll |

- Create triggers in document order, pins included, so later starts account for earlier pin spacing. Build on a fresh visit; refresh a re-shown preserved page instead.
- Keep scenes and runs alive through outro and end state; reverting a pin mid-outro jumps the page. Revert on unmount, inner `containerAnimation` effects first.
- Reveal targets may use the pre-paint mechanism under a `data-scroll-reveal` marker. Keep them out of route intro targets.
- A custom scroller passes `scroller`; the app owns its `scrollerProxy`.
- `scrollWaypoints` rebuilds its trigger at each refresh from measured positions, so it needs no place in the creation order; pins above it are already in the layout it measures.
