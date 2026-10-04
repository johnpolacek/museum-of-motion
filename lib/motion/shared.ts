// Animaxxing recipe: captureShared and playShared. One element morphs into its counterpart on the next page.
import { Flip, gsap, prefersReducedMotion } from "./gsap";

/** A captured box, with the scroll position it was seen at. */
export type SharedState = { flip: Flip.FlipState; scrollX: number; scrollY: number };

/** Records the element's box for a morph into its counterpart. Both carry the same data-flip-id. */
export function captureShared(element: HTMLElement): SharedState {
  return { flip: Flip.getState(element), scrollX: window.scrollX, scrollY: window.scrollY };
}

/**
 * Flip records boxes in document coordinates. When the router scrolls between capture and
 * play, shift the recorded boxes so the morph starts where the element was on screen. Idempotent.
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

/** Morphs `target` from a captured state. The explicit target keeps Flip off any stale copy. */
export function playShared(
  state: SharedState,
  target: HTMLElement,
  { duration = 0.8, ease = "signature", zIndex = 10 }: { duration?: number; ease?: string; zIndex?: number } = {},
): gsap.core.Timeline {
  if (prefersReducedMotion()) return gsap.timeline().set(target, {});
  followScroll(state);
  return Flip.from(state.flip, { targets: target, duration, ease, scale: true, zIndex });
}
