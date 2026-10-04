# Recipe: typewriter

Text typed out one character at a time behind a caret, at a human rhythm: a little uneven, slower after a space, slowest after punctuation. `typeIn` types an element's text; `typeOut` deletes it. `retype` cycles one word in a line through a list, typing, holding, and deleting, then stops on the last word.

Lifecycle: the framework controller composes `typeIn` and `typeOut` into intro and outro and may kill or await them. It starts `retype` once settled, keeps its controls, and calls `revert` on outro or unmount. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`.

The typed text is plain: `typeIn` reads the element's text and line breaks (`<br>`), not nested markup. The element keeps its final size from the first frame: its own content stays in place at `opacity: 0`, still read by assistive technology, and the typing shows in an `aria-hidden` overlay. `retype` hides the cycling word from assistive technology and adds a visually hidden twin listing every word, so the line is read once, whole.

```css
/* The caret: a bar in the text color. Size it to the face. */
[data-caret] { display: inline-block; width: 0.06em; height: 0.9em; margin-left: 0.04em; vertical-align: -0.08em; background: currentColor; }
```

```ts
import gsap from "gsap";

/* Swap for the project's helper if it has one. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Runs setup in its own GSAP context; on throw, runs `onFail`, reverts what it created, and rethrows. */
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

export type TypeOptions = {
  delay?: number;
  onComplete?: () => void;
  /** Characters per second, on average. */
  speed?: number;
  /** Show a caret while typing. */
  caret?: boolean;
  /** Times the caret blinks after typing ends, before it goes. Each blink is about a second. */
  blinks?: number;
};

/** Seconds per caret blink: half on, half off, under three flashes a second. */
const BLINK = 1.06;

/** The element's text with `<br>` as a line break. */
function plainText(element: HTMLElement): string {
  return Array.from(element.childNodes)
    .map((node) => (node.nodeName === "BR" ? "\n" : (node.textContent ?? "")))
    .join("");
}

/** Seconds before each character appears: uneven, slower after spaces, slowest after punctuation. */
function rhythm(text: string, speed: number): number[] {
  const each = 1 / speed;
  return [...text].map((_, i) => {
    const before = text[i - 1] ?? "";
    const base = each * gsap.utils.random(0.6, 1.4);
    if (/[.,!?;:\n]/.test(before)) return base + each * 4;
    if (before === " ") return base + each * 0.6;
    return base;
  });
}

function makeCaret(): HTMLElement {
  const caret = document.createElement("span");
  caret.dataset.caret = "";
  caret.setAttribute("aria-hidden", "true");
  return caret;
}

type Run = { timeline: gsap.core.Timeline; restore: () => void };
/** The run currently typing each element. */
const runs = new WeakMap<HTMLElement, Run>();

/** Stops the run typing `element` and restores it. Call it after killing a parent timeline. */
export function revertTyping(element: HTMLElement): void {
  const run = runs.get(element);
  if (!run) return;
  runs.delete(element);
  run.timeline.kill();
  run.restore();
}

/**
 * Lays an aria-hidden overlay over the element, whose own content stays in place at opacity 0
 * so its size never changes. Returns the overlay's text node, its caret, and a restore.
 */
function overlay(element: HTMLElement, withCaret: boolean) {
  const position = [element.style.getPropertyValue("position"), element.style.getPropertyPriority("position")] as const;
  if (getComputedStyle(element).position === "static") element.style.position = "relative";
  const source = document.createElement("span");
  source.style.opacity = "0";
  source.append(...Array.from(element.childNodes));
  const layer = document.createElement("span");
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, { position: "absolute", inset: "0", padding: "inherit", boxSizing: "border-box", whiteSpace: "pre-line", pointerEvents: "none" });
  const typed = document.createTextNode("");
  const caret = withCaret ? makeCaret() : undefined;
  layer.append(typed, ...(caret ? [caret] : []));
  element.append(source, layer);
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    layer.remove();
    source.replaceWith(...Array.from(source.childNodes));
    if (position[0]) element.style.setProperty("position", position[0], position[1]);
    else element.style.removeProperty("position");
  };
  return { typed, caret, restore };
}

/** Steps `count` from `from` to `to`, one character per beat, writing each frame. Reversible. */
function typeSteps(tl: gsap.core.Timeline, beats: number[], write: (n: number) => void, forward: boolean): void {
  const state = { n: forward ? 0 : beats.length };
  beats.forEach((beat, i) => {
    const target = forward ? i + 1 : beats.length - 1 - i;
    tl.to(state, { n: target, duration: beat, ease: "steps(1)", onUpdate: () => write(Math.round(state.n)) });
  });
}

/** Blinks the caret `count` times, then hides it. Solid while typing. */
function blinkOut(tl: gsap.core.Timeline, caret: HTMLElement | undefined, count: number): void {
  if (!caret) return;
  for (let i = 0; i < count; i++) {
    tl.set(caret, { autoAlpha: 0 }, `+=${BLINK / 2}`).set(caret, { autoAlpha: 1 }, `+=${BLINK / 2}`);
  }
  tl.set(caret, { autoAlpha: 0 }, `+=${BLINK / 2}`);
}

function typeRun(entering: boolean) {
  return (element: HTMLElement | null, { delay = 0, onComplete, speed = 22, caret = true, blinks = entering ? 2 : 0 }: TypeOptions = {}) => {
    const tl = gsap.timeline({ delay, defaults: { overwrite: "auto" } });
    if (!element) return onComplete ? tl.eventCallback("onComplete", onComplete) : tl;
    revertTyping(element);
    if (prefersReducedMotion()) {
      if (onComplete) tl.eventCallback("onComplete", onComplete);
      return tl.set(element, { autoAlpha: entering ? 1 : 0 });
    }
    let restore = () => {};
    return guarded(
      () => {
        const text = plainText(element);
        const made = overlay(element, caret);
        restore = made.restore;
        const run = { timeline: tl, restore };
        runs.set(element, run);
        const release = () => {
          if (runs.get(element) !== run) return;
          runs.delete(element);
          restore();
        };
        const write = (n: number) => {
          made.typed.data = text.slice(0, n);
        };
        write(entering ? 0 : text.length);
        tl.set(element, { autoAlpha: 1 }, 0);
        typeSteps(tl, rhythm(text, entering ? speed : speed * 2), write, entering);
        blinkOut(tl, made.caret, blinks);
        if (!entering) tl.set(element, { autoAlpha: 0 });
        tl.eventCallback("onComplete", () => {
          release();
          onComplete?.();
        });
        tl.eventCallback("onInterrupt", release);
        return tl;
      },
      () => {
        runs.delete(element);
        restore();
      },
    );
  };
}

/** Types the element's text in. */
export const typeIn = typeRun(true);
/** Deletes the element's text, last character first, at twice the speed, then hides it. */
export const typeOut = typeRun(false);
```

## retype

One word in a line cycles through a list: it deletes back to nothing, types the next word, and holds. It plays through the list once and stops on the last word, so it rests; pass `loop: true` only with a visible pause control, since a loop runs past five seconds.

```html
<h1>Made for <span data-retype>designers</span></h1>
```

```ts
export type RetypeOptions = {
  /** Characters per second while typing. Deleting runs twice as fast. */
  speed?: number;
  /** Seconds each word holds before it is deleted. */
  hold?: number;
  /** Start again from the first word after the last. Needs a pause control. */
  loop?: boolean;
};
export type Retype = { timeline: gsap.core.Timeline; pause: () => void; play: () => void; revert: () => void };

/** Visually hidden, still read by assistive technology. */
const VISUALLY_HIDDEN = { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" };

/** `target`'s own text is the first word; `words` follow it. */
export function retype(target: HTMLElement, words: string[], { speed = 16, hold = 1.6, loop = false }: RetypeOptions = {}): Retype {
  const first = target.textContent ?? "";
  const list = [first, ...words];
  const timeline = gsap.timeline({ paused: true, repeat: loop ? -1 : 0 });
  const idle = { timeline, pause: () => {}, play: () => {}, revert: () => {} };
  if (prefersReducedMotion() || !words.length) return idle;
  let restore = () => {};
  return guarded(
    () => {
      const hidden = target.getAttribute("aria-hidden");
      const spoken = document.createElement("span");
      Object.assign(spoken.style, VISUALLY_HIDDEN);
      spoken.textContent = list.join(", ");
      const caret = makeCaret();
      target.setAttribute("aria-hidden", "true");
      target.after(caret);
      target.before(spoken);
      restore = () => {
        timeline.kill();
        caret.remove();
        spoken.remove();
        target.textContent = first;
        if (hidden === null) target.removeAttribute("aria-hidden");
        else target.setAttribute("aria-hidden", hidden);
      };
      list.forEach((word, i) => {
        if (i === 0) {
          timeline.to({}, { duration: hold });
          return;
        }
        const previous = list[i - 1]!;
        typeSteps(timeline, rhythm(previous, speed * 2), (n) => (target.textContent = previous.slice(0, n)), false);
        typeSteps(timeline, rhythm(word, speed), (n) => (target.textContent = word.slice(0, n)), true);
        if (i < list.length - 1 || loop) timeline.to({}, { duration: hold });
      });
      if (loop) {
        // Back to the first word, so each pass starts where the last ended.
        const last = list[list.length - 1]!;
        typeSteps(timeline, rhythm(last, speed * 2), (n) => (target.textContent = last.slice(0, n)), false);
        typeSteps(timeline, rhythm(first, speed), (n) => (target.textContent = first.slice(0, n)), true);
      } else {
        blinkOut(timeline, caret, 2);
      }
      timeline.play();
      return { timeline, pause: () => void timeline.pause(), play: () => void timeline.play(), revert: () => restore() };
    },
    () => restore(),
  );
}
```

The last word stays as typed, which may differ from the markup; `revert` puts the first word back. Width changes as the word types, so place the cycling word where the line can reflow, such as at its end.

## Controller contract

| Builder | Phase | Returns | Reduced motion |
|---|---|---|---|
| `typeIn` | Intro, after fonts are ready | timeline; restores the markup on completion or interrupt | Element shown; completion fires |
| `typeOut` | Outro | timeline; ends hidden | Element hidden; completion fires |
| `retype` | Settled | `{ timeline, pause, play, revert }` | No-op; the first word stays |

- Kill a parent timeline, then call `revertTyping` per element, as with split runners.
- The caret blinks under three times a second and stops: typing ends with two blinks, then it goes. A looping `retype` needs a visible pause control wired to `pause` and `play`.
