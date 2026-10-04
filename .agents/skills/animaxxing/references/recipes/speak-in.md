# Recipe: speak in

Short display copy, such as a hero subhead, arrives word by word at speaking pace: longer words take longer and sentences end in a pause. Emphasis words enter letter by letter and may keep a finish: `broken` (letters at random weights and widths) or `tilt`.

Lifecycle: the framework controller calls `speakIn` at intro, keeps the returned `revert` while finishes should persist, and calls it on outro or unmount. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`, `gsap/SplitText`. `broken` needs a variable weight axis (example: 400–800); adapt it, or use `tilt` on a static face.

Setup: apply [stable typography](../text-stability.md#stable-typography-for-character-animation) to the emphasis elements only, before splitting; check revert with the [cleanup checks](../verification.md#splittext-cleanup-stability).

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

/** Seconds a word takes to arrive, before adding time per letter. */
const WORD_BASE = 0.06;
/** Extra seconds per letter, so long words take longer to say. */
const PER_LETTER = 0.008;
/** Breath after a sentence ends. */
const SENTENCE_PAUSE = 0.65;
/** Extra beat around an emphasized word. */
const EMPHASIS_HOLD = 0.1;
/** Seconds the settle into a finish takes, after the letters have landed. */
const FINISH_TIME = 0.22;

const rnd = gsap.utils.random;

type WordIn = (word: HTMLElement) => gsap.core.Tween;
type LettersIn = (chars: HTMLElement[]) => gsap.core.Tween;

const WORD_INS: WordIn[] = [
  (w) => gsap.fromTo(w, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, ease: "power3.out" }),
  (w) => gsap.fromTo(w, { y: -12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.35, ease: "power2.out" }),
  (w) => gsap.fromTo(w, { scale: 0.6, autoAlpha: 0, transformOrigin: "50% 100%" }, { scale: 1, autoAlpha: 1, duration: 0.45, ease: "back.out(2)" }),
  (w) => gsap.fromTo(w, { filter: "blur(8px)", autoAlpha: 0 }, { filter: "blur(0px)", autoAlpha: 1, duration: 0.45, ease: "power2.out" }),
  (w) => gsap.fromTo(w, { x: -14, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.35, ease: "power3.out" }),
  (w) => gsap.fromTo(w, { rotationX: -80, autoAlpha: 0, transformOrigin: "50% 100%" }, { rotationX: 0, autoAlpha: 1, duration: 0.45, ease: "power3.out" }),
];

const LETTERS_INS: LettersIn[] = [
  // Tumble: letters drop from above and bounce into place.
  (chars) => gsap.fromTo(chars, { y: -40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: "bounce.out", stagger: 0.04 }),
  // Stamp: letters shrink down from oversized.
  (chars) => gsap.fromTo(chars, { scale: 2.2, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.35, ease: "power4.out", stagger: 0.035 }),
  // Pop: letters spring in from nothing with a twist.
  (chars) =>
    gsap.fromTo(
      chars,
      { scale: 0, rotation: () => rnd(-30, 30), autoAlpha: 0 },
      { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.7, ease: "elastic.out(1, 0.45)", stagger: 0.05 },
    ),
  // Cascade: letters rise and straighten one after another.
  (chars) => gsap.fromTo(chars, { y: 24, rotation: -12, autoAlpha: 0 }, { y: 0, rotation: 0, autoAlpha: 1, duration: 0.5, ease: "back.out(1.7)", stagger: 0.035 }),
];

const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export type Finish = "broken" | "tilt";
export type Emphasis = string | { word: string; finish?: Finish; /** Degrees for `tilt`, clockwise positive. Random when omitted. */ angle?: number };
export type SpeakOptions = {
  /** Words that get the letter-level entrance, matched ignoring case and punctuation. */
  emphasis?: Emphasis[];
  /** Seconds of silence before the first word. */
  delay?: number;
};

function settle(timeline: gsap.core.Timeline, word: HTMLElement, chars: HTMLElement[], finish: Finish, angle?: number) {
  if (finish === "broken") {
    // Each letter lands somewhere on the 400 to 800 axis and stretches or narrows a little to match.
    timeline.to(
      chars,
      { fontWeight: () => rnd(400, 800, 10), scaleX: () => rnd(0.85, 1.2), transformOrigin: "50% 100%", duration: FINISH_TIME, ease: "power2.out", stagger: 0.015 },
      ">",
    );
  } else {
    timeline.to(
      word,
      { rotation: angle ?? rnd(2.5, 5) * (Math.random() < 0.5 ? -1 : 1), transformOrigin: "50% 100%", duration: FINISH_TIME, ease: "power2.out" },
      ">",
    );
  }
}

/**
 * Builds the entrance and returns it with a revert that puts the paragraph's
 * markup back. The element should start hidden; the timeline reveals it as
 * the first word lands. `words` are the split words, for the outro to throw.
 */
export function speakIn(
  el: HTMLElement,
  { emphasis = [], delay = 0 }: SpeakOptions = {},
): { timeline: gsap.core.Timeline; words: HTMLElement[]; revert: () => void } {
  if (prefersReducedMotion()) {
    const timeline = gsap.timeline().set(el, { autoAlpha: 1 });
    return { timeline, words: [], revert: () => {} };
  }
  return guarded(() => speak(el, emphasis, delay));
}

function speak(el: HTMLElement, emphasis: Emphasis[], delay: number) {
  const timeline = gsap.timeline({ defaults: { overwrite: "auto" } });

  const wanted = new Map<string, { finish?: Finish; angle?: number }>(
    emphasis.map((e) =>
      typeof e === "string"
        ? [normalize(e), {}]
        : [normalize(e.word), { ...(e.finish && { finish: e.finish }), ...(e.angle !== undefined && { angle: e.angle }) }],
    ),
  );
  const split = SplitText.create(el, { type: "words" });
  const words = split.words as HTMLElement[];
  const letterSplits: SplitText[] = [];

  gsap.set(words, { autoAlpha: 0 });
  timeline.set(el, { autoAlpha: 1 }, 0);

  let t = delay;
  let wordIndex = 0;
  let lettersIndex = Math.floor(Math.random() * LETTERS_INS.length);
  let lastWordIn = -1;
  for (const word of words) {
    const text = word.textContent ?? "";
    const letters = normalize(text).length;

    if (wanted.has(normalize(text))) {
      const inner = SplitText.create(word, { type: "chars" });
      letterSplits.push(inner);
      const chars = inner.chars as HTMLElement[];
      gsap.set(chars, { autoAlpha: 0 });
      const enter = LETTERS_INS[lettersIndex % LETTERS_INS.length];
      lettersIndex++;
      timeline.set(word, { autoAlpha: 1 }, t);
      if (enter) timeline.add(enter(chars), t);
      const spec = wanted.get(normalize(text));
      if (spec?.finish) settle(timeline, word, chars, spec.finish, spec.angle);
      t += WORD_BASE + PER_LETTER * letters + EMPHASIS_HOLD;
    } else {
      // Never the same entrance twice in a row.
      let pick = Math.floor(Math.random() * WORD_INS.length);
      if (pick === lastWordIn) pick = (pick + 1) % WORD_INS.length;
      lastWordIn = pick;
      const enter = WORD_INS[pick];
      if (enter) timeline.add(enter(word), t);
      t += WORD_BASE + PER_LETTER * letters;
    }
    wordIndex++;
    if (/[.!?]$/.test(text.trim()) && wordIndex < words.length) t += SENTENCE_PAUSE;
  }

  return {
    timeline,
    words,
    revert: () => {
      for (const inner of letterSplits) inner.revert();
      split.revert();
    },
  };
}
```

## Wiring

```ts
// Hero subhead, marked data-speak-intro and hidden by the pre-paint rule:
const EMPHASIS = ["low", "rizz", { word: "cooked", finish: "broken" }, "negative", "aura", "agents", "animate"];
const spoken = speakIn(subhead, { emphasis: EMPHASIS, delay: 0.3 }); // starts after the letters land
// On outro: blastOff({ ..., words: spoken.words, ... }), then spoken.revert() after it.
// On unmount: spoken.timeline.kill(); spoken.revert();
```

Without the pre-paint rule, `set(el, { autoAlpha: 0 })` before `speakIn` provides the initial state.
