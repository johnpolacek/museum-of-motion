// The wordmark as a miniature collection: each letter of "Museum of Motion" performs a different move,
// left to right, and lands at rest. Builders only build; the Masthead controller decides when.
import { gsap, SplitText, prefersReducedMotion } from "./gsap";

const ENTER = "signature";

/** One move per letter, in reading order. Each is the start state; every letter lands on its CSS rest. */
const MOVES: gsap.TweenVars[] = [
  { yPercent: -400 }, // M: drops in from above the page
  { rotationX: -270, transformOrigin: "50% 0%", transformPerspective: 200 }, // U: tumbles over its top edge
  { rotation: -540, scale: 0 }, // S: spins up from nothing
  { fontWeight: 100, scaleY: 2.2, transformOrigin: "50% 100%" }, // E: hairline and tall, gains weight as it settles
  { fontStretch: "125%", scaleX: 2.2 }, // U: tightens from very wide
  { x: -120, skewX: -60 }, // M: leans in at speed
  { scale: 6 }, // O: lands from huge
  { yPercent: 300 }, // F: rises from below
  { rotationY: 540, transformPerspective: 200 }, // M: turns round and round to face forward
  { filter: "blur(10px)", scale: 3 }, // O: comes into focus
  { yPercent: -260, rotation: 180 }, // T: falls head first and rights itself
  { scaleY: 0, transformOrigin: "50% 100%" }, // I: grows from the baseline
  { x: 160 }, // O: slides in from the right
  { fontStretch: "62%", fontWeight: 100, scale: 1.8, transformOrigin: "0% 100%" }, // N: widens and gains weight
];

export type WordmarkTour = { timeline: gsap.core.Timeline; finish: () => void };

/** Splits the wordmark leaf and builds its tour, paused, with start values applied. Run once fonts are ready. */
export function wordmarkTour(leaf: HTMLElement): WordmarkTour {
  const tl = gsap.timeline({ paused: true, defaults: { overwrite: "auto" } });
  if (prefersReducedMotion()) {
    tl.set(leaf, { autoAlpha: 1 });
    return { timeline: tl, finish: () => gsap.set(leaf, { clearProps: "opacity,visibility" }) };
  }
  let split: SplitText | null = null;
  const finish = () => {
    split?.revert();
    split = null;
    gsap.set(leaf, { clearProps: "opacity,visibility" });
  };
  try {
    split = SplitText.create(leaf, { type: "chars", aria: "auto" });
    const chars = split.chars as HTMLElement[];
    // Axis moves change a letter's advance. Pin each to its resting width so the wordmark never reflows.
    for (const c of chars) {
      c.style.width = `${parseFloat(getComputedStyle(c).width)}px`;
      c.style.textAlign = "center";
    }
    tl.set(leaf, { autoAlpha: 1 }, 0);
    chars.forEach((c, i) => {
      const move = MOVES[i % MOVES.length];
      tl.from(c, { ...move, autoAlpha: 0, duration: 0.9, ease: ENTER, immediateRender: true }, i * 0.1);
    });
  } catch (error) {
    tl.kill();
    finish();
    throw error;
  }
  return { timeline: tl, finish };
}
