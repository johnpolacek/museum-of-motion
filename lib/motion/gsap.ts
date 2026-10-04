// The one client module that imports GSAP. Plugins and the brand curves register here, before any builder runs.
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, SplitText, CustomEase, ScrollTrigger);

// MOTION.md: one entrance curve, one exit curve.
CustomEase.create("signature", "M0,0 C0.2,1.5 0.35,1 1,1");
CustomEase.create("signature-exit", "M0,0 C0.55,0 0.85,0.3 1,1");

export { gsap, ScrollTrigger, SplitText, useGSAP };

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Resolves when web fonts are ready, or after `ms`, whichever comes first. */
export function fontsReady(ms: number): Promise<void> {
  const ready = document.fonts?.ready.then(() => undefined) ?? Promise.resolve();
  return Promise.race([ready, new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}

/** Resolves true when the timeline completes, false if it is killed first. */
export function finished(tl: gsap.core.Timeline): Promise<boolean> {
  return new Promise((resolve) => {
    tl.eventCallback("onComplete", () => resolve(true));
    tl.eventCallback("onInterrupt", () => resolve(false));
  });
}
