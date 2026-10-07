# Recipe: split entrances

Lifecycle: the framework controller composes these timelines into intro and outro, and may kill or await them. Display type only. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`, `gsap/SplitText`. `charsWeightWave` needs a variable weight axis covering `WEIGHT` (example: 400–800); adapt those values and its 600 cutoff, or pick a transform-only runner.

Setup: apply [stable typography](../text-stability.md#stable-typography-for-character-animation) before splitting; check revert with the [cleanup checks](../verification.md#splittext-cleanup-stability). For confirmed clipped ink, pass `charMaskClass` with the [targeted mask CSS](../text-stability.md#apparent-weight-change-from-clipped-glyph-ink) and recheck both hidden endpoints.

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

const DURATION = { micro: 0.14, component: 0.2, page: 0.28 } as const;
const EASE = { entrance: "power2.out", exit: "power2.in", shift: "power2.inOut" } as const;
const STAGGER = { tight: 0.03, loose: 0.05 } as const;
const WEIGHT = { rest: 400, display: 800 } as const;

export type MotionOptions = {
  delay?: number;
  onComplete?: () => void;
  /** One CSS class token for confirmed character-mask clipping; no default padding. */
  charMaskClass?: string;
};
export type SplitRunner = (target: HTMLElement | null, options?: MotionOptions) => gsap.core.Timeline;

function build(options: MotionOptions): gsap.core.Timeline {
  const timeline = gsap.timeline({ delay: options.delay ?? 0, defaults: { overwrite: "auto" } });
  if (options.onComplete) timeline.eventCallback("onComplete", options.onComplete);
  return timeline;
}

type ActiveRun = { timeline: gsap.core.Timeline; restore: () => void };
/** The runner currently animating each element. */
const activeRuns = new WeakMap<HTMLElement, ActiveRun>();

/**
 * Stops the runner animating `element` and restores its text. Call it per target
 * after killing a parent timeline, whose kill never reaches nested interrupt
 * callbacks. A new runner on the same element calls it first.
 */
export function revertText(element: HTMLElement): void {
  const run = activeRuns.get(element);
  if (!run) return;
  activeRuns.delete(element);
  run.timeline.kill();
  run.restore();
}

/** Registers a run. Its release restores once, and only while the run is still current. */
function track(element: HTMLElement, timeline: gsap.core.Timeline, restore: () => void): () => void {
  const run = { timeline, restore };
  activeRuns.set(element, run);
  return () => {
    if (activeRuns.get(element) !== run) return;
    activeRuns.delete(element);
    restore();
  };
}

/**
 * Splits, runs `choreograph`, and reverts on completion or interrupt.
 * `aria: "auto"` keeps the original string for screen readers.
 */
function withSplit(
  element: HTMLElement | null,
  options: MotionOptions,
  config: SplitText.Vars,
  choreograph: (split: SplitText, tl: gsap.core.Timeline) => void,
  settled: gsap.TweenVars = { autoAlpha: 1 },
): gsap.core.Timeline {
  if (!element) return build(options);
  revertText(element);
  if (prefersReducedMotion()) return build(options).set(element, settled);

  return guarded(
    () => {
      const tl = build(options);
      const split = SplitText.create(element, { aria: "auto", ...config });
      const release = track(element, tl, () => split.revert());
      if (config.mask === "chars" && options.charMaskClass) {
        for (const mask of split.masks) mask.classList.add(options.charMaskClass);
      }
      tl.set(element, { autoAlpha: 1 });
      choreograph(split, tl);
      tl.eventCallback("onComplete", () => {
        release();
        options.onComplete?.();
      });
      // A run killed mid-way puts the text back too; the controller applies the settled or end state.
      tl.eventCallback("onInterrupt", release);
      return tl;
    },
    () => activeRuns.delete(element),
  );
}

/** Pins each character to the width it needs at its heaviest, so the weight axis can move without reflow. */
function pinWidths(chars: Element[], atWeight: number): void {
  for (const char of chars) {
    const element = char as HTMLElement;
    const previous = element.style.fontWeight;
    element.style.fontWeight = String(atWeight);
    const { width } = element.getBoundingClientRect();
    element.style.fontWeight = previous;
    element.style.display = "inline-block";
    element.style.width = `${width}px`;
    element.style.textAlign = "center";
  }
}

/** Characters rise behind masks. Requires persistent target CSS from the stable typography reference. */
export const charsRiseIn: SplitRunner = (element, options = {}) =>
  withSplit(element, options, { type: "chars", mask: "chars", smartWrap: true }, (split, tl) => {
    tl.from(split.chars, { yPercent: 115, duration: 0.5, ease: "power3.out", stagger: STAGGER.tight });
  });

/** Characters spring up with an elastic settle. Unmasked: the overshoot would clip. */
export const charsSpringIn: SplitRunner = (element, options = {}) =>
  withSplit(element, options, { type: "chars", smartWrap: true }, (split, tl) => {
    tl.from(split.chars, {
      yPercent: 115,
      autoAlpha: 0,
      duration: 1.1,
      ease: "elastic.out(1, 0.5)",
      stagger: STAGGER.tight,
    });
  });

/** And back down, in the same order. */
export const charsFallOut: SplitRunner = (element, options = {}) =>
  withSplit(
    element,
    options,
    { type: "chars", mask: "chars", smartWrap: true },
    (split, tl) => {
      tl.to(split.chars, { yPercent: -115, duration: DURATION.component, ease: "power2.in", stagger: STAGGER.tight }).set(
        element,
        { autoAlpha: 0 },
      );
    },
    { autoAlpha: 0 },
  );

/** Characters arrive out of order, like a dealer flicking cards. */
export const charsCascadeIn: SplitRunner = (element, options = {}) =>
  withSplit(element, options, { type: "chars", smartWrap: true }, (split, tl) => {
    tl.from(split.chars, {
      autoAlpha: 0,
      y: -18,
      rotation: () => gsap.utils.random(-14, 14),
      duration: 0.45,
      ease: "back.out(1.8)",
      stagger: { each: 0.02, from: "random" },
    });
  });

export const charsCascadeOut: SplitRunner = (element, options = {}) =>
  withSplit(
    element,
    options,
    { type: "chars", smartWrap: true },
    (split, tl) => {
      tl.to(split.chars, {
        autoAlpha: 0,
        y: 18,
        rotation: () => gsap.utils.random(-14, 14),
        duration: DURATION.component,
        ease: "power2.in",
        stagger: { each: 0.015, from: "random" },
      }).set(element, { autoAlpha: 0 });
    },
    { autoAlpha: 0 },
  );

/** Each character tips over its own top edge. */
export const charsFlipIn: SplitRunner = (element, options = {}) =>
  withSplit(element, options, { type: "chars", smartWrap: true }, (split, tl) => {
    tl.from(split.chars, {
      autoAlpha: 0,
      rotationX: -90,
      transformOrigin: "50% 0%",
      transformPerspective: 600,
      duration: 0.5,
      ease: "back.out(1.4)",
      stagger: STAGGER.tight,
    });
  });

export const charsFlipOut: SplitRunner = (element, options = {}) =>
  withSplit(
    element,
    options,
    { type: "chars", smartWrap: true },
    (split, tl) => {
      tl.to(split.chars, {
        autoAlpha: 0,
        rotationX: 90,
        transformOrigin: "50% 100%",
        transformPerspective: 600,
        duration: DURATION.component,
        ease: "power2.in",
        stagger: STAGGER.tight,
      }).set(element, { autoAlpha: 0 });
    },
    { autoAlpha: 0 },
  );

/** Characters converge from wherever they were thrown. */
export const charsScatterIn: SplitRunner = (element, options = {}) =>
  withSplit(element, options, { type: "chars", smartWrap: true }, (split, tl) => {
    tl.from(split.chars, {
      autoAlpha: 0,
      x: () => gsap.utils.random(-120, 120),
      y: () => gsap.utils.random(-60, 60),
      rotation: () => gsap.utils.random(-45, 45),
      scale: 0.6,
      duration: 0.6,
      ease: "power3.out",
      stagger: { each: 0.012, from: "center" },
    });
  });

export const charsScatterOut: SplitRunner = (element, options = {}) =>
  withSplit(
    element,
    options,
    { type: "chars", smartWrap: true },
    (split, tl) => {
      tl.to(split.chars, {
        autoAlpha: 0,
        x: () => gsap.utils.random(-120, 120),
        y: () => gsap.utils.random(-60, 60),
        rotation: () => gsap.utils.random(-45, 45),
        scale: 0.6,
        duration: DURATION.page,
        ease: "power2.in",
        stagger: { each: 0.012, from: "edges" },
      }).set(element, { autoAlpha: 0 });
    },
    { autoAlpha: 0 },
  );

/**
 * Where each character flies from or to: straight out from the line's center, farther for
 * characters already far from it, with a little random spread. A character at the center
 * takes a random direction.
 */
function burstOffsets(chars: Element[], element: HTMLElement, reach: number): Array<{ x: number; y: number }> {
  const box = element.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  return chars.map((char) => {
    const r = char.getBoundingClientRect();
    let dx = r.left + r.width / 2 - cx;
    let dy = r.top + r.height / 2 - cy;
    const length = Math.hypot(dx, dy);
    if (length < 1) {
      const angle = gsap.utils.random(0, Math.PI * 2);
      dx = Math.cos(angle);
      dy = Math.sin(angle);
    } else {
      dx /= length;
      dy /= length;
    }
    const distance = (reach + length) * gsap.utils.random(0.7, 1.3);
    return { x: dx * distance, y: dy * distance * 0.7 + gsap.utils.random(-reach, reach) * 0.15 };
  });
}

/** Characters rush in from all around and slam together into the line. */
export const charsImplodeIn: SplitRunner = (element, options = {}) =>
  withSplit(element, options, { type: "chars", smartWrap: true }, (split, tl) => {
    const reach = Math.max(element!.getBoundingClientRect().width * 0.6, 240);
    const offsets = burstOffsets(split.chars, element!, reach);
    tl.from(split.chars, {
      x: (i: number) => offsets[i]!.x,
      y: (i: number) => offsets[i]!.y,
      rotation: () => gsap.utils.random(-120, 120),
      scale: () => gsap.utils.random(1.6, 2.6),
      autoAlpha: 0,
      duration: 0.9,
      ease: "power4.out",
      stagger: { each: 0.01, from: "edges" },
    });
  });

/** And blows apart from the center, each character flying straight out. */
export const charsExplodeOut: SplitRunner = (element, options = {}) =>
  withSplit(
    element,
    options,
    { type: "chars", smartWrap: true },
    (split, tl) => {
      const reach = Math.max(element!.getBoundingClientRect().width * 0.6, 240);
      const offsets = burstOffsets(split.chars, element!, reach);
      tl.to(split.chars, {
        x: (i: number) => offsets[i]!.x,
        y: (i: number) => offsets[i]!.y,
        rotation: () => gsap.utils.random(-120, 120),
        scale: () => gsap.utils.random(1.6, 2.6),
        autoAlpha: 0,
        duration: 0.45,
        ease: "power3.in",
        stagger: { each: 0.008, from: "center" },
      }).set(element, { autoAlpha: 0 });
    },
    { autoAlpha: 0 },
  );

/**
 * A weight wave through the line: each character dips to the far end of the
 * axis and comes back. Widths are pinned first so letters breathe in place.
 */
export const charsWeightWave: SplitRunner = (element, options = {}) => {
  const settledWeight = element ? Number(getComputedStyle(element).fontWeight) || WEIGHT.rest : WEIGHT.rest;
  const farWeight = settledWeight >= 600 ? WEIGHT.rest : WEIGHT.display;
  return withSplit(
    element,
    options,
    { type: "chars", smartWrap: true },
    (split, tl) => {
      pinWidths(split.chars, Math.max(settledWeight, farWeight));
      tl.fromTo(
        split.chars,
        { fontWeight: settledWeight },
        { fontWeight: farWeight, duration: 0.3, ease: EASE.shift, stagger: { each: 0.03, from: "start" } },
      ).to(
        split.chars,
        { fontWeight: settledWeight, duration: 0.4, ease: EASE.shift, stagger: { each: 0.03, from: "start" } },
        0.18,
      );
    },
    { autoAlpha: 1 },
  );
};

/** Words swing in from alternating sides. */
export const wordsSlideIn: SplitRunner = (element, options = {}) =>
  withSplit(element, options, { type: "words" }, (split, tl) => {
    tl.from(split.words, {
      autoAlpha: 0,
      x: (index: number) => (index % 2 === 0 ? -40 : 40),
      duration: DURATION.page,
      ease: EASE.entrance,
      stagger: STAGGER.loose,
    });
  });

export const wordsSlideOut: SplitRunner = (element, options = {}) =>
  withSplit(
    element,
    options,
    { type: "words" },
    (split, tl) => {
      tl.to(split.words, {
        autoAlpha: 0,
        x: (index: number) => (index % 2 === 0 ? 40 : -40),
        duration: DURATION.component,
        ease: EASE.exit,
        stagger: STAGGER.tight,
      }).set(element, { autoAlpha: 0 });
    },
    { autoAlpha: 0 },
  );

/** Letters zip together from above and below, alternating. */
export const charsSlideIn: SplitRunner = (element, options = {}) =>
  withSplit(element, options, { type: "chars", smartWrap: true }, (split, tl) => {
    tl.from(split.chars, {
      autoAlpha: 0,
      yPercent: (index: number) => (index % 2 === 0 ? -110 : 110),
      duration: DURATION.page,
      ease: EASE.entrance,
      stagger: STAGGER.tight,
    });
  });

export const charsSlideOut: SplitRunner = (element, options = {}) =>
  withSplit(
    element,
    options,
    { type: "chars", smartWrap: true },
    (split, tl) => {
      tl.to(split.chars, {
        autoAlpha: 0,
        yPercent: (index: number) => (index % 2 === 0 ? 110 : -110),
        duration: DURATION.component,
        ease: EASE.exit,
        stagger: STAGGER.tight,
      }).set(element, { autoAlpha: 0 });
    },
    { autoAlpha: 0 },
  );

/** Whole lines wiped up behind masks. */
export const linesMaskIn: SplitRunner = (element, options = {}) =>
  withSplit(element, options, { type: "lines", mask: "lines" }, (split, tl) => {
    tl.from(split.lines, { yPercent: 110, duration: DURATION.page, ease: "power3.out", stagger: STAGGER.loose });
  });

export const linesMaskOut: SplitRunner = (element, options = {}) =>
  withSplit(
    element,
    options,
    { type: "lines", mask: "lines" },
    (split, tl) => {
      tl.to(split.lines, { yPercent: -110, duration: DURATION.component, ease: "power2.in", stagger: STAGGER.tight }).set(
        element,
        { autoAlpha: 0 },
      );
    },
    { autoAlpha: 0 },
  );

/** Clip for each line mask: a narrow sliver on the edge the line leaves from, or wide enough to show the whole line. */
const ELLIPSE = {
  closedBottom: "ellipse(20% 0% at 50% 100%)",
  openBottom: "ellipse(100% 120% at 50% 100%)",
  openTop: "ellipse(100% 120% at 50% 0%)",
  closedTop: "ellipse(20% 0% at 50% 0%)",
} as const;

/** Each line swells open from a sliver at its bottom edge while it rises into place. */
export const linesEllipseIn: SplitRunner = (element, options = {}) =>
  withSplit(element, options, { type: "lines", mask: "lines" }, (split, tl) => {
    tl.fromTo(
      split.masks,
      { clipPath: ELLIPSE.closedBottom },
      { clipPath: ELLIPSE.openBottom, duration: 0.8, ease: "power3.out", stagger: STAGGER.loose },
      0,
    ).from(split.lines, { yPercent: 40, duration: 0.8, ease: "power3.out", stagger: STAGGER.loose }, 0);
  });

/** And closes into a sliver at the top edge. */
export const linesEllipseOut: SplitRunner = (element, options = {}) =>
  withSplit(
    element,
    options,
    { type: "lines", mask: "lines" },
    (split, tl) => {
      tl.fromTo(
        split.masks,
        { clipPath: ELLIPSE.openTop },
        { clipPath: ELLIPSE.closedTop, duration: DURATION.page, ease: "power2.in", stagger: STAGGER.tight },
        0,
      )
        .to(split.lines, { yPercent: -40, duration: DURATION.page, ease: "power2.in", stagger: STAGGER.tight }, 0)
        .set(element, { autoAlpha: 0 });
    },
    { autoAlpha: 0 },
  );

type HighlightLine = { bar: HTMLElement; words: Element[] };

/** Lays a bar over each line's words. SplitText's revert removes the bars with the rest of the split. */
function addBars(split: SplitText): HighlightLine[] {
  return split.lines.map((line) => {
    const words = split.words.filter((word) => line.contains(word));
    const lineBox = line.getBoundingClientRect();
    const boxes = words.map((word) => word.getBoundingClientRect());
    const left = boxes.length ? Math.min(...boxes.map((box) => box.left)) : lineBox.left;
    const right = boxes.length ? Math.max(...boxes.map((box) => box.right)) : lineBox.right;
    const bar = document.createElement("span");
    bar.setAttribute("aria-hidden", "true");
    Object.assign(bar.style, {
      position: "absolute",
      top: "0",
      bottom: "0",
      left: `${left - lineBox.left}px`,
      width: `${right - left}px`,
      background: "var(--line-highlight, currentColor)",
      pointerEvents: "none",
    });
    (line as HTMLElement).style.position = "relative";
    line.appendChild(bar);
    return { bar, words };
  });
}

/** Transform origins for a bar that grows in reading direction, then retracts toward the line's end. */
function barOrigins(element: HTMLElement): { start: string; end: string } {
  const rtl = getComputedStyle(element).direction === "rtl";
  return { start: rtl ? "100% 50%" : "0% 50%", end: rtl ? "0% 50%" : "100% 50%" };
}

/**
 * A highlighter bar sweeps across each line, the words appear beneath it, and the
 * bar retracts. The bar color is `--line-highlight`, else the text color.
 */
export const linesHighlightIn: SplitRunner = (element, options = {}) =>
  withSplit(element, options, { type: "lines,words" }, (split, tl) => {
    const { start, end } = barOrigins(element!);
    tl.set(split.words, { autoAlpha: 0 }, 0);
    addBars(split).forEach(({ bar, words }, i) => {
      const at = i * 0.12;
      tl.fromTo(bar, { scaleX: 0, transformOrigin: start }, { scaleX: 1, duration: 0.35, ease: "power3.in" }, at)
        .set(words, { autoAlpha: 1 }, at + 0.35)
        .to(bar, { scaleX: 0, transformOrigin: end, duration: 0.4, ease: "power3.out" }, at + 0.35);
    });
  });

/** The bar sweeps back over each line and takes the words with it. */
export const linesHighlightOut: SplitRunner = (element, options = {}) =>
  withSplit(
    element,
    options,
    { type: "lines,words" },
    (split, tl) => {
      const { start, end } = barOrigins(element!);
      addBars(split).forEach(({ bar, words }, i) => {
        const at = i * 0.08;
        tl.fromTo(bar, { scaleX: 0, transformOrigin: start }, { scaleX: 1, duration: 0.25, ease: "power3.in" }, at)
          .set(words, { autoAlpha: 0 }, at + 0.25)
          .to(bar, { scaleX: 0, transformOrigin: end, duration: 0.25, ease: "power3.out" }, at + 0.25);
      });
      tl.set(element, { autoAlpha: 0 });
    },
    { autoAlpha: 0 },
  );
```

The ellipse runners clip the line masks, so glyphs that overhang a line box need the same room as `linesMaskIn`. The highlight bars measure word boxes at split time; run them once fonts are ready. Set `--line-highlight` from an existing brand token; the bar never changes the text color.

## Scramble

Text resolves out of noise, left to right. Each character scrambles within its own kind: a capital cycles through capitals, a lowercase letter through lowercase, a digit through digits, so the word keeps its shape while it settles. Punctuation never scrambles: it stays blank until its turn, then appears. Spaces stay spaces. Scramble replaces the element's text: plain display text only, no nested markup. Frames are drawn from the timeline's time, so a scrubbed or replayed run shows the same noise.

```ts
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
/** Noise changes this many times a second. */
const SCRAMBLE_RATE = 20;

/** A stable pseudo-random index for a character and a moment, so the same time always draws the same noise. */
function noiseIndex(position: number, tick: number, size: number): number {
  const x = Math.sin(position * 12.9898 + tick * 78.233) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * size);
}

/** The noise for one character: same kind for letters and digits, blank for punctuation, spaces kept. */
function noiseFor(char: string, position: number, tick: number): string {
  if (/\s/.test(char)) return char;
  if (/[0-9]/.test(char)) return DIGITS[noiseIndex(position, tick, 10)]!;
  if (char.toLowerCase() !== char.toUpperCase()) {
    const pool = char === char.toUpperCase() ? UPPER : LOWER;
    return pool[noiseIndex(position, tick, 26)]!;
  }
  return " ";
}

/** The text with its first `shown` characters real and the rest as noise at `time`. */
function scrambleFrame(text: string, shown: number, time: number): string {
  const tick = Math.floor(time * SCRAMBLE_RATE);
  return Array.from(text, (char, i) => (i < shown ? char : noiseFor(char, i, tick))).join("");
}

/** Scrambles `element`, restoring its real words when the run completes, is killed, or is reverted. */
function scramble(element: HTMLElement, tl: gsap.core.Timeline, options: MotionOptions, text: string): void {
  const release = track(element, tl, () => {
    element.textContent = text;
  });
  tl.eventCallback("onComplete", () => {
    release();
    options.onComplete?.();
  });
  tl.eventCallback("onInterrupt", release);
}

/** Noise first, then the real characters arrive left to right after `hold` of the run. */
export const scrambleIn: SplitRunner = (element, options = {}) => {
  const tl = build(options);
  if (!element) return tl;
  revertText(element);
  const text = element.textContent ?? "";
  if (prefersReducedMotion()) return tl.set(element, { autoAlpha: 1 });
  scramble(element, tl, options, text);
  const length = Array.from(text).length;
  const state = { progress: 0 };
  const hold = 0.15;
  return tl.set(element, { autoAlpha: 1 }).to(state, {
    progress: 1,
    duration: 0.9,
    ease: "none",
    onUpdate: () => {
      const shown = Math.floor(Math.max(0, (state.progress - hold) / (1 - hold)) * length);
      element.textContent = scrambleFrame(text, shown, state.progress * 0.9);
    },
  });
};

/** The real characters turn to noise from the end back, punctuation drops out, then the line fades. */
export const scrambleOut: SplitRunner = (element, options = {}) => {
  const tl = build(options);
  if (!element) return tl;
  revertText(element);
  if (prefersReducedMotion()) return tl.set(element, { autoAlpha: 0 });
  const text = element.textContent ?? "";
  scramble(element, tl, options, text);
  const length = Array.from(text).length;
  const state = { progress: 0 };
  return tl
    .to(state, {
      progress: 1,
      duration: 0.5,
      ease: "none",
      onUpdate: () => {
        element.textContent = scrambleFrame(text, length - Math.floor(state.progress * length), state.progress * 0.5);
      },
    })
    .to(element, { autoAlpha: 0, duration: DURATION.micro, ease: EASE.exit });
};
```

Scrambling changes character widths in proportional type, so a line can jitter while it resolves. Use `font-variant-numeric: tabular-nums` for figures, and keep scramble to display lines with room around them.

## Glitch

A heading breaks up like a bad signal for a moment, then snaps clean. Six types:

- `slice`: horizontal bands jump sideways.
- `blocks`: rectangular chunks shift on both axes.
- `skew`: the whole line jolts through sharp skews.
- `ghost`: offset copies in the text's own color echo, then collapse into it.
- `weight`: letters jump between weights, then settle. Needs a variable weight axis, as `charsWeightWave` does.
- `scanline`: bands arrive one at a time from the top, each landing with a jump.

Jumps are stepped, twelve a second, and shrink as the text settles (or grow as it leaves). They move ink sideways; nothing blinks. Only `ghost` shows and hides anything, once each way, so a run stays well under three flashes a second ([WCAG 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold)). The layered types hide the element's own content with `opacity: 0`, so assistive technology still reads it, and lay `aria-hidden` clipped copies over it; the copies carry no ids. There is no color split: copies stay in the text's color.

```ts
export type GlitchType = "slice" | "blocks" | "skew" | "ghost" | "weight" | "scanline";
export type GlitchOptions = MotionOptions & {
  type?: GlitchType;
  /** Seconds of glitching. Defaults: 0.6 in, 0.35 out. */
  duration?: number;
  /** Largest jump, as a fraction of the font size. */
  intensity?: number;
};
export type GlitchRunner = (target: HTMLElement | null, options?: GlitchOptions) => gsap.core.Timeline;

/** Jumps per second. Stepped, so it reads as a signal dropping, not as motion. */
const GLITCH_RATE = 12;

/** A clip rectangle as `inset()` percentages: top, right, bottom, left. */
type Cell = [number, number, number, number];
function cellGrid(rows: number, cols: number): Cell[] {
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push([(r / rows) * 100, 100 - ((c + 1) / cols) * 100, 100 - ((r + 1) / rows) * 100, (c / cols) * 100]);
    }
  }
  return cells;
}
const GLITCH_CELLS: Record<Exclude<GlitchType, "skew" | "weight">, Cell[]> = {
  slice: cellGrid(6, 1),
  blocks: cellGrid(3, 4),
  scanline: cellGrid(10, 1),
  ghost: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
};

/**
 * Hides the element's content with opacity, so it is still read, and lays one clipped copy
 * per cell over it. The restore puts the original nodes and the `position` back exactly.
 */
function glitchLayers(element: HTMLElement, cells: Cell[]): { layers: HTMLElement[]; restore: () => void } {
  const position = [element.style.getPropertyValue("position"), element.style.getPropertyPriority("position")] as const;
  if (getComputedStyle(element).position === "static") element.style.position = "relative";
  const source = document.createElement("span");
  source.style.opacity = "0";
  source.append(...Array.from(element.childNodes));
  element.append(source);
  const layers = cells.map(([top, right, bottom, left]) => {
    const layer = document.createElement("span");
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, {
      position: "absolute",
      inset: "0",
      padding: "inherit",
      boxSizing: "border-box",
      pointerEvents: "none",
      // Cells overlap by a pixel, so no hairline seam shows between them at rest.
      clipPath: `inset(calc(${top}% - 0.5px) calc(${right}% - 0.5px) calc(${bottom}% - 0.5px) calc(${left}% - 0.5px))`,
    });
    for (const node of Array.from(source.childNodes)) {
      const copy = node.cloneNode(true);
      if (copy instanceof Element) {
        copy.removeAttribute("id");
        copy.querySelectorAll("[id]").forEach((child) => child.removeAttribute("id"));
      }
      layer.append(copy);
    }
    element.append(layer);
    return layer;
  });
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    layers.forEach((layer) => layer.remove());
    source.replaceWith(...Array.from(source.childNodes));
    if (position[0]) element.style.setProperty("position", position[0], position[1]);
    else element.style.removeProperty("position");
  };
  return { layers, restore };
}

/** Stepped jumps for the layered types. `amount(i)` scales step i: falling for entrances, rising for exits. */
function layeredGlitch(
  tl: gsap.core.Timeline,
  type: Exclude<GlitchType, "skew" | "weight">,
  layers: HTMLElement[],
  steps: number,
  shift: number,
  entering: boolean,
): void {
  const at = (i: number) => i / GLITCH_RATE;
  const amount = (i: number) => (entering ? 1 - i / steps : (i + 1) / steps);
  const jump = (scale: number) => gsap.utils.random(-shift, shift) * scale;
  const still = { x: 0, y: 0 };
  if (type === "ghost") {
    const [main, ...ghosts] = layers;
    if (entering) tl.set(main!, { autoAlpha: 0 }, 0).set(main!, { autoAlpha: 1 }, at(1));
    tl.set(ghosts, { opacity: 0.45 }, 0);
    for (let i = 0; i < steps; i++) {
      ghosts.forEach((ghost, g) => tl.set(ghost, { x: (g ? 1 : -1) * Math.abs(jump(amount(i))) * 1.5, y: jump(amount(i) * 0.2) }, at(i)));
    }
    tl.set(ghosts, { ...still, autoAlpha: 0 }, at(steps));
    return;
  }
  if (type === "scanline") {
    const each = steps / layers.length;
    layers.forEach((layer, k) => {
      const turn = Math.floor(k * each);
      if (entering) {
        tl.set(layer, { autoAlpha: 0 }, 0)
          .set(layer, { autoAlpha: 1, x: jump(1) }, at(turn))
          .set(layer, still, at(turn + 1));
      } else {
        tl.set(layer, { x: jump(1) }, at(turn)).set(layer, { autoAlpha: 0 }, at(turn + 1));
      }
    });
    return;
  }
  // slice and blocks: a third of the cells jump at each step, the rest sit still.
  const vertical = type === "blocks" ? 0.4 : 0;
  for (let i = 0; i < steps; i++) {
    layers.forEach((layer) => {
      const moves = Math.random() < 0.34;
      tl.set(layer, moves ? { x: jump(amount(i)), y: jump(amount(i) * vertical) } : still, at(i));
    });
  }
  if (entering) tl.set(layers, still, at(steps));
  else tl.set(layers, { autoAlpha: 0 }, at(steps));
}

function glitch(entering: boolean): GlitchRunner {
  return (element, options = {}) => {
    const settled = { autoAlpha: entering ? 1 : 0 };
    if (!element) return build(options);
    revertText(element);
    if (prefersReducedMotion()) return build(options).set(element, settled);
    const type = options.type ?? "slice";
    const duration = options.duration ?? (entering ? 0.6 : 0.35);
    const steps = Math.max(2, Math.round(duration * GLITCH_RATE));
    const shift = (parseFloat(getComputedStyle(element).fontSize) || 16) * (options.intensity ?? 0.12);
    const amount = (i: number) => (entering ? 1 - i / steps : (i + 1) / steps);

    if (type === "weight") {
      const rest = Number(getComputedStyle(element).fontWeight) || WEIGHT.rest;
      return withSplit(
        element,
        options,
        { type: "chars", smartWrap: true },
        (split, tl) => {
          pinWidths(split.chars, Math.max(rest, WEIGHT.display));
          for (let i = 0; i < steps; i++) {
            split.chars.forEach((char) =>
              tl.set(char, { fontWeight: gsap.utils.random(WEIGHT.rest - 300, WEIGHT.display + 100, 100), y: gsap.utils.random(-shift, shift) * amount(i) * 0.3 }, i / GLITCH_RATE),
            );
          }
          tl.set(split.chars, entering ? { fontWeight: rest, y: 0 } : { autoAlpha: 0 }, steps / GLITCH_RATE);
          if (!entering) tl.set(element, { autoAlpha: 0 });
        },
        settled,
      );
    }

    let restore = () => {};
    return guarded(
      () => {
        const tl = build(options);
        const release = track(element, tl, () => restore());
        tl.set(element, { autoAlpha: 1 }, 0);
        if (type === "skew") {
          const transform = element.style.transform;
          restore = () => {
            gsap.set(element, { clearProps: "transform" });
            if (transform) element.style.transform = transform;
          };
          for (let i = 0; i < steps; i++) {
            tl.set(element, { x: gsap.utils.random(-shift, shift) * amount(i), skewX: gsap.utils.random(-24, 24) * amount(i) }, i / GLITCH_RATE);
          }
          tl.set(element, { x: 0, skewX: 0 }, steps / GLITCH_RATE);
        } else {
          const made = glitchLayers(element, GLITCH_CELLS[type]);
          restore = made.restore;
          layeredGlitch(tl, type, made.layers, steps, shift, entering);
        }
        if (!entering) tl.set(element, { autoAlpha: 0 });
        tl.eventCallback("onComplete", () => {
          release();
          options.onComplete?.();
        });
        tl.eventCallback("onInterrupt", release);
        return tl;
      },
      () => {
        activeRuns.delete(element);
        restore();
      },
    );
  };
}

/** The text breaks up, then settles clean. */
export const glitchIn: GlitchRunner = glitch(true);
/** The text breaks up more and more, then is gone. */
export const glitchOut: GlitchRunner = glitch(false);
```

Keep the intensity low on body-sized text; the effect is for display type. Glitch an element whose text is plain or simply nested: copies clone its markup, so interactive children are not suited. `skew` and the layered types restore exactly on completion, interruption, or `revertText`; `weight` reverts its split the way the other character runners do.

## Wiring

```ts
// In the framework controller, after fonts are ready. `heading` keeps its stable-typography class.
const intro = gsap.timeline();
// Only when clipping is confirmed (CSS Modules: styles.titleCharMask).
const headlineOptions = { charMaskClass: "title-char-mask" };
intro.add(charsRiseIn(heading, headlineOptions), 0);
intro.add(linesMaskIn(lede), 0.2);
// On interruption: intro.kill(); revertText(heading); revertText(lede);
// Outro: the paired exits, in reverse order.
const outro = gsap.timeline();
outro.add(linesMaskOut(lede), 0).add(charsFallOut(heading, headlineOptions), 0.05);
```

Building inside the controller's `gsap.context()`, including async builds added with `context.add()`, also reverts the splits when that context reverts.

Give a split heading its own pre-paint hiding rule; do not also mark it as a page item, or two entrances fight over it.
