// Copied from the animaxxing skill: references/motion-vocabulary.md, its Tokens helper and Accents. Edit in place.
import gsap from "gsap";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}


export type ShakeOptions = {
  /** Widest swing in px. */
  distance?: number;
  duration?: number;
  onComplete?: () => void;
};

/** Swings narrow each time and end where they started. */
const SWINGS = [1, -0.8, 0.55, -0.3, 0.12, 0];

/** Shakes `target` once. Reduced motion skips the move; completion still fires. */
export function shake(target: HTMLElement, { distance = 10, duration = 0.4, onComplete }: ShakeOptions = {}): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { overwrite: "auto" } });
  if (onComplete) tl.eventCallback("onComplete", onComplete);
  if (prefersReducedMotion()) return tl.to({}, { duration: 0 });
  // The swings play over the element's own transform, and hand it back exactly when done.
  const saved = [target.style.getPropertyValue("transform"), target.style.getPropertyPriority("transform")] as const;
  const restore = () => {
    gsap.set(target, { clearProps: "transform,translate" });
    if (saved[0]) target.style.setProperty("transform", saved[0], saved[1]);
  };
  const each = duration / SWINGS.length;
  for (const swing of SWINGS) tl.to(target, { x: swing * distance, duration: each, ease: "sine.inOut" });
  tl.eventCallback("onComplete", () => {
    restore();
    onComplete?.();
  });
  tl.eventCallback("onInterrupt", restore);
  return tl;
}
