// The wordmark as a miniature collection: each letter of "Museum of Motion" performs a different move,
// left to right, and lands at rest. Builders only build; the Masthead controller decides when.
import { gsap, SplitText, prefersReducedMotion } from "./gsap";

const ENTER = "signature";

/**
 * One move per letter, in reading order. Each is the start state; every letter lands on its CSS rest.
 * Transform-only: weight and width tweens jitter at 18px, and blur costs a repaint per frame.
 * Rotations stay at or under 180° so the fast start of the curve never strobes.
 */
const MOVES: gsap.TweenVars[] = [
  { y: -40 }, // M: drops in
  { rotationX: -90, transformOrigin: "50% 0%", transformPerspective: 400 }, // U: tips down over its top edge
  { rotation: -180, scale: 0 }, // S: spins up from a point
  { scaleX: 0, transformOrigin: "0% 50%" }, // E: unfolds sideways
  { y: 36 }, // U: rises from below
  { x: -36, skewX: -30 }, // M: leans in at speed
  { scale: 2.2 }, // O: settles down from big
  { rotation: 90, transformOrigin: "0% 100%" }, // F: swings up like a gate
  { rotationY: 180, transformPerspective: 400 }, // M: turns to face forward
  { scale: 0 }, // O: pops from a point
  { y: -30, rotation: 90 }, // T: falls and rights itself
  { scaleY: 0, transformOrigin: "50% 100%" }, // I: grows from the baseline
  { x: 36 }, // O: slides in from the right
  { rotationX: 90, transformOrigin: "50% 100%", transformPerspective: 400 }, // N: tips up from its baseline
];

/** Seconds between letters, and each letter's move. */
const STAGGER = 0.07;
const DURATION = 0.8;

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
    tl.set(leaf, { autoAlpha: 1 }, 0);
    chars.forEach((c, i) => {
      const at = i * STAGGER;
      // 2D-capable moves stay off the GPU layer so 18px text repaints crisp every frame, with no snap at the end.
      tl.from(c, { ...MOVES[i % MOVES.length], force3D: false, duration: DURATION, ease: ENTER, immediateRender: true }, at);
      // Opacity on its own gentle curve: the signature's fast start would pop each letter in at full strength.
      tl.from(c, { autoAlpha: 0, duration: 0.35, ease: "power1.out", immediateRender: true }, at);
    });
  } catch (error) {
    tl.kill();
    finish();
    throw error;
  }
  return { timeline: tl, finish };
}
