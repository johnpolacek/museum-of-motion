// Copied from the animaxxing skill: references/recipes/smooth-scroll.md (smoother-scroll.ts).
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
