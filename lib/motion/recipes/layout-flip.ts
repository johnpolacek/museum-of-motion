// Copied from the animaxxing skill: references/recipes/layout-flip.md. Edit in place; see the recipe for the contract.
import gsap from "gsap";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(Flip);

/* Swap for the project's helper if it has one. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type FlipOptions = {
  duration?: number;
  ease?: string;
  stagger?: number;
  /** Other properties to carry between states, such as "borderRadius,backgroundColor"; they change instantly otherwise. */
  props?: string;
  onComplete?: () => void;
};

export type LayoutFlip = {
  /** Animates from the recorded layout to the current one. Call after the change renders. */
  play(): gsap.core.Timeline;
};

export function captureLayout(
  targets: gsap.DOMTarget,
  { duration = 0.5, ease = "power2.inOut", stagger = 0, props, onComplete }: FlipOptions = {},
): LayoutFlip {
  const items = gsap.utils.toArray<HTMLElement>(targets);
  const state = Flip.getState(items, props ? { props } : undefined);
  return {
    play() {
      if (prefersReducedMotion()) {
        const tl = gsap.timeline();
        if (onComplete) tl.eventCallback("onComplete", onComplete);
        return tl.set(items, {});
      }
      return Flip.from(state, {
        // Same nodes before and after, so Flip never matches a stale copy.
        targets: items,
        duration,
        ease,
        stagger,
        scale: true,
        absoluteOnLeave: true,
        onEnter: (entering) =>
          gsap.fromTo(entering, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: duration * 0.8, ease: "power2.out", overwrite: "auto" }),
        onLeave: (leaving) => gsap.to(leaving, { opacity: 0, scale: 0.9, duration: duration * 0.6, ease: "power2.in", overwrite: "auto" }),
        onComplete,
      });
    },
  };
}

/** A captured box, with the scroll position it was seen at. */
export type SharedState = { flip: Flip.FlipState; scrollX: number; scrollY: number };

/** Records the element's box and props for a morph into its counterpart. */
export function captureShared(element: HTMLElement, props?: string): SharedState {
  return { flip: Flip.getState(element, props ? { props } : undefined), scrollX: window.scrollX, scrollY: window.scrollY };
}

/**
 * Flip records boxes in document coordinates. When the router scrolls between
 * capture and play, shift the recorded boxes so the morph starts where the
 * element was on screen. Idempotent, so a development double read is safe.
 */
function followScroll(state: SharedState): void {
  const dx = window.scrollX - state.scrollX;
  const dy = window.scrollY - state.scrollY;
  if (!dx && !dy) return;
  for (const recorded of state.flip.elementStates) {
    recorded.matrix.e += dx;
    recorded.matrix.f += dy;
  }
  state.scrollX = window.scrollX;
  state.scrollY = window.scrollY;
}

export type SharedOptions = FlipOptions & {
  /** Lifts the target out of flow for the morph. Only when its container holds its size. */
  absolute?: boolean;
  /** Stacking order during the morph, so the moving element passes over its neighbors. */
  zIndex?: number;
};

/**
 * Morphs `target` from a captured state. `targets` keeps Flip on the new
 * element even when the original is still in the DOM, hidden by the router.
 */
export function playShared(
  state: SharedState,
  target: HTMLElement,
  { duration = 0.7, ease = "power3.inOut", absolute = false, zIndex = 10, onComplete }: SharedOptions = {},
): gsap.core.Timeline {
  if (prefersReducedMotion()) {
    // The target is already visible at its final size; nothing to write.
    const tl = gsap.timeline();
    if (onComplete) tl.eventCallback("onComplete", onComplete);
    return tl.set(target, {});
  }
  followScroll(state);
  return Flip.from(state.flip, { targets: target, duration, ease, scale: true, absolute, zIndex, onComplete });
}
