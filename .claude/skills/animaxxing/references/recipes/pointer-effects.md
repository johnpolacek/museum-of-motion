# Recipe: pointer effects

Seven pointer effects: magnetic pull, 3D tilt, a cursor follower with an optional scrolling label, momentum hover, a proximity field, an image trail, and a drag-and-throw track. All but the drag track are mouse-only decoration that ignores touch and pen, so nothing sticks after a tap. The drag track works with mouse, touch, and keyboard.

Lifecycle: the framework controller builds these once the target is mounted and visible and calls the idempotent teardown on unmount. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`. `momentumHover` also needs `gsap/InertiaPlugin`; `dragTrack` needs `gsap/Draggable` and `gsap/InertiaPlugin`.

```ts
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";

gsap.registerPlugin(Draggable, InertiaPlugin);

/* Swap for the project's helper if it has one. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** True when the primary input can hover precisely. Events are still filtered per pointer. */
function finePointer(): boolean {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** Seconds a follower takes to catch the pointer. */
const FOLLOW = 0.45;
const FOLLOW_EASE = "power3.out";

export type Teardown = () => void;
type Register = (fn: () => void) => void;

/**
 * Runs setup in its own GSAP context and returns a once-only teardown that also rolls back a throw.
 * `dispose` stops writers and listeners before the context reverts; `after` restores after it.
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
 * Records inline properties and returns a restore. Reverting `quickTo` can leave its last
 * value inline, so restore after the context reverts. `clearProps` also resets GSAP's cache.
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
  target: HTMLElement | Document,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void,
): void {
  target.addEventListener(type, handler as EventListener);
  dispose(() => target.removeEventListener(type, handler as EventListener));
}
```

## magnetic

The target leans toward the mouse and settles back on leave. An optional `[data-magnetic-inner]` child travels further for depth.

```html
<a class="cta" href="/start"><span data-magnetic-inner>Start</span></a>
```

```ts
export type MagneticOptions = {
  /** Share of the pointer's offset from center the target follows. */
  strength?: number;
  /** Extra share for the inner element, relative to the target. */
  inner?: number;
};

export function magnetic(target: HTMLElement, { strength = 0.3, inner = 0.5 }: MagneticOptions = {}): Teardown {
  if (prefersReducedMotion() || !finePointer()) return () => {};
  return own((dispose, after) => {
    const label = target.querySelector<HTMLElement>("[data-magnetic-inner]");
    after(snapshotStyles(label ? [target, label] : [target]));
    const to = (el: HTMLElement, prop: "x" | "y") => gsap.quickTo(el, prop, { duration: FOLLOW, ease: FOLLOW_EASE });
    const xTo = to(target, "x");
    const yTo = to(target, "y");
    const innerX = label ? to(label, "x") : undefined;
    const innerY = label ? to(label, "y") : undefined;
    let center = { x: 0, y: 0 };

    listen(dispose, target, "pointerenter", (event) => {
      if (event.pointerType !== "mouse") return;
      // Measure once per visit; the target's own movement must not shift its center.
      const rect = target.getBoundingClientRect();
      const x = Number(gsap.getProperty(target, "x"));
      const y = Number(gsap.getProperty(target, "y"));
      center = { x: rect.left - x + rect.width / 2, y: rect.top - y + rect.height / 2 };
    });
    listen(dispose, target, "pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      const dx = (event.clientX - center.x) * strength;
      const dy = (event.clientY - center.y) * strength;
      xTo(dx);
      yTo(dy);
      innerX?.(dx * inner);
      innerY?.(dy * inner);
    });
    listen(dispose, target, "pointerleave", () => {
      xTo(0);
      yTo(0);
      innerX?.(0);
      innerY?.(0);
    });
  });
}
```

Keep `strength` low enough that the target stays under the pointer.

## tilt

A card tilts toward the mouse in 3D and exposes the pointer position as `--pointer-x` and `--pointer-y` (0% to 100%) for an app-drawn highlight.

```css
/* Optional highlight; the app picks the color. */
.card { background-image: radial-gradient(circle at var(--pointer-x, 50%) var(--pointer-y, 50%), rgb(255 255 255 / 0.12), transparent 40%); }
```

```ts
export type TiltOptions = { max?: number; perspective?: number };

export function tilt(card: HTMLElement, { max = 8, perspective = 800 }: TiltOptions = {}): Teardown {
  if (prefersReducedMotion() || !finePointer()) return () => {};
  return own((dispose, after) => {
    after(snapshotStyles([card], [...MOTION_PROPS, "--pointer-x", "--pointer-y"]));
    gsap.set(card, { transformPerspective: perspective });
    const rx = gsap.quickTo(card, "rotationX", { duration: FOLLOW, ease: FOLLOW_EASE });
    const ry = gsap.quickTo(card, "rotationY", { duration: FOLLOW, ease: FOLLOW_EASE });
    let rect = card.getBoundingClientRect();

    listen(dispose, card, "pointerenter", (event) => {
      if (event.pointerType === "mouse") rect = card.getBoundingClientRect();
    });
    listen(dispose, card, "pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      const px = gsap.utils.clamp(0, 1, (event.clientX - rect.left) / rect.width);
      const py = gsap.utils.clamp(0, 1, (event.clientY - rect.top) / rect.height);
      ry((px - 0.5) * 2 * max);
      rx((0.5 - py) * 2 * max);
      card.style.setProperty("--pointer-x", `${px * 100}%`);
      card.style.setProperty("--pointer-y", `${py * 100}%`);
    });
    listen(dispose, card, "pointerleave", () => {
      rx(0);
      ry(0);
      card.style.removeProperty("--pointer-x");
      card.style.removeProperty("--pointer-y");
    });
  });
}
```

Keep `max` small on cards with reading text.

## cursorFollower

An accent that trails the mouse beside the native cursor, never replacing it. It grows over `[data-cursor="grow"]`, disappears over `[data-cursor="hide"]` (such as text fields), and squashes on press. `data-cursor-state` on the follower mirrors the state for CSS.

With a `label` element, the follower also carries a small marquee: over `[data-cursor-text]`, the dot gives way to a pill scrolling that attribute's text, such as "View project". The label repeats the text twice and loops by one copy's width, the same technique as `marquee`. It only restates what the link already says, so it stays `aria-hidden`.

```html
<div class="cursor" aria-hidden="true"></div>
<div class="cursor-label" aria-hidden="true"><span data-cursor-label-track></span></div>
<a href="/work/atlas" data-cursor-text="View project">Atlas</a>
```

```css
.cursor {
  position: fixed; left: 0; top: 0; z-index: 50;
  width: 12px; height: 12px; border-radius: 50%;
  background: currentColor; pointer-events: none;
  visibility: hidden;
}
.cursor-label {
  position: fixed; left: 0; top: 0; z-index: 50;
  width: 9em; overflow: hidden; white-space: nowrap;
  padding: 0.4em 0; border-radius: 999px;
  background: currentColor; pointer-events: none;
  visibility: hidden;
}
.cursor-label [data-cursor-label-track] { display: inline-flex; color: Canvas; }
```

```ts
const CURSOR_SCALE: Record<string, number> = { grow: 3, hide: 0, label: 0 };

export type CursorFollowerOptions = {
  /** A pill that scrolls the hovered `[data-cursor-text]`; needs a `[data-cursor-label-track]` child. */
  label?: HTMLElement;
  /** Label scroll speed in px per second. */
  labelSpeed?: number;
};

export function cursorFollower(cursor: HTMLElement, { label, labelSpeed = 60 }: CursorFollowerOptions = {}): Teardown {
  if (prefersReducedMotion() || !finePointer()) return () => {};
  return own((dispose, after) => {
    after(snapshotStyles([cursor]));
    after(() => delete cursor.dataset.cursorState);
    const track = label?.querySelector<HTMLElement>("[data-cursor-label-track]");
    let labelX: gsap.QuickToFunc | undefined;
    let labelY: gsap.QuickToFunc | undefined;
    let scroll: gsap.core.Tween | undefined;
    let text = "";
    if (label && track) {
      after(snapshotStyles([label, track]));
      const original = Array.from(track.childNodes);
      after(() => track.replaceChildren(...original));
      dispose(() => scroll?.kill());
      gsap.set(label, { xPercent: -50, yPercent: -50, autoAlpha: 0 });
      labelX = gsap.quickTo(label, "x", { duration: FOLLOW * 0.5, ease: FOLLOW_EASE });
      labelY = gsap.quickTo(label, "y", { duration: FOLLOW * 0.5, ease: FOLLOW_EASE });
    }
    /** Shows the label scrolling `next`, or hides and pauses it for an empty string. */
    const showLabel = (next: string) => {
      if (!label || !track || next === text) return;
      text = next;
      if (!next) {
        // Pause this loop once hidden; a label shown meanwhile starts its own.
        const hiding = scroll;
        gsap.to(label, { autoAlpha: 0, scale: 0.6, duration: 0.2, ease: "power2.in", overwrite: "auto", onComplete: () => void hiding?.pause() });
        return;
      }
      // Two copies side by side; moving left by one copy's width loops seamlessly.
      const copy = () => {
        const span = document.createElement("span");
        span.textContent = `${next}\u00a0·\u00a0`;
        return span;
      };
      track.replaceChildren(copy(), copy());
      const width = (track.firstElementChild as HTMLElement).offsetWidth;
      scroll?.kill();
      scroll = gsap.fromTo(track, { x: 0 }, { x: -width, duration: width / labelSpeed, ease: "none", repeat: -1 });
      gsap.to(label, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "power2.out", overwrite: "auto" });
    };
    gsap.set(cursor, { xPercent: -50, yPercent: -50, autoAlpha: 0 });
    const xTo = gsap.quickTo(cursor, "x", { duration: FOLLOW * 0.5, ease: FOLLOW_EASE });
    const yTo = gsap.quickTo(cursor, "y", { duration: FOLLOW * 0.5, ease: FOLLOW_EASE });
    // quickTo takes one real property; "scale" is an alias, so drive both axes.
    const scaleXTo = gsap.quickTo(cursor, "scaleX", { duration: 0.3, ease: "power2.out" });
    const scaleYTo = gsap.quickTo(cursor, "scaleY", { duration: 0.3, ease: "power2.out" });
    const scaleTo = (value: number) => {
      scaleXTo(value);
      scaleYTo(value);
    };
    let visible = false;
    let state = "";
    let pressed = false;
    const scale = () => (CURSOR_SCALE[state] ?? 1) * (pressed ? 0.75 : 1);

    listen(dispose, document, "pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      const target = event.target as Element | null;
      const labelled = label ? target?.closest<HTMLElement>("[data-cursor-text]")?.dataset.cursorText ?? "" : "";
      const next = labelled ? "label" : target?.closest<HTMLElement>("[data-cursor]")?.dataset.cursor ?? "";
      if (!visible) {
        // Appear at the pointer, not sliding in from the corner.
        gsap.set(cursor, { x: event.clientX, y: event.clientY, autoAlpha: 1 });
        if (label) gsap.set(label, { x: event.clientX, y: event.clientY });
        visible = true;
      }
      xTo(event.clientX);
      yTo(event.clientY);
      labelX?.(event.clientX);
      labelY?.(event.clientY);
      showLabel(labelled);
      if (next !== state) {
        state = next;
        cursor.dataset.cursorState = state;
        scaleTo(scale());
      }
    });
    listen(dispose, document, "pointerdown", (event) => {
      if (event.pointerType !== "mouse") return;
      pressed = true;
      scaleTo(scale());
    });
    listen(dispose, document, "pointerup", () => {
      pressed = false;
      scaleTo(scale());
    });
    // Hide when the mouse leaves the window; it reappears at the pointer on return.
    listen(dispose, document.documentElement, "pointerleave", () => {
      visible = false;
      gsap.set(cursor, { autoAlpha: 0 });
      showLabel("");
    });
  });
}
```

## momentumHover

Items the mouse sweeps across get knocked along the pointer's path and spin by where they were struck, then settle back to rest. A slow pass barely moves them; a fast swipe scatters them. Suits stickers, badges, and icon clusters, never reading text or controls.

Each item is a still hit area; its `[data-momentum-target]` child is what moves. A target that moved itself would slide out from under the pointer and be struck again on the way back.

```html
<ul class="stickers">
  <li data-momentum-item><img data-momentum-target src="/sticker-1.png" alt="" /></li>
  <li data-momentum-item><img data-momentum-target src="/sticker-2.png" alt="" /></li>
</ul>
```

```ts
export type MomentumOptions = {
  /** Selects the hit areas inside the root. */
  items?: string;
  /** Share of pointer velocity (px/s) the target is thrown with. */
  carry?: number;
  /** Degrees per second of spin per px/s of pointer speed across the strike's lever arm. */
  spin?: number;
  /** Deceleration of the throw; higher settles sooner. */
  resistance?: number;
};

/** Caps a single throw in px/s and a spin in degrees/s. */
const MAX_THROW = 1080;
const MAX_SPIN = 60;
/** A pointer that has not moved for this long counts as still. */
const STILL_MS = 100;

export function momentumHover(
  root: HTMLElement,
  { items = "[data-momentum-item]", carry = 0.4, spin = 0.25, resistance = 160 }: MomentumOptions = {},
): Teardown {
  if (prefersReducedMotion() || !finePointer()) return () => {};
  return own((dispose, after) => {
    const hits = Array.from(root.querySelectorAll<HTMLElement>(items));
    const targets = hits.map((hit) => hit.querySelector<HTMLElement>("[data-momentum-target]") ?? hit);
    after(snapshotStyles(targets));
    dispose(() => gsap.killTweensOf(targets));
    const clampThrow = gsap.utils.clamp(-MAX_THROW, MAX_THROW);
    const clampSpin = gsap.utils.clamp(-MAX_SPIN, MAX_SPIN);
    let last: { x: number; y: number; t: number } | undefined;
    let vx = 0;
    let vy = 0;

    // Track on the document: an item at the root's edge is struck by the same move that enters the root.
    listen(dispose, document, "pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      if (last) {
        // Several events can land in one frame; floor the interval and blend to steady the reading.
        const dt = Math.max(event.timeStamp - last.t, 8) / 1000;
        vx = (vx + (event.clientX - last.x) / dt) / 2;
        vy = (vy + (event.clientY - last.y) / dt) / 2;
      }
      last = { x: event.clientX, y: event.clientY, t: event.timeStamp };
    });

    hits.forEach((hit, i) => {
      const target = targets[i]!;
      listen(dispose, hit, "pointerenter", (event) => {
        if (event.pointerType !== "mouse" || !last || event.timeStamp - last.t > STILL_MS) return;
        const rect = target.getBoundingClientRect();
        const ox = event.clientX - (rect.left + rect.width / 2);
        const oy = event.clientY - (rect.top + rect.height / 2);
        // Torque: a strike off center spins the target; dividing by the lever arm keeps spin tied to speed.
        const torque = (ox * vy - oy * vx) / (Math.hypot(ox, oy) || 1);
        gsap.to(target, {
          inertia: {
            x: { velocity: clampThrow(vx * carry), end: 0 },
            y: { velocity: clampThrow(vy * carry), end: 0 },
            rotation: { velocity: clampSpin(torque * spin), end: 0 },
            resistance,
          },
          overwrite: true,
        });
      });
    });
  });
}
```

Leave room around the items: a hard throw travels well past their boxes, so an `overflow: hidden` ancestor clips it.

## proximity

Items swell as the mouse nears them and settle as it moves away, each by its own distance from the pointer. A grid of thumbnails ripples under the cursor; with `axis: "x"`, a bottom origin, and `lift`, a row of icons behaves like the macOS dock. Distance maps to a 0–1 intensity through `falloff`, so neighbors grow a little and the nearest item grows most.

As with `momentumHover`, each item is a still hit area measured once; its `[data-proximity-target]` child is what scales. Without a child the item scales itself, which suits a centered origin and no `lift`. The root's CSS keeps room for the peak size, and the target's `transform-origin` sets the direction it grows.

```html
<nav class="dock">
  <a data-proximity-item href="/mail"><img data-proximity-target src="/mail.svg" alt="Mail" /></a>
  <a data-proximity-item href="/notes"><img data-proximity-target src="/notes.svg" alt="Notes" /></a>
</nav>
```

```css
.dock [data-proximity-target] { display: block; transform-origin: 50% 100%; }
```

```ts
export type ProximityOptions = {
  /** Selects the hit areas inside the root. */
  items?: string;
  /** Distance in px at which an item stops responding. */
  radius?: number;
  /** Scale at zero distance. */
  scale?: number;
  /** Px an item rises at zero distance. */
  lift?: number;
  /** Distance measured on both axes, or along one for a row or column. */
  axis?: "both" | "x" | "y";
  /** Shapes intensity from the radius edge (0) to the item's center (1). */
  falloff?: string;
  /** Seconds each item takes to catch its target size. */
  duration?: number;
};

export function proximity(
  root: HTMLElement,
  {
    items = "[data-proximity-item]",
    radius = 160,
    scale = 1.6,
    lift = 0,
    axis = "both",
    falloff = "sine.inOut",
    duration = 0.3,
  }: ProximityOptions = {},
): Teardown {
  if (prefersReducedMotion() || !finePointer()) return () => {};
  return own((dispose, after) => {
    const hits = Array.from(root.querySelectorAll<HTMLElement>(items));
    const targets = hits.map((hit) => hit.querySelector<HTMLElement>("[data-proximity-target]") ?? hit);
    after(snapshotStyles(targets));
    const shape = gsap.parseEase(falloff);
    const to = (target: HTMLElement, prop: string) => gsap.quickTo(target, prop, { duration, ease: FOLLOW_EASE });
    // quickTo drives one property; the `scale` shorthand needs both axes.
    const movers = targets.map((target) => {
      const sx = to(target, "scaleX");
      const sy = to(target, "scaleY");
      return {
        scale: (value: number) => {
          sx(value);
          sy(value);
        },
        y: lift ? to(target, "y") : undefined,
      };
    });
    /** Hit-area centers relative to the root. Hits never move, so these hold until layout changes. */
    let centers: Array<{ x: number; y: number }> = [];
    const measure = () => {
      const box = root.getBoundingClientRect();
      centers = hits.map((hit) => {
        const rect = hit.getBoundingClientRect();
        return { x: rect.left - box.left + rect.width / 2, y: rect.top - box.top + rect.height / 2 };
      });
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    dispose(() => resize.disconnect());

    let active = false;
    const rest = () => {
      if (!active) return;
      active = false;
      movers.forEach((mover) => {
        mover.scale(1);
        mover.y?.(0);
      });
    };
    // Track on the document: items at the root's edge answer a pointer still outside it.
    listen(dispose, document, "pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      // The root's box follows scrolling; the centers are relative to it.
      const box = root.getBoundingClientRect();
      const px = event.clientX - box.left;
      const py = event.clientY - box.top;
      if (px < -radius || py < -radius || px > box.width + radius || py > box.height + radius) return rest();
      active = true;
      movers.forEach((mover, i) => {
        const center = centers[i]!;
        const dx = axis === "y" ? 0 : px - center.x;
        const dy = axis === "x" ? 0 : py - center.y;
        const intensity = shape(gsap.utils.clamp(0, 1, 1 - Math.hypot(dx, dy) / radius));
        mover.scale(1 + (scale - 1) * intensity);
        mover.y?.(-lift * intensity);
      });
    });
    // Leaving the window sends no further move.
    listen(dispose, document, "pointerout", (event) => {
      if (event.pointerType === "mouse" && !event.relatedTarget) rest();
    });
  });
}
```

```ts
// Example: a dock along the bottom edge, and a thumbnail grid.
proximity(document.querySelector<HTMLElement>(".dock")!, { axis: "x", scale: 1.8, lift: 16, radius: 180 });
proximity(document.querySelector<HTMLElement>(".thumbs")!, { scale: 1.25, radius: 220 });
```

- Keep `scale` modest where items sit close together: an enlarged target that covers a neighbor takes that neighbor's clicks.
- The effect is decoration. Keyboard focus and touch get the app's own focus and pressed styles; nothing here gates a link.

## imageTrail

Images spill out along the mouse's path over an area: one appears each time the pointer travels `spacing` px, pops up, drifts a little with the pointer's motion, then shrinks away. Suits a hero or a work index. The images are decoration drawn from a hidden set in the markup, so they load with the page; each copy is `aria-hidden` with empty `alt`.

```html
<section class="hero" data-trail-area>
  <div class="trail-layer" aria-hidden="true"></div>
  <div hidden data-trail-images>
    <img src="/trail-1.jpg" alt="" /><img src="/trail-2.jpg" alt="" /><img src="/trail-3.jpg" alt="" />
  </div>
  …
</section>
```

```css
.hero { position: relative; }
.trail-layer { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.trail-layer img { position: absolute; left: 0; top: 0; width: 180px; }
```

```ts
export type ImageTrailOptions = {
  /** Pointer travel in px between images. */
  spacing?: number;
  /** Seconds an image lives. */
  life?: number;
  /** Images alive at once; the oldest goes when a new one needs room. */
  max?: number;
  /** Share of the pointer's last movement each image drifts along. */
  drift?: number;
};

export function imageTrail(
  area: HTMLElement,
  layer: HTMLElement,
  images: HTMLImageElement[],
  { spacing = 80, life = 0.9, max = 10, drift = 0.6 }: ImageTrailOptions = {},
): Teardown {
  if (prefersReducedMotion() || !finePointer() || !images.length) return () => {};
  return own((dispose) => {
    const live: Array<{ image: HTMLImageElement; tl: gsap.core.Timeline }> = [];
    const drop = (entry: { image: HTMLImageElement; tl: gsap.core.Timeline }) => {
      entry.tl.kill();
      entry.image.remove();
      const i = live.indexOf(entry);
      if (i >= 0) live.splice(i, 1);
    };
    dispose(() => live.slice().forEach(drop));
    let next = 0;
    let last: { x: number; y: number } | undefined;
    let travelled = 0;

    const spawn = (x: number, y: number, dx: number, dy: number) => {
      if (live.length >= max) drop(live[0]!);
      const image = images[next]!.cloneNode(true) as HTMLImageElement;
      next = (next + 1) % images.length;
      image.removeAttribute("id");
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      layer.append(image);
      const entry = { image, tl: gsap.timeline() };
      entry.tl
        .set(image, { x, y, xPercent: -50, yPercent: -50, scale: 0.6, rotation: gsap.utils.random(-8, 8), autoAlpha: 1 })
        .to(image, { scale: 1, duration: 0.35, ease: "back.out(2)" }, 0)
        .to(image, { x: x + dx * drift, y: y + dy * drift, duration: life, ease: "power2.out" }, 0)
        .to(image, { scale: 0, autoAlpha: 0, duration: 0.35, ease: "power2.in" }, life - 0.35)
        .call(() => drop(entry));
      live.push(entry);
    };

    listen(dispose, area, "pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      const box = layer.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      if (!last) {
        last = { x, y };
        return;
      }
      const dx = x - last.x;
      const dy = y - last.y;
      travelled += Math.hypot(dx, dy);
      last = { x, y };
      if (travelled < spacing) return;
      travelled = 0;
      spawn(x, y, dx * 4, dy * 4);
    });
    listen(dispose, area, "pointerleave", () => {
      last = undefined;
      travelled = 0;
    });
  });
}
```

One trail per page, and never over reading text: the images cover whatever is under them. Let the trail finish on leave; teardown removes every image at once.

## dragTrack

A row to drag sideways and throw, snapping to the nearest item. The static CSS is a native horizontal scroller, the fallback without JavaScript. Dragging a link does not follow it; a click does. Touch drags claim only horizontal movement, so vertical swipes still scroll. Keyboard focus slides an item into view.

```html
<div class="drag-viewport"><div class="drag-track">…items…</div></div>
```

```css
.drag-viewport { overflow-x: auto; }
.drag-track { display: flex; width: max-content; }
```

```ts
export type DragTrackOptions = { snap?: boolean };
export type DragTrack = { revert: Teardown; draggable: Draggable | undefined };

export function dragTrack(viewport: HTMLElement, track: HTMLElement, { snap = true }: DragTrackOptions = {}): DragTrack {
  const reduced = prefersReducedMotion();
  let draggable: Draggable | undefined;
  const revert = own((dispose, after) => {
    // Draggable writes its own inline styles for touch and selection.
    after(snapshotStyles([track], [...MOTION_PROPS, "touch-action", "user-select", "cursor"]));
    viewport.scrollLeft = 0;
    gsap.set(viewport, { overflow: "hidden" });
    const items = Array.from(track.children) as HTMLElement[];
    const minX = () => Math.min(0, viewport.clientWidth - track.scrollWidth);
    const clampX = (x: number) => gsap.utils.clamp(minX(), 0, x);
    const stops = () => items.map((item) => clampX(-item.offsetLeft));
    const nearest = (x: number) => gsap.utils.snap(stops(), x);
    // Draggable applies `snap` only through a throw, so without inertia the release lands on the nearest item here.
    const land = () => {
      if (!draggable) return;
      gsap.set(track, { x: nearest(draggable.x) });
      draggable.update();
    };

    [draggable] = Draggable.create(track, {
      type: "x",
      bounds: { minX: minX(), maxX: 0 },
      inertia: !reduced,
      edgeResistance: 0.85,
      dragClickables: true,
      zIndexBoost: false,
      snap: snap ? { x: nearest } : undefined,
      onDragEnd: reduced && snap ? land : undefined,
    });
    const drag = draggable;
    dispose(() => drag.kill());
    // Stops a throw still in flight and the velocity tracker, both of which kill() leaves running.
    dispose(() => {
      gsap.killTweensOf(track);
      InertiaPlugin.untrack(track);
    });
    // Links and images start a native drag that swallows the gesture.
    listen(dispose, track, "dragstart", (event) => event.preventDefault());
    // Focus scrolls the clipped viewport natively; the track's transform does that job.
    listen(dispose, viewport, "scroll", () => {
      viewport.scrollLeft = 0;
    });

    const resize = new ResizeObserver(() => {
      drag.applyBounds({ minX: minX(), maxX: 0 });
      gsap.set(track, { x: clampX(Number(gsap.getProperty(track, "x"))) });
      drag.update();
    });
    resize.observe(viewport);
    resize.observe(track);
    dispose(() => resize.disconnect());

    let slide: gsap.core.Tween | undefined;
    dispose(() => slide?.kill());
    listen(dispose, track, "focusin", (event) => {
      // Pressing a link focuses it too; only keyboard focus should slide the track.
      if (!(event.target as Element).matches(":focus-visible")) return;
      const item = items.find((candidate) => candidate.contains(event.target as Node));
      if (!item) return;
      const x = clampX(-(item.offsetLeft - (viewport.clientWidth - item.offsetWidth) / 2));
      slide?.kill();
      slide = gsap.to(track, { x, duration: reduced ? 0 : 0.4, ease: "power3.out", onUpdate: () => drag.update() });
    });
  });
  return { revert, draggable };
}
```

## Controller contract

| Builder | Create | Returns | Coarse pointer or reduced motion |
|---|---|---|---|
| `magnetic`, `tilt` | Settled, once the target's layout is final | teardown | No-op |
| `cursorFollower` | Once per document, from the persistent shell | teardown | No-op; follower stays hidden |
| `momentumHover` | Settled, once the items are laid out | teardown | No-op; items stay at rest |
| `proximity` | Settled, once the items are laid out; rebuild when items are added or removed | teardown | No-op; items stay at rest |
| `imageTrail` | Settled, once the trail images have loaded | teardown | No-op; nothing spawns |
| `dragTrack` | Settled, once item widths are final | `{ revert, draggable }` | Drag and snap still work; reduced motion drops the throw |

- Stop magnetic, tilt, momentum hover, and proximity before an outro moves the same target.
- One pointer response per control: not `magnetic` or `tilt` plus a particle hot state.
- The fine-pointer check runs at build; per-event `pointerType` filtering covers hybrid devices.
- Revert the drag track before its items change; rebuild after they render.
