# Recipe: smooth scroll

Eased document scrolling kept in step with ScrollTrigger. Lenis smooths the window's own scroll with no markup change; ScrollSmoother moves a content wrapper and adds `data-speed` and `data-lag`. Pick one per site; both return the same controls.

Lifecycle: the persistent shell creates one scroller per document and destroys it on shell unmount; the framework skill's `references/smooth-scroll.md` owns stopping, scrolling, and resizing around navigation. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`, `gsap/ScrollTrigger`. `lenisScroll` needs `lenis` 1.3+ and `lenis/dist/lenis.css` (which holds the page while stopped), imported once from the shell's global styles. `smootherScroll` needs `gsap/ScrollSmoother`. Lenis option names change between minors; check the installed version and types.

Lenis scrolls the window, so the document itself must scroll: no fixed-height app shell with its own overflow. Stopping clips the root's overflow; `scrollbar-gutter: stable` on `html` prevents a classic scrollbar's reflow. Keyboard, scrollbar, find-in-page, focus scrolling, and touch stay native (touch unless `syncTouch` is set). Exempt inner scroll areas with `data-lenis-prevent`. Lenis's `anchors: true` eases hash links on plain pages; leave it off where a router handles them.

## scroll-controls.ts

```ts
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* Swap for the project's helper if it has one. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type ScrollTarget = number | string | HTMLElement;
export type ScrollToOptions = {
  /** Jump instead of easing, as after a route swap or a history restore. */
  immediate?: boolean;
  /** Pixels added to the target position; negative clears a fixed header. */
  offset?: number;
};

export type SmoothScroll = {
  /** Holds the page still. A stopped ScrollSmoother undoes native scrolls; sync a router's scroll with `scrollTo` in the same task. */
  stop(): void;
  start(): void;
  /** Scrolls to a position, a selector, or an element, even while stopped. */
  scrollTo(target: ScrollTarget, options?: ScrollToOptions): void;
  /** Re-measures after content changes size, then refreshes ScrollTrigger. */
  resize(): void;
  /** Idempotent. Restores native scrolling and removes everything the engine added. */
  destroy(): void;
};

/** A target's document position in px, or undefined when a selector matches nothing. */
export function resolveTarget(target: ScrollTarget): number | undefined {
  if (typeof target === "number") return target;
  const element = typeof target === "string" ? document.querySelector(target) : target;
  return element ? element.getBoundingClientRect().top + window.scrollY : undefined;
}

/**
 * Native scrolling behind the same controls: the reduced-motion path of both
 * engines. Stop and start do nothing, since reduced-motion outros are instant.
 */
export function nativeScroll(): SmoothScroll {
  return {
    stop() {},
    start() {},
    scrollTo(target, { immediate = false, offset = 0 } = {}) {
      const top = resolveTarget(target);
      if (top === undefined) return;
      window.scrollTo({ top: top + offset, behavior: immediate || prefersReducedMotion() ? "instant" : "smooth" });
    },
    resize() {
      ScrollTrigger.refresh();
    },
    destroy() {},
  };
}
```

## lenis-scroll.ts

```ts
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis, { type LenisOptions } from "lenis";
import { nativeScroll, prefersReducedMotion, type SmoothScroll } from "./scroll-controls";

/**
 * Lenis on the window, stepped by GSAP's ticker so ScrollTrigger reads the
 * same frame. `options` pass through to Lenis; `lerp` or `duration` set the feel.
 * GSAP's lag smoothing is left as the app set it.
 */
export function lenisScroll(options: LenisOptions = {}): SmoothScroll {
  if (prefersReducedMotion()) return nativeScroll();
  // The helper above already decided, including the app's own motion setting; Lenis would read only the OS.
  const lenis = new Lenis({ ...options, autoRaf: false, respectReducedMotion: false });
  const tick = (time: number) => lenis.raf(time * 1000);
  let offScroll: (() => void) | undefined;
  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    gsap.ticker.remove(tick);
    offScroll?.();
    lenis.destroy();
  };
  try {
    offScroll = lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(tick);
  } catch (error) {
    destroy();
    throw error;
  }
  return {
    stop: () => lenis.stop(),
    start: () => lenis.start(),
    scrollTo(target, { immediate = false, offset = 0 } = {}) {
      // Lenis clamps to the height it last measured; a jump into a taller page after a swap needs a fresh measure.
      if (immediate) lenis.resize();
      lenis.scrollTo(target, { immediate, offset, force: true });
    },
    resize() {
      lenis.resize();
      ScrollTrigger.refresh();
    },
    destroy,
  };
}
```

## smoother-scroll.ts

ScrollSmoother needs a fixed wrapper around a content element holding the page. Fixed and sticky UI, such as a header or curtain, sits outside the wrapper, since the content moves by transform.

```html
<header>…</header>
<div id="smooth-wrapper"><div id="smooth-content">…page…</div></div>
```

```ts
import gsap from "gsap";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { nativeScroll, prefersReducedMotion, type SmoothScroll } from "./scroll-controls";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

export type SmootherOptions = {
  /** Seconds the content takes to catch up with the scrollbar. */
  smooth?: number;
  /** Reads `data-speed` and `data-lag` inside the content. */
  effects?: boolean;
  /** Smoothing on touch, in seconds; `false` keeps touch native. */
  smoothTouch?: number | false;
};

export function smootherScroll(
  wrapper: HTMLElement,
  content: HTMLElement,
  { smooth = 1, effects = true, smoothTouch = false }: SmootherOptions = {},
): SmoothScroll {
  if (prefersReducedMotion()) return nativeScroll();
  // create() writes scroll-behavior on <html> and <body> and kill() leaves it; put it back on destroy.
  const roots = [document.documentElement, document.body];
  const behaviors = roots.map((root) => [root.style.getPropertyValue("scroll-behavior"), root.style.getPropertyPriority("scroll-behavior")] as const);
  const restoreBehavior = () =>
    roots.forEach((root, i) => {
      const [value, priority] = behaviors[i] ?? ["", ""];
      if (value) root.style.setProperty("scroll-behavior", value, priority);
      else root.style.removeProperty("scroll-behavior");
    });
  let smoother: ScrollSmoother;
  try {
    smoother = ScrollSmoother.create({ wrapper, content, smooth, effects, smoothTouch });
  } catch (error) {
    restoreBehavior();
    throw error;
  }
  let destroyed = false;
  return {
    stop: () => smoother.paused(true),
    start: () => smoother.paused(false),
    scrollTo(target, { immediate = false, offset = 0 } = {}) {
      const element = typeof target === "string" ? document.querySelector(target) : target;
      // A stale hash matches nothing; do nothing, as the other engines do.
      if (element === null) return;
      const top = typeof element === "number" ? element : smoother.offset(element, "top top");
      smoother.scrollTo(top + offset, !immediate);
    },
    resize: () => ScrollTrigger.refresh(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      // kill() reverts the wrapper's and content's inline styles and removes its listeners.
      smoother.kill();
      restoreBehavior();
    },
  };
}
```

## Wiring

```ts
// In the persistent shell, once per document, before any page creates a ScrollTrigger:
const scroller = lenisScroll({ lerp: 0.1 });
// Outro or covered swap: scroller.stop();
// After a swap or history restore, once the router or browser has scrolled:
//               scroller.scrollTo(window.scrollY, { immediate: true });
// Intro built:  scroller.resize(); scroller.start();
// Shell unmount: scroller.destroy();
```

## Controller contract

| Builder | Create | Returns | Reduced motion |
|---|---|---|---|
| `lenisScroll` | Once per document, from the persistent shell | controls | Native controls, same API; nothing created |
| `smootherScroll` | Same, before any ScrollTrigger exists | controls | Native controls, same API; wrapper stays plain |

- One scroller per document. Page-level effects never create or destroy it.
- A stopped ScrollSmoother undoes native scrolls on its next scroll event. When a router scrolls while it is stopped, call `scrollTo(window.scrollY, { immediate: true })` in the same task, such as a microtask after the commit, never a frame later. Lenis adopts native jumps while stopped.
- ScrollTrigger effects need no custom `scroller`: Lenis moves the window, and ScrollSmoother registers itself as the default.
