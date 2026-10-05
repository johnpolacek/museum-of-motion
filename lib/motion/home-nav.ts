// Moving around the home page. The address stays "/": "#collection" is a one-time instruction for
// arriving, cleared once used, so the address and the view never disagree and reload and Back restore
// the exact spot.
import { gsap, prefersReducedMotion } from "./gsap";

export const COLLECTION = "collection";

/** Drops a hash from the address without navigating, keeping the router's history state. */
export function clearHash(): void {
  if (!window.location.hash) return;
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
}

/**
 * Glides the page to the top or to an element, every time, then moves keyboard focus there.
 * Reduced motion jumps. A wheel or touch during the glide hands control back to the visitor.
 */
export function glideTo(target: "top" | HTMLElement, focus?: HTMLElement | null): void {
  const y = target === "top" ? 0 : Math.max(0, target.getBoundingClientRect().top + window.scrollY);
  const land = () => {
    if (!focus) return;
    if (!focus.hasAttribute("tabindex")) focus.setAttribute("tabindex", "-1");
    focus.focus({ preventScroll: true });
  };
  clearHash();
  const distance = Math.abs(window.scrollY - y);
  if (prefersReducedMotion() || distance < 2) {
    window.scrollTo(0, y);
    land();
    return;
  }
  gsap.to(window, {
    scrollTo: { y, autoKill: true },
    // Longer trips take a little longer, within the brief's entrance range.
    duration: gsap.utils.clamp(0.6, 1.1, 0.5 + distance / 3000),
    ease: "power3.inOut",
    overwrite: true,
    onComplete: land,
  });
}

/** On the home page: the collection, by its heading. */
export const collectionTargets = () => ({
  section: document.getElementById(COLLECTION),
  heading: document.getElementById("coll-h"),
});
