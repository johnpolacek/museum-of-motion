# Recipe: blast off

A hero outro from a pressed call to action: headline letters fly away from the button, subhead words drop, the button flares out while the others collapse, and the page rocks. The timeline is reversible.

Lifecycle: the framework controller calls `blastOff` as the outro before navigation, paired with the pressed button's particle `blast()`. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`, `gsap/SplitText`.

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

const rnd = gsap.utils.random;
/** Fast is the point. */
const LETTER_TIME: [number, number] = [0.4, 0.6];
const WORD_TIME: [number, number] = [0.32, 0.5];

export type BlastOffOptions = {
  /** The hero container: it gets the shake. */
  root: HTMLElement;
  heading: HTMLElement;
  /** The subhead's words, already split by speakIn; they are animated in place. */
  words: HTMLElement[];
  pressed: HTMLElement;
  others: HTMLElement[];
};

export type BlastOff = {
  timeline: gsap.core.Timeline;
  /** Puts the headline markup back. Call once the timeline is done with, either way. */
  revert: () => void;
};

function centre(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** repeatRefresh can change a tween's recorded start; preserve the authored values separately. */
function snapshotStyles(elements: HTMLElement[]): () => void {
  const props = ["transform", "translate", "rotate", "scale", "opacity", "visibility", "filter"];
  const saved = elements.map((element) => props.map((prop) =>
    [element.style.getPropertyValue(prop), element.style.getPropertyPriority(prop)] as const));
  return () => elements.forEach((element, i) => {
    gsap.set(element, { clearProps: props.join(",") });
    props.forEach((prop, j) => {
      const [value, priority] = saved[i]?.[j] ?? ["", ""];
      if (value) element.style.setProperty(prop, value, priority);
      else element.style.removeProperty(prop);
    });
  });
}

export function blastOff({ root, heading, words, pressed, others }: BlastOffOptions): BlastOff {
  const restore = snapshotStyles([root, heading, ...words, pressed, ...others]);
  let effect: BlastOff;
  try {
    if (prefersReducedMotion()) {
      const timeline = gsap.timeline().set([heading, ...words, pressed, ...others], { autoAlpha: 0 });
      effect = { timeline, revert: () => { timeline.revert(); } };
    } else effect = guarded(() => throwApart({ root, heading, words, pressed, others }));
  } catch (error) {
    restore();
    throw error;
  }
  let done = false;
  return { timeline: effect.timeline, revert() {
    if (done) return;
    done = true;
    try { effect.revert(); } finally { restore(); }
  } };
}

function throwApart({ root, heading, words, pressed, others }: BlastOffOptions): BlastOff {
  const origin = centre(pressed);
  const split = SplitText.create(heading, { type: "chars,words" });
  const chars = split.chars as HTMLElement[];
  const timeline = gsap.timeline({ defaults: { overwrite: "auto" } });

  // The page rocks the instant the button is pressed.
  timeline
    .to(root, { x: () => rnd(-8, 8), y: () => rnd(-5, 5), duration: 0.04, repeat: 7, yoyo: true, repeatRefresh: true, ease: "none" }, 0)
    .set(root, { x: 0, y: 0 }, ">");

  // The pressed button flares and burns out; the others fold in on themselves.
  timeline.to(pressed, { scale: 1.35, autoAlpha: 0, filter: "blur(14px)", duration: 0.28, ease: "power4.out" }, 0);
  if (others.length > 0) {
    timeline.to(others, { scale: 0, rotation: () => rnd(-200, 200), autoAlpha: 0, duration: 0.32, ease: "back.in(2.5)" }, 0.02);
  }

  // Letters are thrown straight away from the pressed button, each tumbling on its own.
  gsap.set(chars, { willChange: "transform, opacity" });
  for (const char of chars) {
    const c = centre(char);
    const angle = Math.atan2(c.y - origin.y, c.x - origin.x) + rnd(-0.45, 0.45);
    const distance = rnd(340, 820);
    timeline.to(
      char,
      {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        rotation: rnd(-720, 720),
        scale: rnd(0.3, 2.4),
        autoAlpha: 0,
        duration: rnd(LETTER_TIME[0], LETTER_TIME[1]),
        ease: "expo.out",
      },
      rnd(0, 0.1),
    );
  }

  // Words lose their footing and drop off the bottom, spinning.
  for (const word of words) {
    timeline.to(
      word,
      { x: rnd(-360, 360), y: rnd(260, 620), rotation: `+=${rnd(-240, 240)}`, autoAlpha: 0, duration: rnd(WORD_TIME[0], WORD_TIME[1]), ease: "power2.in" },
      rnd(0, 0.14),
    );
  }

  return {
    timeline,
    revert: () => {
      // revert() puts every target back exactly as it was, including the words' resting tilts.
      timeline.revert();
      split.revert();
    },
  };
}
```

## Controller contract

`blastOff` returns `{ timeline, revert }`. Before calling it, stop the wave and particle effects on the same targets; keep speak-in's `words` unreverted until the blast is done. The controller awaits the timeline, owns navigation and cancellation, and calls `revert` once the split is no longer needed.
