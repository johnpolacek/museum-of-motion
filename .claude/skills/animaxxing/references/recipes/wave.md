# Recipe: the wave

Ambient display-text effect: every few seconds a different small move ripples across a heading's letters, left to right, and each letter ends where it started.

Lifecycle: the framework controller calls `startWave` at settled and the returned stop on outro and unmount. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`, `gsap/SplitText`. Weight moves need a variable weight axis; the example rests at 800 and dips to 400–500. Adapt those values, or omit the three weight moves on a static face.

Setup: apply [stable typography](../text-stability.md#stable-typography-for-character-animation) before splitting; check revert with the [cleanup checks](../verification.md#splittext-cleanup-stability).

```ts
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

/* Swap for the project's helper if it has one. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Runs setup in its own GSAP context; on throw, reverts what it created and rethrows. */
function guarded<T>(setup: () => T, onFail?: () => void): T {
  const ctx = gsap.context(() => {});
  let result: T | undefined;
  let failure: { error: unknown } | undefined;
  // Catch inside add: GSAP restores its current context only when add returns.
  ctx.add(() => {
    try {
      result = setup();
    } catch (error) {
      failure = { error };
    }
  });
  if (failure) {
    onFail?.();
    ctx.revert();
    throw failure.error;
  }
  return result as T;
}

/** Delay between neighbouring letters starting their move. */
const RIPPLE = 0.03;
/** Each letter is back at rest this many seconds after it starts. */
const LETTER_TIME = 0.25;

const rnd = gsap.utils.random;
type Move = (chars: HTMLElement[]) => gsap.core.Timeline;

/**
 * One out-and-back tween per letter, staggered along the line. The repeat
 * and yoyo live inside the stagger so each letter turns around on its own
 * schedule; at the top level they would send the wave back in reverse.
 */
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

/** The heading sits at 800, so every weight move is a dip away from bold and back. */
const MOVES: Move[] = [
  // Hop: each letter lifts and lands.
  (chars) => ripple(chars, { y: -14 }, "power2.out"),
  // Breathe: a swell from the baseline.
  (chars) => ripple(chars, { scale: 1.07, transformOrigin: "50% 100%" }),
  // Lean: a nod to the right and back.
  (chars) => ripple(chars, { rotation: 7, transformOrigin: "50% 100%" }),
  // Flip: a full turn about the vertical axis, no perspective, so the letter folds to a line and back.
  (chars) => sweep(chars, { rotationY: 360, transformOrigin: "50% 50%" }),
  // Lighten: the weight axis eases down to medium and back.
  (chars) => ripple(chars, { fontWeight: 500 }),
  // Hairline: weight drops to the floor while the letter stretches to keep its footprint.
  (chars) => ripple(chars, { fontWeight: 400, scaleX: 1.14, transformOrigin: "50% 100%" }, "power2.inOut"),
  // Ink: weight snaps to thin, then fills back in to bold.
  (chars) =>
    gsap
      .timeline({ defaults: { overwrite: "auto" } })
      .fromTo(chars, { fontWeight: 400 }, { fontWeight: 800, duration: LETTER_TIME, ease: "power2.out", stagger: RIPPLE, immediateRender: false })
      .set(chars, { clearProps: "fontWeight" }),
  // Shear: a quick italic slant.
  (chars) => ripple(chars, { skewX: 12 }, "power2.inOut"),
  // Squash: pressed flat and released.
  (chars) => ripple(chars, { scaleY: 0.82, transformOrigin: "50% 100%" }, "power2.inOut"),
  // Twist: each letter swells with its own small twist, then back.
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

export type WaveOptions = {
  /** Seconds from the start of one wave to the start of the next. */
  period?: number;
};

/** Stops the wave. `keepSplit` leaves the letters split, at rest, for another animation to take over. */
export type WaveStop = ((keepSplit?: boolean) => void) & {
  /** Holds the next pass; a pass already running lands at rest. For off screen and the page's pause control. */
  pause: () => void;
  resume: () => void;
};

/** Starts the wave; returns its stop function, which carries `pause` and `resume`. */
export function startWave(heading: HTMLElement, { period = 4 }: WaveOptions = {}): WaveStop {
  if (prefersReducedMotion()) return Object.assign(() => {}, { pause: () => {}, resume: () => {} });
  const { split, chars } = guarded(() => {
    const split = SplitText.create(heading, { type: "chars,words" });
    const chars = split.chars as HTMLElement[];
    chars.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    pinWidths(chars);
    gsap.set(chars, { willChange: "transform, opacity" });
    return { split, chars };
  });

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
    current = move ? move(chars) : undefined;
  };

  const clock = gsap.delayedCall(period, () => {
    wave();
    clock.restart(true);
  });

  let stopped = false;
  const stop = (keepSplit = false) => {
    stopped = true;
    clock.kill();
    current?.kill();
    current = undefined;
    // A kept split is handed over at rest, never mid-move.
    if (keepSplit) gsap.set(chars, { clearProps: "transform,opacity,fontWeight,willChange" });
    else split.revert();
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
```

## Controller contract

Start the wave only after other splits on the heading are released, and stop it before another effect takes the heading. `stop()` reverts the split; `stop(true)` hands it, at rest, to an explicit new owner.

`pause()` and `resume()` hold and restart the ripple without re-splitting; call them as the heading leaves and re-enters the viewport. For a user pause (WCAG 2.2.2), wire the page's pause control or motion setting to `pause()`, or stop the wave when the app switches to reduced motion. The controller also supplies resize signals.
