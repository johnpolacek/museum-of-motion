# Recipe: doorways

Three moves built on one shape, an arch: a picture that opens from a point into an arch and then grows out of it to fill its frame, a scrolled passage through a doorway into the next picture, and a picture that flies from a card into an arch, turning from a rectangle into the arch on the way. They suit galleries, rooms, and anything with a threshold. Only `clip-path` and transforms move.

Lifecycle: see the [controller contract](#controller-contract); the controller calls each `revert` on unmount. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`, `gsap/ScrollTrigger`.

## The arch

An arch here stands on its foot: straight sides and a round top as wide as the arch. Every move draws it as a `path()` clip in the element's own pixels, from one number. At 0 it is a point at the door's foot. At about a third it is the door itself. At 1 it has grown past every edge of the element, its round top above the element, so every corner is inside. Its foot reaches the floor early, so no hard edge shows above the floor as it grows.

```ts
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* Swap for the project's helper if it has one. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type Teardown = () => void;
export type DoorwayEffect = { timeline: gsap.core.Timeline; revert: Teardown };
/** A box as fractions, 0 to 1, of an element's width and height. */
export type Door = { left: number; top: number; right: number; bottom: number };
type Box = { l: number; t: number; r: number; b: number };

/** The share of the arch's travel that draws the door itself, before it grows past the element. */
export const DOOR_SHARE = 0.32;
/** A tall door, centered, standing near the floor. */
const DOOR: Door = { left: 0.34, top: 0.24, right: 0.66, bottom: 0.94 };

/** Rounded to a tenth. Never `toFixed`: "533.0px" is a string GSAP will not interpolate. */
const tenth = (v: number) => Math.round(v * 10) / 10;

/** An arch filling a box, as a `path()` clip in pixels. A box shorter than half its width gets a flattened top. */
export function archPath({ l, t, r, b }: Box): string {
  const rx = Math.max(0, (r - l) / 2);
  const ry = Math.min(rx, Math.max(0, b - t));
  const spring = t + ry;
  return `path('M ${tenth(l)} ${tenth(b)} L ${tenth(l)} ${tenth(spring)} A ${tenth(rx)} ${tenth(ry)} 0 0 1 ${tenth(r)} ${tenth(spring)} L ${tenth(r)} ${tenth(b)} Z')`;
}

/** The door in an element's pixels. */
function doorIn(element: HTMLElement, door: Door): Box {
  const w = element.clientWidth;
  const h = element.clientHeight;
  return { l: door.left * w, t: door.top * h, r: door.right * w, b: door.bottom * h };
}

/** The arch at `q`: a point at the door's foot at 0, the door at DOOR_SHARE, past every edge of the element at 1. */
export function archAt(element: HTMLElement, door: Door, q: number): Box {
  const box = doorIn(element, door);
  const mix = (a: number, b: number, k: number) => a + (b - a) * k;
  if (q <= DOOR_SHARE) {
    const k = q / DOOR_SHARE;
    const middle = (box.l + box.r) / 2;
    return { l: mix(middle, box.l, k), t: mix(box.b, box.t, k), r: mix(middle, box.r, k), b: box.b };
  }
  const w = element.clientWidth;
  const h = element.clientHeight;
  // Wider than the element by a little, and its round top wholly above it.
  const radius = w / 2 + 2;
  const cover = { l: -2, t: -radius - 2, r: w + 2, b: h + 2 };
  const k = (q - DOOR_SHARE) / (1 - DOOR_SHARE);
  // The foot reaches the floor in the first third of the growth.
  const foot = Math.min(1, k / 0.35);
  return { l: mix(box.l, cover.l, k), t: mix(box.t, cover.t, k), r: mix(box.r, cover.r, k), b: mix(box.b, cover.b, foot) };
}

/**
 * An arch as a `polygon()` in percentages, for a frame shaped in CSS that a flight can land in. `ratio` is
 * the frame's width over its height, so the top is a true half circle. Every arch with the same `points`
 * has the same number of vertices, which is what lets one shape tween into another.
 */
export function archPolygon(ratio: number, points = 28): string {
  const ry = Math.min(100, 50 * ratio);
  const out: string[] = [];
  for (let i = 0; i <= points; i++) {
    const a = Math.PI - (Math.PI * i) / points;
    out.push(`${tenth(50 + 50 * Math.cos(a))}% ${tenth(ry - ry * Math.sin(a))}%`);
  }
  out.push("100% 100%", "0% 100%");
  return `polygon(${out.join(", ")})`;
}
```

## archReveal

The frame opens out of an arch: a point at the door's foot draws the arch open, then the picture grows out of it to fill the frame, while what is inside settles from a slight zoom. With `out`, it closes back into the arch and down to the point. The arch is redrawn from the frame's size on every step, so a resize mid-reveal keeps its shape.

```ts
export type ArchRevealOptions = {
  /** Where the arch stands, as fractions of the frame. */
  door?: Door;
  duration?: number;
  /** Close back into the arch instead of opening. */
  out?: boolean;
  /** The inner element's starting scale while opening. */
  from?: number;
};

export function archReveal(frame: HTMLElement, { door = DOOR, duration = 1.6, out = false, from = 1.08 }: ArchRevealOptions = {}): DoorwayEffect {
  const timeline = gsap.timeline();
  const inner = frame.querySelector<HTMLElement>("[data-reveal-inner], img, video");
  const saved = frame.style.clipPath;
  const restore = () => {
    frame.style.clipPath = saved;
    if (inner) gsap.set(inner, { clearProps: "transform,scale" });
  };
  if (prefersReducedMotion()) {
    // Opening: the frame is simply there. Closing: it is simply gone, until reverted.
    if (out) timeline.set(frame, { clipPath: "inset(50%)" });
    return { timeline, revert: () => (timeline.kill(), restore()) };
  }
  let q = out ? 1 : 0;
  // A setter, so a scrubbed or seeked timeline redraws the arch too.
  const state = {
    get q() {
      return q;
    },
    set q(value: number) {
      q = value;
      frame.style.clipPath = archPath(archAt(frame, door, value));
    },
  };
  state.q = q;
  if (out) {
    timeline
      .to(state, { q: DOOR_SHARE, duration: duration * 0.4, ease: "power2.in" }, 0)
      .to(state, { q: 0, duration: duration * 0.2, ease: "power2.in" }, duration * 0.4);
  } else {
    timeline
      .to(state, { q: DOOR_SHARE, duration: duration * 0.4, ease: "power3.out" }, 0)
      // The arch holds a beat as a door before the picture grows out of it.
      .to(state, { q: 1, duration: duration * 0.65, ease: "power3.inOut" }, duration * 0.42);
    if (inner) timeline.fromTo(inner, { scale: from, transformOrigin: "50% 100%" }, { scale: 1, duration: duration * 1.05, ease: "power2.out" }, 0);
    // Opened, nothing clips the frame at rest.
    timeline.call(restore, [], duration * 1.07);
  }
  return { timeline, revert: () => (timeline.kill(), restore()) };
}
```

## doorwayPassage

A scroll walks through a door. `stage` shows a picture with a doorway in it, and `next`, a layer over it, holds the picture beyond. As the trigger scrolls past, the doorway brightens, a mask shaped like it grows until it covers the stage, and the next picture resolves inside at its own scale: only the mask grows, never the picture. Scroll drives it, so stopping holds the frame and scrolling back retraces it.

Pin the stage with `position: sticky` inside a tall track and pass the track as `trigger`, so the page scrolls the passage while the stage holds still. `glow`, if given, is placed over the door and lights it as the passage begins. Style its look, such as a soft light gradient, and leave its box to the recipe.

```ts
export type DoorwayPassageOptions = {
  /** The doorway in the stage's picture, as fractions of the stage. */
  door: Door;
  /** Lights the door as the passage begins. Placed over the door by the recipe. */
  glow?: HTMLElement;
  /** Element whose scroll range walks the passage. Defaults to the stage. */
  trigger?: Element;
  scroller?: Element | Window;
  start?: string;
  end?: string;
  /** Seconds the passage takes to catch the scroll; true locks it to the scroll. */
  scrub?: number | boolean;
};

export function doorwayPassage(
  stage: HTMLElement,
  next: HTMLElement,
  { door, glow, trigger, scroller, start = "top top", end = "bottom bottom", scrub = true }: DoorwayPassageOptions,
): DoorwayEffect {
  const reduced = prefersReducedMotion();
  const saved = next.style.clipPath;
  let q = DOOR_SHARE;
  const state = {
    get q() {
      return q;
    },
    set q(value: number) {
      q = value;
      next.style.clipPath = archPath(archAt(stage, door, value));
    },
  };
  /** The glow's box over the door, from the stage's current size. Set, never tweened. */
  const place = () => {
    if (!glow) return;
    const box = doorIn(stage, door);
    Object.assign(glow.style, { left: `${box.l}px`, top: `${box.t}px`, width: `${box.r - box.l}px`, height: `${box.b - box.t}px` });
  };
  const timeline = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: trigger ?? stage,
      scroller,
      start,
      end,
      scrub,
      invalidateOnRefresh: true,
      // Sizes change with the layout: the mask and the glow are measured again on every refresh.
      onRefresh: () => {
        place();
        if (!reduced) state.q = q;
      },
    },
  });
  if (reduced) {
    // No growing shape: the next picture fades in over the scroll.
    timeline.fromTo(next, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 });
  } else {
    place();
    state.q = DOOR_SHARE;
    if (glow) timeline.fromTo(glow, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, 0).to(glow, { autoAlpha: 0, duration: 0.25 }, 0.15);
    timeline
      .fromTo(next, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.15)
      .fromTo(state, { q: DOOR_SHARE }, { q: 1, duration: 0.7, ease: "power1.inOut" }, 0.15)
      // The last stretch holds the next picture whole.
      .to({}, { duration: 0.15 }, 0.85);
  }
  return {
    timeline,
    revert() {
      timeline.scrollTrigger?.kill();
      timeline.kill();
      next.style.clipPath = saved;
      gsap.set(next, { clearProps: "opacity,visibility" });
      if (glow) {
        gsap.set(glow, { clearProps: "opacity,visibility" });
        for (const name of ["left", "top", "width", "height"]) glow.style.removeProperty(name);
      }
    },
  };
}
```

## shapeFlight

A picture flies from one frame to another and changes shape on the way: from a card's rectangle into an arch, or from the arch back into the card. The trick is to give both shapes the same points. The arch is a polygon, and the rectangle is that same polygon with each point pressed onto the nearest edge of its box, so one tweens straight into the other.

The flight is a copy, decorative and above the page, removed when it lands. Only its clip and the picture's transform move: the copy covers both frames from the start, its clip cuts out where the picture is, and the picture inside is scaled and moved from the first frame's crop to the second's. Neither frame changes size, and the picture is never stretched. Both frames are hidden while it flies and shown again when it lands.

Shape the arch frame with `archPolygon` in CSS or inline, as a polygon in percentages. A frame clipped some other way, or not at all, flies as a rectangle.

```ts
export type ShapeFlightOptions = {
  duration?: number;
  ease?: string;
  /** Where the copy flies. Defaults to the body; it is fixed to the viewport. */
  layer?: HTMLElement;
};

type Point = [number, number];

/** A frame's polygon clip as points in percentages, or null when it has none. */
function polygonOf(frame: HTMLElement): Point[] | null {
  const clip = getComputedStyle(frame).clipPath;
  if (!clip.startsWith("polygon(")) return null;
  const box = frame.getBoundingClientRect();
  const points: Point[] = [];
  for (const [, x, xu, y, yu] of clip.matchAll(/(-?[\d.]+)(%|px) (-?[\d.]+)(%|px)/g)) {
    points.push([xu === "%" ? Number(x) : (Number(x) / box.width) * 100, yu === "%" ? Number(y) : (Number(y) / box.height) * 100]);
  }
  return points.length > 2 ? points : null;
}

/** Each point pressed onto the nearest edge of its box: the same polygon, as a rectangle. */
export function pressToEdges(points: Point[]): Point[] {
  return points.map(([x, y]) => (Math.min(x, 100 - x) < Math.min(y, 100 - y) ? [x < 50 ? 0 : 100, y] : [x, y < 50 ? 0 : 100]));
}

export function shapeFlight(source: HTMLElement, target: HTMLElement, { duration = 0.7, ease = "power2.inOut", layer = document.body }: ShapeFlightOptions = {}): DoorwayEffect {
  const timeline = gsap.timeline();
  const image = source.querySelector<HTMLImageElement>("img");
  if (prefersReducedMotion() || !image) return { timeline, revert: () => timeline.kill() };
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  // The shape comes from whichever frame has one; the other gets the same points on its edges.
  const landing = polygonOf(target);
  const leaving = polygonOf(source);
  const shape = landing ?? leaving ?? [[0, 0], [100, 0], [100, 100], [0, 100]];
  const fromPoints = landing ? pressToEdges(shape) : shape;
  const toPoints = landing ? shape : pressToEdges(shape);
  // The copy covers both frames; points are written in its own pixels.
  const all = { l: Math.min(from.left, to.left), t: Math.min(from.top, to.top), r: Math.max(from.right, to.right), b: Math.max(from.bottom, to.bottom) };
  const polygon = (points: Point[], box: DOMRect) =>
    `polygon(${points.map(([x, y]) => `${tenth(box.left - all.l + (x / 100) * box.width)}px ${tenth(box.top - all.t + (y / 100) * box.height)}px`).join(", ")})`;

  const copy = document.createElement("div");
  copy.setAttribute("aria-hidden", "true");
  Object.assign(copy.style, {
    position: "fixed", left: `${all.l}px`, top: `${all.t}px`, width: `${all.r - all.l}px`, height: `${all.b - all.t}px`,
    pointerEvents: "none", zIndex: "1000",
  });
  // The picture at its natural shape, covering the landing frame and centered on it: the crop
  // object-fit: cover gives there. Scaled and moved, it gives the leaving frame's crop as well.
  const ratio = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : to.width / to.height;
  const cover = (box: DOMRect) => Math.max(box.width, box.height * ratio);
  const width = cover(to);
  const picture = image.cloneNode() as HTMLImageElement;
  picture.removeAttribute("id");
  picture.alt = "";
  Object.assign(picture.style, {
    position: "absolute", maxWidth: "none", objectFit: "fill", margin: "0",
    width: `${width}px`, height: `${width / ratio}px`,
    left: `${to.left - all.l + (to.width - width) / 2}px`, top: `${to.top - all.t + (to.height - width / ratio) / 2}px`,
  });
  copy.append(picture);
  layer.append(copy);

  const shown = [source.style.visibility, target.style.visibility];
  source.style.visibility = target.style.visibility = "hidden";
  let done = false;
  const land = () => {
    if (done) return;
    done = true;
    copy.remove();
    [source.style.visibility, target.style.visibility] = shown;
  };
  timeline
    .fromTo(copy, { clipPath: polygon(fromPoints, from) }, { clipPath: polygon(toPoints, to), duration, ease }, 0)
    .fromTo(
      picture,
      {
        x: from.left + from.width / 2 - (to.left + to.width / 2),
        y: from.top + from.height / 2 - (to.top + to.height / 2),
        scale: cover(from) / width,
        transformOrigin: "50% 50%",
      },
      { x: 0, y: 0, scale: 1, duration, ease },
      0,
    )
    .call(land, [], duration);
  return { timeline, revert: () => (timeline.kill(), land()) };
}
```

A flight reads the frames once, as it starts: start it after the landing frame has its final size and place. Its own image may still be loading, so give the landing frame its picture before the flight, and the copy uses the leaving frame's, already decoded.

## Wiring

```ts
// Example: a hero opens out of its arch, a tall track walks through a door, and a card's picture flies into the arch.
const opened = archReveal(document.querySelector<HTMLElement>("#hero-frame")!);
const passage = doorwayPassage(document.querySelector<HTMLElement>("#room")!, document.querySelector<HTMLElement>("#room-next")!, {
  door: { left: 0.42, top: 0.3, right: 0.58, bottom: 0.78 },
  glow: document.querySelector<HTMLElement>("#door-glow")!,
  trigger: document.querySelector("#room-track")!,
});
const arch = document.querySelector<HTMLElement>("#arch")!;
arch.style.clipPath = archPolygon(arch.offsetWidth / arch.offsetHeight);
let flight: DoorwayEffect | undefined;
for (const card of document.querySelectorAll<HTMLElement>(".card")) {
  card.addEventListener("click", () => {
    flight?.revert();
    arch.querySelector("img")!.src = card.querySelector("img")!.src;
    flight = shapeFlight(card.querySelector<HTMLElement>(".card-frame")!, arch);
  });
}
// On unmount:
flight?.revert();
passage.revert();
opened.revert();
```

## Controller contract

| Builder | Phase | Returns | Reduced motion |
|---|---|---|---|
| `archReveal` | Intro, once the frame has its size; `out` for an outro | `{ timeline, revert }` | Opening: empty timeline. Closing: hidden at once |
| `doorwayPassage` | Settled, once the stage has its size | `{ timeline, revert }` | The next picture fades in over the scroll; no shape |
| `shapeFlight` | On a request, after the landing frame has its size and picture | `{ timeline, revert }` | Empty timeline; no copy |

- `archReveal` and `shapeFlight` leave nothing behind at rest: the clip is restored and the copy removed when their timeline ends. A closed `archReveal` stays clipped until reverted.
- `doorwayPassage` holds its clip while it lives, and its revert restores the layer and the glow.
- Each redraws one clip per frame: cheap, and fine for scrubbing.
