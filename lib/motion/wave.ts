// Animaxxing recipe: the wave. Adapted to ripple across several text leaves as one line,
// with the hero resting at weight 700 and moves scaled to the font size.
import { gsap, SplitText, prefersReducedMotion } from "./gsap";

/** Delay between neighbouring letters starting their move. */
const RIPPLE = 0.03;
/** Each letter is back at rest this many seconds after it starts. */
const LETTER_TIME = 0.25;
/** The headline's resting weight (globals.css). */
const REST = 700;

const rnd = gsap.utils.random;
type Move = (chars: HTMLElement[]) => gsap.core.Timeline;

/** Font size of a letter, so moves scale with the headline from phone to desktop. */
const em = (el: Element) => parseFloat(getComputedStyle(el).fontSize) || 16;

/** One out-and-back tween per letter; repeat and yoyo live inside the stagger. */
function ripple(chars: HTMLElement[], vars: gsap.TweenVars, ease = "sine.inOut") {
  return gsap
    .timeline({ defaults: { overwrite: "auto" } })
    .to(chars, { ...vars, duration: LETTER_TIME / 2, ease, stagger: { each: RIPPLE, yoyo: true, repeat: 1 } })
    .set(chars, { clearProps: "transform,opacity,fontWeight" });
}

/** A one-way tween per letter for moves that end where they began anyway. */
function sweep(chars: HTMLElement[], vars: gsap.TweenVars, ease = "power2.inOut") {
  return gsap
    .timeline({ defaults: { overwrite: "auto" } })
    .to(chars, { ...vars, duration: LETTER_TIME, ease, stagger: RIPPLE })
    .set(chars, { clearProps: "transform,opacity,fontWeight" });
}

/** The headline sits at 700, so weight moves dip lighter and come back. */
const MOVES: Move[] = [
  // Hop: each letter lifts and lands.
  (chars) => ripple(chars, { y: (_: number, el: Element) => -0.06 * em(el) }, "power2.out"),
  // Breathe: a swell from the baseline.
  (chars) => ripple(chars, { scale: 1.07, transformOrigin: "50% 100%" }),
  // Lean: a nod to the right and back.
  (chars) => ripple(chars, { rotation: 7, transformOrigin: "50% 100%" }),
  // Flip: a full turn about the vertical axis.
  (chars) => sweep(chars, { rotationY: 360, transformOrigin: "50% 50%" }),
  // Lighten: the weight axis eases down and back.
  (chars) => ripple(chars, { fontWeight: 400 }),
  // Hairline: weight drops to the floor while the letter stretches to keep its footprint.
  (chars) => ripple(chars, { fontWeight: 200, scaleX: 1.14, transformOrigin: "50% 100%" }, "power2.inOut"),
  // Ink: weight snaps to thin, then fills back in.
  (chars) =>
    gsap
      .timeline({ defaults: { overwrite: "auto" } })
      .fromTo(chars, { fontWeight: 200 }, { fontWeight: REST, duration: LETTER_TIME, ease: "power2.out", stagger: RIPPLE, immediateRender: false })
      .set(chars, { clearProps: "fontWeight" }),
  // Shear: a quick italic slant.
  (chars) => ripple(chars, { skewX: 12 }, "power2.inOut"),
  // Squash: pressed flat and released.
  (chars) => ripple(chars, { scaleY: 0.82, transformOrigin: "50% 100%" }, "power2.inOut"),
  // Twist: each letter swells with its own small twist.
  (chars) => ripple(chars, { scale: 1.1, rotation: () => rnd(-12, 12), transformOrigin: "50% 50%" }, "power2.inOut"),
];

/** Pins each letter to its resting width so weight changes cannot reflow the line. */
function pinWidths(chars: HTMLElement[]): void {
  const widths = chars.map((char) => char.getBoundingClientRect().width);
  chars.forEach((char, i) => {
    char.style.display = "inline-block";
    char.style.width = `${widths[i] ?? 0}px`;
    char.style.textAlign = "center";
  });
}

export type WaveStop = (() => void) & { pause: () => void; resume: () => void };

const noop: WaveStop = Object.assign(() => {}, { pause: () => {}, resume: () => {} });

/** Starts the wave across `leaves`, in document order. Returns stop, which carries pause and resume. */
export function startWave(leaves: HTMLElement[], { period = 4.5 } = {}): WaveStop {
  if (prefersReducedMotion() || !leaves.length) return noop;
  const splits: SplitText[] = [];
  const revert = () => {
    while (splits.length) splits.pop()!.revert();
  };
  let chars: HTMLElement[];
  try {
    for (const leaf of leaves) splits.push(SplitText.create(leaf, { type: "chars", aria: "none" }));
    chars = splits.flatMap((s) => s.chars as HTMLElement[]);
    pinWidths(chars);
  } catch (error) {
    revert();
    throw error;
  }

  // Shuffle so each cycle plays in a fresh order, never repeating one across the seam.
  let deck = gsap.utils.shuffle([...MOVES]);
  let index = 0;
  let current: gsap.core.Timeline | undefined;

  const wave = () => {
    const move = deck[index];
    index++;
    if (index >= deck.length) {
      deck = gsap.utils.shuffle([...MOVES]);
      if (deck[0] === move && deck.length > 1) deck.push(deck.shift() as Move);
      index = 0;
    }
    current?.kill();
    current = move?.(chars);
  };

  const clock = gsap.delayedCall(period, () => {
    wave();
    clock.restart(true);
  });

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clock.kill();
    current?.kill();
    current = undefined;
    revert();
  };
  return Object.assign(stop, {
    pause: () => {
      if (!stopped) clock.pause();
    },
    resume: () => {
      if (!stopped) clock.resume();
    },
  });
}
