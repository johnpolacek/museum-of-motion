# Recipe: hover effects

Hover treatments for controls: a label that rolls over to a copy of itself, an underline that sweeps in, and a card image that zooms inside its frame. Mouse hover (`pointerType === "mouse"`) and `:focus-visible` share one hot state; touch, pen, and click- or tap-derived focus never enter it, so nothing sticks after a tap. The check runs per event, so a hybrid device gains the effects when a mouse arrives. None changes the control's box, accessible name, colors, or font.

Lifecycle: build per the [contract](#controller-contract); the framework controller calls the idempotent teardown on unmount, which removes injected markup and restores inline styles. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`.

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

/** Editable defaults; match the app's own hover transitions where it has them. */
const ROLL = { duration: 0.35, ease: "power3.out" } as const;
const SWEEP = { duration: 0.3, ease: "power2.out" } as const;
const ZOOM = { scale: 1.05, duration: 0.6, ease: "power2.out" } as const;

export type Teardown = () => void;
type Register = (fn: () => void) => void;

/**
 * Runs setup in a GSAP context. `dispose` stops writers and listeners before the revert; `after` restores once it is done.
 * Teardown runs once, attempts every step, and rolls back a setup that threw.
 */
function own(setup: (dispose: Register, after: Register) => void): Teardown {
  const ctx = gsap.context(() => {});
  const disposers: Array<() => void> = [];
  const restores: Array<() => void> = [];
  let done = false;
  const teardown = () => {
    if (done) return;
    done = true;
    let failure: unknown;
    const attempt = (fn: () => void) => {
      try {
        fn();
      } catch (error) {
        failure ??= error;
      }
    };
    disposers.splice(0).reverse().forEach(attempt);
    attempt(() => ctx.revert());
    restores.splice(0).reverse().forEach(attempt);
    if (failure) throw failure;
  };
  let failure: { error: unknown } | undefined;
  // Catch inside add: GSAP restores its current context only when add returns.
  ctx.add(() => {
    try {
      setup((fn) => disposers.push(fn), (fn) => restores.push(fn));
    } catch (error) {
      failure = { error };
    }
  });
  if (failure) {
    teardown();
    throw failure.error;
  }
  return teardown;
}

/** Inline properties these effects write. */
const MOTION_PROPS = ["transform", "translate", "rotate", "scale", "opacity", "visibility"];

/**
 * Records inline properties and returns a restore. Tweens started from a
 * listener are created outside the setup context, so kill them in a disposer
 * and restore after the context reverts. `clearProps` also resets GSAP's cache.
 */
function snapshotStyles(elements: HTMLElement[], props = MOTION_PROPS): () => void {
  const saved = elements.map((element) => props.map((prop) =>
    [element.style.getPropertyValue(prop), element.style.getPropertyPriority(prop)] as const));
  return () =>
    elements.forEach((element, i) => {
      gsap.set(element, { clearProps: props.filter((prop) => !prop.startsWith("--")).join(",") });
      props.forEach((prop, j) => {
        const [value, priority] = saved[i]?.[j] ?? ["", ""];
        if (value) element.style.setProperty(prop, value, priority);
        else element.style.removeProperty(prop);
      });
    });
}

/** Adds a listener and registers its removal. */
function listen<K extends keyof HTMLElementEventMap>(
  dispose: Register,
  target: HTMLElement,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void,
): void {
  target.addEventListener(type, handler as EventListener);
  dispose(() => target.removeEventListener(type, handler as EventListener));
}

type HotHandlers = { on: () => void; off: () => void };

/** Mouse hover and `:focus-visible` focus share one hot state: `on` when the first arrives, `off` when the last leaves. */
function hotState(dispose: Register, control: HTMLElement, { on, off }: HotHandlers): void {
  let hovered = false;
  let focused = false;
  let hot = false;
  const update = () => {
    const next = hovered || focused;
    if (next === hot) return;
    hot = next;
    (hot ? on : off)();
  };
  listen(dispose, control, "pointerenter", (event) => {
    if (event.pointerType !== "mouse") return;
    hovered = true;
    update();
  });
  listen(dispose, control, "pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    hovered = false;
    update();
  });
  listen(dispose, control, "focusin", (event) => {
    focused = (event.target as Element).matches(":focus-visible");
    update();
  });
  listen(dispose, control, "focusout", (event) => {
    // Focus moving between controls inside the target, such as a card's links, stays hot.
    if (control.contains(event.relatedTarget as Node | null)) return;
    focused = false;
    update();
  });
}
```

## textRoll

The label slides up and out while an `aria-hidden` copy rolls in from below. The original nodes move into a vertical clipping mask on the same baseline, so the accessible name and box are unchanged; the mask pads by the font's measured overhang, so a tight `line-height` cannot crop ascenders or descenders. Whole-label and single-line: a wrapping label rolls as one block, and a per-character roll would take on the [text stability](../text-stability.md) concerns.

```html
<a class="cta" href="/start">Start</a>
<!-- Mark the label when the control has other children, or the icon rolls too and flex gaps collapse. -->
<button class="cta"><svg aria-hidden="true">…</svg> <span data-roll-label>Play</span></button>
```

```css
/* Optional: the app may color the incoming label. */
.cta [data-roll-copy] { color: var(--accent); }
```

```ts
export type TextRollOptions = {
  /** The text to roll; defaults to `[data-roll-label]` inside the control, else the control itself. */
  label?: HTMLElement | null;
  duration?: number;
};

export function textRoll(control: HTMLElement, { label, duration = ROLL.duration }: TextRollOptions = {}): Teardown {
  if (prefersReducedMotion()) return () => {};
  return own((dispose, after) => {
    const target = label ?? control.querySelector<HTMLElement>("[data-roll-label]") ?? control;
    const mask = document.createElement("span");
    const line = document.createElement("span");
    const copy = document.createElement("span");
    const nodes = Array.from(target.childNodes);
    mask.dataset.rollMask = "";
    line.dataset.rollLine = "";
    copy.dataset.rollCopy = "";
    copy.setAttribute("aria-hidden", "true");
    // Both lines share one grid cell. Clip vertically only, so italics and glyph overhang keep their width.
    mask.style.cssText = "display:inline-grid;overflow:visible clip";
    line.style.gridArea = copy.style.gridArea = "1 / 1";
    copy.style.userSelect = "none";
    copy.append(...nodes.map((node) => node.cloneNode(true)));
    copy.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    target.insertBefore(mask, nodes[0] ?? null);
    line.append(...nodes);
    mask.append(line, copy);
    // The original nodes return to their place; the mask and copy leave with the effect.
    after(() => mask.replaceWith(...Array.from(line.childNodes)));
    dispose(() => gsap.killTweensOf([line, copy]));

    /** Pads the clip by the font's overhang past the line box and returns the travel, in percent of the line. */
    const clearance = () => {
      const ink = document.createRange();
      ink.selectNodeContents(line);
      const room = Math.max(0, (ink.getBoundingClientRect().height - line.getBoundingClientRect().height) / 2);
      mask.style.paddingBlock = `${room}px`;
      mask.style.marginBlock = `${-room}px`;
      return (100 * mask.getBoundingClientRect().height) / line.getBoundingClientRect().height;
    };
    gsap.set(copy, { yPercent: clearance() });
    const roll = (hot: boolean) => {
      // Measured per visit, so a font that finished loading after setup still gets its room.
      const travel = clearance();
      gsap.to(line, { yPercent: hot ? -travel : 0, duration, ease: ROLL.ease, overwrite: "auto" });
      gsap.to(copy, { yPercent: hot ? 0 : travel, duration, ease: ROLL.ease, overwrite: "auto" });
    };
    hotState(dispose, control, { on: () => roll(true), off: () => roll(false) });
  });
}
```

## underlineSweep

An injected `aria-hidden` line sweeps in from the inline start and out toward the inline end, by `scaleX` only; a re-entry mid-exit reverses. It defaults to 1px `currentColor` and reads `--underline-*` custom properties. The link's own `text-decoration` stays; the sweep sits at the bottom of the link's box. Single-line links only: a wrapped inline link has no single box to span. The link becomes `position: relative` only when static, and is restored.

```html
<a class="nav-link" href="/work">Work</a>
```

```css
/* Only when asked to replace the app's underline: remove it and let the sweep stand in. Keep underlines in reading text. */
.nav-link { text-decoration: none; }
/* Optional geometry and color. */
.nav-link { --underline-thickness: 2px; --underline-offset: -0.1em; --underline-color: var(--accent); }
```

```ts
export function underlineSweep(link: HTMLElement): Teardown {
  const reduced = prefersReducedMotion();
  return own((dispose, after) => {
    const line = document.createElement("span");
    line.dataset.underline = "";
    line.setAttribute("aria-hidden", "true");
    line.style.cssText =
      "position:absolute;left:0;right:0;bottom:var(--underline-offset,0);height:var(--underline-thickness,1px);" +
      "background:var(--underline-color,currentColor);pointer-events:none";
    after(snapshotStyles([link], ["position"]));
    if (getComputedStyle(link).position === "static") link.style.position = "relative";
    link.append(line);
    after(() => line.remove());
    dispose(() => gsap.killTweensOf(line));
    // Draw from the inline start and clear toward the inline end, so right-to-left text sweeps the other way.
    const rtl = getComputedStyle(link).direction === "rtl";
    const start = rtl ? "100% 50%" : "0% 50%";
    const end = rtl ? "0% 50%" : "100% 50%";
    gsap.set(line, { scaleX: 0, transformOrigin: start });

    const sweep = (hot: boolean) => {
      if (Number(gsap.getProperty(line, "scaleX")) === (hot ? 0 : 1)) {
        gsap.set(line, { transformOrigin: hot ? start : end });
      }
      gsap.to(line, { scaleX: hot ? 1 : 0, duration: reduced ? 0 : SWEEP.duration, ease: SWEEP.ease, overwrite: "auto" });
    };
    hotState(dispose, link, { on: () => sweep(true), off: () => sweep(false) });
  });
}
```

## imageZoom

The card's image scales up slightly while the card or its link is hot. Its parent frame clips it; the builder adds inline `overflow: clip` only when the frame is unclipped, and restores it. Give the image its own frame: clipping the card would clip focus rings inside it.

```html
<article class="card">
  <a href="/work/one">
    <span class="frame"><img src="…" alt="One"></span>
    <h3>One</h3>
  </a>
</article>
```

```css
.frame { display: block; overflow: hidden; }
/* Safari: add isolation: isolate when a rounded frame leaks the scaled image at its corners. */
```

```ts
export type ImageZoomOptions = {
  /** Defaults to `[data-zoom-image]` inside the card, else its first `img` or `video`. */
  image?: HTMLElement | null;
  scale?: number;
  duration?: number;
};

export function imageZoom(card: HTMLElement, { image, scale = ZOOM.scale, duration = ZOOM.duration }: ImageZoomOptions = {}): Teardown {
  if (prefersReducedMotion()) return () => {};
  return own((dispose, after) => {
    const media = image ?? card.querySelector<HTMLElement>("[data-zoom-image]") ?? card.querySelector<HTMLElement>("img, video");
    if (!media) return;
    const frame = media.parentElement;
    after(snapshotStyles([media]));
    if (frame && getComputedStyle(frame).overflow.includes("visible")) {
      after(snapshotStyles([frame], ["overflow"]));
      frame.style.overflow = "clip";
    }
    dispose(() => gsap.killTweensOf(media));
    hotState(dispose, card, {
      on: () => gsap.to(media, { scale, duration, ease: ZOOM.ease, overwrite: "auto" }),
      off: () => gsap.to(media, { scale: 1, duration, ease: ZOOM.ease, overwrite: "auto" }),
    });
  });
}
```

Keep `scale` small: attention, not a new crop.

## Wiring

```ts
// In the framework skill's controller at settled, once fonts are ready:
const stop: Teardown[] = [];
for (const cta of page.querySelectorAll<HTMLElement>("[data-hover='roll']")) stop.push(textRoll(cta));
for (const link of page.querySelectorAll<HTMLElement>("[data-hover='underline']")) stop.push(underlineSweep(link));
for (const card of page.querySelectorAll<HTMLElement>("[data-hover='zoom']")) stop.push(imageZoom(card));
// On unmount, and before an outro moves these targets:
// stop.forEach((fn) => fn());
```

## Controller contract

| Builder | Create | Returns | Reduced motion |
|---|---|---|---|
| `textRoll` | Settled, once the label's font is ready | teardown | No-op; markup untouched (an instant swap would show nothing) |
| `underlineSweep` | Settled | teardown | Line appears and clears at once, without moving: an affordance, kept |
| `imageZoom` | Settled, once the frame's layout is final | teardown | No-op |

- Do not combine these with `magnetic`, `tilt`, or a particle hot state on one target. A card may zoom its image while its link rolls a label: different boxes.
- Tear down before an outro moves the target or its label text or image changes; rebuild after new content renders.
- `textRoll` moves the label's nodes into its mask while active. Effects that need the original text, such as split entrances, run on that element only before it builds or after its teardown.
