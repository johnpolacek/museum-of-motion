# Recipe: print effects

Three effects that borrow from printmaking, for a handmade feel: an image or block painted on with a dry, broken brush edge, live text that inks in through grain, and a second impression that slips into register behind a heading. They keep the project's own content, colors, and fonts; the grain and the timing are the only additions.

Lifecycle: see the [controller contract](#controller-contract); the controller calls each `revert` on unmount. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`.

## How the paint works

A dry brush leaves paper showing through where the bristles skip. Each pixel gets a fixed threshold once, from coarse noise for the broad patches, fine noise for the gaps, and a gradient for the direction of the stroke. GSAP then tweens a single number, and every pixel whose threshold is below it fills in. Nothing random happens per frame, so a scrubbed or reversed reveal shows the same edge every time.

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

export type Teardown = () => void;
export type PrintEffect = { timeline: gsap.core.Timeline; revert: Teardown };
export type StrokeDirection = "right" | "down";

/** Per-pixel thresholds, 0 to 255: the order a dry brush covers the area in. Seeded, so the edge is stable. */
export function brushThresholds(width: number, height: number, direction: StrokeDirection = "right"): Uint8Array {
  const hash = (x: number, y: number) => {
    let n = Math.imul(x + 19, 374761393) + Math.imul(y + 37, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    return (hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx) * (1 - fy) + (hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx) * fy;
  };
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;
      // The stroke's direction, then broad patches, then fine grain to fill the gaps last.
      const lead = direction === "down" ? ny * 0.68 - 0.18 : nx * 0.5 + ny * 0.18;
      const value = lead + noise(nx * 7, ny * 9) * 0.19 + noise(nx * 43, ny * 51) * 0.12 + hash(x, y) * 0.13;
      out[y * width + x] = Math.max(0, Math.min(255, Math.round(value * 225)));
    }
  }
  return out;
}
```

## paintReveal

The target is painted onto the page: a cover in the page's paper color lies over it and wears away with a dry-brush edge. Give the target a positioned box; the cover is a canvas sized to it, at no more than about 1000 by 900 pixels, and scaled up, which softens the grain to a print's tooth. Pass `roller` to move an element, such as a brayer, across with the stroke.

```ts
export type PaintOptions = {
  /** The cover's color. Defaults to the target's computed background color, then the page's. */
  paper?: string;
  direction?: StrokeDirection;
  duration?: number;
  /** Moves across the target with the stroke's leading edge, then fades. */
  roller?: HTMLElement;
};

export function paintReveal(target: HTMLElement, { paper, direction = "right", duration = 2.4, roller }: PaintOptions = {}): PrintEffect {
  const timeline = gsap.timeline();
  if (prefersReducedMotion()) return { timeline, revert: () => timeline.kill() };
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "1" });
  const context = canvas.getContext("2d");
  if (!context) return { timeline, revert: () => timeline.kill() };
  const box = target.getBoundingClientRect();
  const ratio = Math.min(1, 1000 / Math.max(1, box.width), 900 / Math.max(1, box.height));
  const width = (canvas.width = Math.max(1, Math.round(box.width * ratio)));
  const height = (canvas.height = Math.max(1, Math.round(box.height * ratio)));
  const fill = paper ?? paperColor(target);
  context.fillStyle = fill;
  context.fillRect(0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const thresholds = brushThresholds(width, height, direction);
  let previous = -1;
  /** Erases the cover where the stroke has reached; 180 steps is finer than the eye can split. */
  const paint = (progress: number) => {
    const step = Math.round(progress * 180);
    if (step === previous) return;
    previous = step;
    for (let i = 0; i < thresholds.length; i++) {
      const ink = progress <= 0 ? 0 : progress >= 1 ? 255 : Math.max(0, Math.min(255, (progress * 280 - thresholds[i]!) * 18));
      pixels.data[i * 4 + 3] = 255 - ink;
    }
    context.putImageData(pixels, 0, 0);
  };
  paint(0);
  target.append(canvas);
  // A setter rather than onUpdate, so a scrubbed or seeked timeline paints too.
  let current = 0;
  const state = {
    get progress() {
      return current;
    },
    set progress(value: number) {
      current = value;
      paint(value);
    },
  };
  timeline.to(state, { progress: 1, duration, ease: "none" }, 0);
  if (roller) {
    const along = direction === "down" ? "y" : "x";
    const span = direction === "down" ? box.height : box.width;
    timeline
      // The roller leads the ink: the brush edge trails a little behind it, as ink trails a brayer.
      .fromTo(roller, { [along]: -span * 0.05, autoAlpha: 1 }, { [along]: span * 1.05, duration: duration * 0.6, ease: "none" }, 0)
      .to(roller, { autoAlpha: 0, duration: 0.3 }, duration * 0.6);
  }
  // Remove the cover once it is fully worn away, so nothing sits over the content at rest.
  timeline.call(() => canvas.remove(), [], duration);
  return {
    timeline,
    revert() {
      timeline.kill();
      canvas.remove();
      if (roller) gsap.set(roller, { clearProps: "transform,opacity,visibility" });
    },
  };
}

/** The first opaque background up the tree, else white. */
function paperColor(element: HTMLElement): string {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;
    if (color && color !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(color)) return color;
  }
  return "#fff";
}
```

To paint in two passes, as a print does with charcoal and then color, stack a second copy of the content above the first in a desaturated or single-ink version, paint the first in, then paint the second copy away with `paintReveal` on a cover in the first copy's color. Keep the copy `aria-hidden`.

## inkText

Live text inks in through grain: an SVG mask made from the same thresholds covers each target, and GSAP raises its alpha until every pixel is inked. The HTML is untouched: it stays selectable, readable to assistive technology, and in its own font and color.

```ts
let maskId = 0;

export type InkOptions = { duration?: number; stagger?: number; direction?: StrokeDirection };

export function inkText(targets: HTMLElement[], { duration = 0.9, stagger = 0.12, direction = "right" }: InkOptions = {}): PrintEffect {
  const timeline = gsap.timeline();
  if (prefersReducedMotion() || !targets.length) return { timeline, revert: () => timeline.kill() };
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) return { timeline, revert: () => timeline.kill() };
  const image = context.createImageData(canvas.width, canvas.height);
  brushThresholds(canvas.width, canvas.height, direction).forEach((value, i) => {
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = 255 - value;
    image.data[i * 4 + 3] = 255;
  });
  context.putImageData(image, 0, 0);
  const grain = canvas.toDataURL();
  const svg = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(svg, "svg");
  defs.setAttribute("aria-hidden", "true");
  Object.assign(defs.style, { position: "absolute", width: "0", height: "0", pointerEvents: "none" });
  document.body.append(defs);
  const saved = targets.map((target) => [target.style.getPropertyValue("mask-image"), target.style.getPropertyValue("-webkit-mask-image")] as const);
  const ramps = targets.map((target) => {
    const id = `ink-text-${++maskId}`;
    const mask = document.createElementNS(svg, "mask");
    mask.setAttribute("id", id);
    mask.setAttribute("maskUnits", "objectBoundingBox");
    mask.setAttribute("maskContentUnits", "objectBoundingBox");
    for (const [name, value] of [["x", "0"], ["y", "0"], ["width", "1"], ["height", "1"]]) mask.setAttribute(name, value);
    // Luminance becomes alpha, then a steep ramp turns the grain into a hard, broken edge that GSAP slides.
    mask.innerHTML = `<filter id="${id}-ink" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 0"/><feComponentTransfer><feFuncA type="linear" slope="18" intercept="-18"/></feComponentTransfer></filter><image width="1" height="1" preserveAspectRatio="none" href="${grain}" filter="url(#${id}-ink)"/>`;
    defs.append(mask);
    target.style.setProperty("mask-image", `url(#${id})`);
    target.style.setProperty("-webkit-mask-image", `url(#${id})`);
    return mask.querySelector("feFuncA")!;
  });
  ramps.forEach((ramp, i) => timeline.to(ramp, { attr: { intercept: 1 }, duration, ease: "none" }, i * stagger));
  // At rest the text needs no mask at all.
  timeline.call(() => restore(), [], ">");
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    defs.remove();
    targets.forEach((target, i) => {
      const [mask, webkit] = saved[i]!;
      if (mask) target.style.setProperty("mask-image", mask);
      else target.style.removeProperty("mask-image");
      if (webkit) target.style.setProperty("-webkit-mask-image", webkit);
      else target.style.removeProperty("-webkit-mask-image");
    });
  };
  return {
    timeline,
    revert() {
      timeline.kill();
      restore();
    },
  };
}
```

Masks follow each target's box, so ink a block of text as one target, or each line or heading on its own for a stagger. Before the timeline runs, a masked target is fully hidden; build it in the framework's initial state, or hide the targets with the pre-paint marker until it does.

## registrationSlip

A second impression in another ink lands out of register behind a heading, then snaps into place under it, as a misaligned plate is nudged true. The heading never moves. The impression is an `aria-hidden` copy that only transforms, and it is removed at rest.

```ts
export type SlipOptions = {
  /** The second impression's ink. Use a color already in the palette. */
  ink: string;
  /** Starting offset, in pixels. */
  x?: number;
  y?: number;
  duration?: number;
};

export function registrationSlip(heading: HTMLElement, { ink, x = 8, y = 3, duration = 0.5 }: SlipOptions): PrintEffect {
  const timeline = gsap.timeline();
  if (prefersReducedMotion()) return { timeline, revert: () => timeline.kill() };
  const copy = heading.cloneNode(true) as HTMLElement;
  copy.removeAttribute("id");
  copy.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
  copy.setAttribute("aria-hidden", "true");
  const box = heading.getBoundingClientRect();
  const parent = heading.offsetParent instanceof HTMLElement ? heading.offsetParent : document.body;
  const origin = parent.getBoundingClientRect();
  Object.assign(copy.style, {
    position: "absolute",
    left: `${box.left - origin.left + parent.scrollLeft}px`,
    top: `${box.top - origin.top + parent.scrollTop}px`,
    width: `${box.width}px`,
    margin: "0",
    color: ink,
    pointerEvents: "none",
    zIndex: "0",
  });
  const position = heading.style.position;
  const zIndex = heading.style.zIndex;
  // The heading sits above its impression.
  if (getComputedStyle(heading).position === "static") heading.style.position = "relative";
  heading.style.zIndex = "1";
  parent.append(copy);
  timeline
    .fromTo(copy, { x, y }, { x: x / 2, y: -y / 3, duration: duration * 0.5, ease: "power2.out" })
    .to(copy, { x: 0, y: 0, duration: duration * 0.3, ease: "back.out(3)" })
    .call(() => restore());
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    copy.remove();
    heading.style.position = position;
    heading.style.zIndex = zIndex;
  };
  return {
    timeline,
    revert() {
      timeline.kill();
      restore();
    },
  };
}
```

## Controller contract

| Builder | Phase | Returns | Reduced motion |
|---|---|---|---|
| `paintReveal` | Intro, once the target has its size | `{ timeline, revert }` | Empty timeline; content shows |
| `inkText` | Intro; targets hidden by the pre-paint marker until built | `{ timeline, revert }` | Empty timeline; text shows |
| `registrationSlip` | Intro, after the heading's font has loaded | `{ timeline, revert }` | Empty timeline; no copy |

- Each builder runs once and leaves nothing behind at rest: the cover, the masks, and the copy are removed when their timeline ends.
- `paintReveal` draws on the CPU, a few hundred thousand pixels per changed step. Keep it to one or two at a time, and to intros, not scroll scrubbing on long pages.
