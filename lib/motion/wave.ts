// Animaxxing recipe: the wave. Adapted to ripple across several text leaves as one line,
// with weight moves returning to each letter's resting weight and moves scaled to the font size.
import { gsap, SplitText, prefersReducedMotion } from "./gsap";

/** Delay between neighbouring letters starting their move. */
const RIPPLE = 0.03;
/** Each letter is back at rest this many seconds after it starts. */
const LETTER_TIME = 0.25;
/** A letter's resting weight, inherited from its leaf (globals.css). */
const restWeight = (_: number, el: Element) => getComputedStyle(el.parentElement ?? el).fontWeight;

const rnd = gsap.utils.random;
/** A named move. The hero shows the name while the move plays. */
type Move = { name: string; play: (chars: HTMLElement[]) => gsap.core.Timeline };

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

/** Every weight move returns to the letter's resting weight when its inline weight clears. */
const MOVES: Move[] = [
  // Each letter lifts and lands.
  { name: "Hop", play: (chars) => ripple(chars, { y: (_: number, el: Element) => -0.06 * em(el) }, "power2.out") },
  // A swell from the baseline.
  { name: "Breathe", play: (chars) => ripple(chars, { scale: 1.07, transformOrigin: "50% 100%" }) },
  // A nod to the right and back.
  { name: "Lean", play: (chars) => ripple(chars, { rotation: 7, transformOrigin: "50% 100%" }) },
  // A full turn about the vertical axis.
  { name: "Flip", play: (chars) => sweep(chars, { rotationY: 360, transformOrigin: "50% 50%" }) },
  // The weight axis eases down and back.
  { name: "Lighten", play: (chars) => ripple(chars, { fontWeight: 400 }) },
  // Weight drops to the floor while the letter stretches to keep its footprint.
  { name: "Hairline", play: (chars) => ripple(chars, { fontWeight: 200, scaleX: 1.14, transformOrigin: "50% 100%" }, "power2.inOut") },
  // Weight snaps to thin, then fills back in.
  {
    name: "Ink",
    play: (chars) =>
      gsap
        .timeline({ defaults: { overwrite: "auto" } })
        .fromTo(chars, { fontWeight: 200 }, { fontWeight: restWeight, duration: LETTER_TIME, ease: "power2.out", stagger: RIPPLE, immediateRender: false })
        .set(chars, { clearProps: "fontWeight" }),
  },
  // A quick italic slant.
  { name: "Shear", play: (chars) => ripple(chars, { skewX: 12 }, "power2.inOut") },
  // Pressed flat and released.
  { name: "Squash", play: (chars) => ripple(chars, { scaleY: 0.82, transformOrigin: "50% 100%" }, "power2.inOut") },
  // Each letter swells with its own small twist.
  { name: "Twist", play: (chars) => ripple(chars, { scale: 1.1, rotation: () => rnd(-12, 12), transformOrigin: "50% 50%" }, "power2.inOut") },
];

/** Every move's name, in a fixed order. The hero's label stacks them all to size its slot. */
export const MOVE_NAMES = MOVES.map((move) => move.name);

/** Pins each letter to its resting width so weight changes cannot reflow the line. */
function pinWidths(chars: HTMLElement[]): void {
  // Layout width, not the box on screen: a transform mid-move would inflate it.
  const widths = chars.map((char) => parseFloat(getComputedStyle(char).width));
  chars.forEach((char, i) => {
    char.style.display = "inline-block";
    char.style.width = `${widths[i] ?? 0}px`;
    char.style.textAlign = "center";
  });
}

export type WaveStop = (() => void) & { pause: () => void; resume: () => void };

const noop: WaveStop = Object.assign(() => {}, { pause: () => {}, resume: () => {} });

export type WaveOptions = {
  /** Seconds between moves. */
  period?: number;
  /** Seconds before the first move. Defaults to `period`. */
  first?: number;
  /** Called with a move's name as it starts. */
  onMove?: (name: string) => void;
};

/** Starts the wave across `leaves`, in document order. Returns stop, which carries pause and resume. */
export function startWave(leaves: HTMLElement[], { period = 4.5, first = period, onMove }: WaveOptions = {}): WaveStop {
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
    if (!move) return;
    current = move.play(chars);
    onMove?.(move.name);
  };

  const clock = gsap.delayedCall(first, () => {
    wave();
    clock.delay(period).restart(true);
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
