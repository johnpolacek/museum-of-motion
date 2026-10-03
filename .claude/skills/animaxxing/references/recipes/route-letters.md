# Recipe: route intro and outro

Lifecycle: the framework controller calls `buildPageIntro` at intro and `buildPageOutro` at outro; each reads the page's `data-page-transition` items and returns a timeline. Partial setup rolls back per [effect restoration](../effect-restoration.md).

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

const ITEM_SELECTOR = "[data-page-transition]";
const LETTERS = "letters";
const SIDE_LETTERS = "letters-sides";
const HORIZONTAL_SLIDE = "slide-horizontal";
/** Seconds the page holds before the headline letters begin to implode. */
const LETTERS_DELAY = 0.75;
/** How far a headline letter starts from its place. Scales with the viewport. */
const SPREAD_X = () => window.innerWidth * 0.6;
const SPREAD_Y = () => window.innerHeight * 0.6;
const SHIFT = { component: 8, page: 16 } as const;

type LetterSplit = ReturnType<typeof SplitText.create>;
const activeSplits = new WeakMap<HTMLElement, LetterSplit>();

function pageItems(container: HTMLElement): HTMLElement[] {
  const items = Array.from(container.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
  return items.length > 0 ? items : [container];
}
const ofKind = (items: HTMLElement[], kind: string) => items.filter((item) => item.dataset.pageTransition === kind);
/** Alternate letters come from opposite sides, so a line zips together. */
const sideOffset = (index: number) => (index % 2 === 0 ? -1 : 1) * SPREAD_X();

function splitLetters(item: HTMLElement): LetterSplit {
  revertLetters(item);
  const split = SplitText.create(item, { type: "chars", smartWrap: true, aria: "auto" });
  activeSplits.set(item, split);
  return split;
}

function revertLetters(item: HTMLElement): void {
  const split = activeSplits.get(item);
  if (!split) return;
  gsap.killTweensOf(split.chars);
  split.revert();
  activeSplits.delete(item);
}

/** Forgets splits a failed build created; its context has already reverted them. */
const forgetSplits = (container: HTMLElement) => () => pageItems(container).forEach((item) => activeSplits.delete(item));

export function buildPageIntro(container: HTMLElement, onComplete?: () => void): gsap.core.Timeline {
  return guarded(() => pageIntro(container, onComplete), forgetSplits(container));
}

export function buildPageOutro(container: HTMLElement, onComplete: () => void): gsap.core.Timeline {
  return guarded(() => pageOutro(container, onComplete), forgetSplits(container));
}

function pageIntro(container: HTMLElement, onComplete?: () => void): gsap.core.Timeline {
  const items = pageItems(container);
  const letters = ofKind(items, LETTERS);
  const sideLetters = ofKind(items, SIDE_LETTERS);
  const allLetters = [...letters, ...sideLetters];
  const slide = ofKind(items, HORIZONTAL_SLIDE);
  const standard = items.filter((item) => !allLetters.includes(item) && !slide.includes(item));
  const timeline = gsap.timeline({ defaults: { overwrite: "auto" } });

  const finish = () => {
    allLetters.forEach(revertLetters);
    if (allLetters.length > 0) gsap.set(allLetters, { autoAlpha: 1, clearProps: "transform,willChange" });
    onComplete?.();
  };
  timeline.eventCallback("onComplete", finish);
  timeline.eventCallback("onInterrupt", () => allLetters.forEach(revertLetters));

  if (prefersReducedMotion()) {
    if (slide.length > 0) gsap.set(slide, { transition: "none" });
    timeline.set(items, { autoAlpha: 1, clearProps: "transform,willChange" });
    if (slide.length > 0) timeline.set(slide, { clearProps: "transition" });
    return timeline;
  }

  // Hide every item while the container is still behind the controller's waiting barrier.
  if (standard.length > 0) gsap.set(standard, { autoAlpha: 0, y: 16 });
  if (slide.length > 0) gsap.set(slide, { autoAlpha: 0, x: -SHIFT.page, transition: "none" });
  const splits = letters.map((item) => {
    const split = splitLetters(item);
    gsap.set(item, { autoAlpha: 1, y: 0 });
    gsap.set(split.chars, {
      autoAlpha: 0,
      x: () => gsap.utils.random(-SPREAD_X(), SPREAD_X()),
      y: () => gsap.utils.random(-SPREAD_Y(), SPREAD_Y()),
      rotation: () => gsap.utils.random(-90, 90),
      scale: 0.5,
    });
    return split;
  });
  const sideSplits = sideLetters.map((item) => {
    const split = splitLetters(item);
    gsap.set(item, { autoAlpha: 1, y: 0 });
    gsap.set(split.chars, { autoAlpha: 0, x: (index: number) => sideOffset(index), y: 0 });
    return split;
  });

  timeline.addLabel("enter", 0).set(items, { willChange: "transform, opacity" }, "enter");
  for (const split of splits) {
    timeline.to(
      split.chars,
      { autoAlpha: 1, x: 0, y: 0, rotation: 0, scale: 1, duration: 0.75, ease: "power4.out", stagger: { each: 0.02, from: "random" } },
      `enter+=${LETTERS_DELAY}`,
    );
  }
  for (const split of sideSplits) {
    timeline.to(
      split.chars,
      { autoAlpha: 1, x: 0, duration: 0.6, ease: "power4.out", stagger: { each: 0.012, from: "center" } },
      `enter+=${LETTERS_DELAY + 0.14}`,
    );
  }
  if (standard.length > 0) {
    timeline.to(
      standard,
      { autoAlpha: 1, y: 0, duration: 0.42, ease: "power3.out", stagger: 0.09 },
      letters.length > 0 ? `enter+=${LETTERS_DELAY + 0.14}` : "enter",
    );
  }
  if (slide.length > 0) {
    timeline.to(
      slide,
      { autoAlpha: 1, x: 0, duration: 0.2, ease: "power2.out" },
      letters.length > 0 ? `enter+=${LETTERS_DELAY + 0.23}` : "enter+=0.09",
    );
  }
  return timeline.set(items, { clearProps: "transform,transition,willChange" }, timeline.duration());
}

function pageOutro(container: HTMLElement, onComplete: () => void): gsap.core.Timeline {
  const items = pageItems(container).reverse();
  const letters = ofKind(items, LETTERS);
  const sideLetters = ofKind(items, SIDE_LETTERS);
  const allLetters = [...letters, ...sideLetters];
  const slide = ofKind(items, HORIZONTAL_SLIDE);
  const standard = items.filter((item) => !allLetters.includes(item) && !slide.includes(item));
  allLetters.forEach(revertLetters);

  const timeline = gsap.timeline({
    defaults: { overwrite: "auto" },
    onComplete: () => {
      allLetters.forEach(revertLetters);
      if (allLetters.length > 0) gsap.set(allLetters, { autoAlpha: 0 });
      onComplete();
    },
  });
  timeline.eventCallback("onInterrupt", () => allLetters.forEach(revertLetters));
  if (slide.length > 0) gsap.set(slide, { transition: "none" });

  if (prefersReducedMotion()) return timeline.set(items, { autoAlpha: 0 });

  const splits = letters.map(splitLetters);
  const sideSplits = sideLetters.map(splitLetters);
  if (slide.length > 0) gsap.set(slide, { y: 0 });
  timeline.addLabel("exit", 0).set(items, { willChange: "transform, opacity" }, "exit");
  standard.forEach((item, index) => {
    timeline.to(item, { autoAlpha: 0, y: -8, duration: 0.22, ease: "power2.in" }, `exit+=${index * 0.055}`);
  });
  if (slide.length > 0) {
    timeline.to(slide, { autoAlpha: 0, x: SHIFT.component, duration: 0.14, ease: "power2.in" }, "exit");
  }
  for (const split of splits) {
    timeline.to(
      split.chars,
      {
        autoAlpha: 0,
        x: () => gsap.utils.random(-SPREAD_X(), SPREAD_X()),
        y: () => gsap.utils.random(-SPREAD_Y(), SPREAD_Y()),
        rotation: () => gsap.utils.random(-90, 90),
        scale: 1.6,
        duration: 0.28,
        ease: "power2.in",
        stagger: { each: 0.012, from: "edges" },
      },
      standard.length > 0 ? "exit+=0.1" : "exit",
    );
  }
  for (const split of sideSplits) {
    timeline.to(
      split.chars,
      { autoAlpha: 0, x: (index: number) => sideOffset(index), duration: 0.24, ease: "power2.in", stagger: { each: 0.008, from: "center" } },
      "exit",
    );
  }
  return timeline;
}
```

## Controller contract

Killing either timeline reverts its character splits without calling `onComplete`; the controller settles any wait on interruption itself.

The controller owns the barrier (targets prepared before the intro reveals; the outgoing end state covered through cleanup if its router needs it), focus, phase signals to surface effects, and any [resize response](../motion-vocabulary.md#resize). Do not give a page item a second entrance.
