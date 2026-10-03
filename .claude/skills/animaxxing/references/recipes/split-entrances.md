# Recipe: split entrances

Lifecycle: the framework controller composes these timelines into intro and outro, and may kill or await them. Display type only. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`, `gsap/SplitText`; scramble also needs `gsap/ScrambleTextPlugin`. `charsWeightWave` needs a variable weight axis covering `WEIGHT` (example: 400–800); adapt those values and its 600 cutoff, or pick a transform-only runner.

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

Copy this block whole; it registers `ScrambleTextPlugin`. Scramble replaces the element's text: plain display text only, no nested markup.

```ts
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";

gsap.registerPlugin(ScrambleTextPlugin);

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

export const scrambleIn: SplitRunner = (element, options = {}) => {
  const tl = build(options);
  if (!element) return tl;
  revertText(element);
  const text = element.textContent ?? "";
  if (prefersReducedMotion()) return tl.set(element, { autoAlpha: 1 });
  scramble(element, tl, options, text);
  return tl.set(element, { autoAlpha: 1 }).to(element, {
    duration: 0.9,
    ease: "none",
    scrambleText: { text, chars: "01{}/<>()=;", speed: 0.6, revealDelay: 0.15 },
  });
};

export const scrambleOut: SplitRunner = (element, options = {}) => {
  const tl = build(options);
  if (!element) return tl;
  revertText(element);
  if (prefersReducedMotion()) return tl.set(element, { autoAlpha: 0 });
  const text = element.textContent ?? "";
  scramble(element, tl, options, text);
  return tl
    .to(element, { duration: 0.5, ease: "none", scrambleText: { text: text.replace(/\S/g, "0"), chars: "01{}/<>()=;", speed: 0.8 } })
    .to(element, { autoAlpha: 0, duration: DURATION.micro, ease: EASE.exit });
};
```

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
