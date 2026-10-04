// Copied from the animaxxing skill: references/recipes/smooth-scroll.md (lenis-scroll.ts).
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
