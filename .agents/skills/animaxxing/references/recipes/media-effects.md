# Recipe: media effects

Image wipe reveals, a mouse-following hover preview, scroll-scrubbed video, and canvas frame sequences, on the app's own markup and styling.

Lifecycle: the framework controller creates these once the target is measurable, composes `imageReveal`'s timeline, and calls teardown on unmount. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`, `gsap/ScrollTrigger`.

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

/** True when the primary input can hover precisely. Events are still filtered per pointer. */
function finePointer(): boolean {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** Seconds a reveal takes to open. */
const REVEAL = 1;
/** Scale a revealed image settles from. */
const SETTLE_FROM = 1.15;
/** Where a scroll reveal fires: the frame's top crosses this line of the viewport. */
const REVEAL_START = "top 85%";
/** Seconds the preview takes to catch the pointer, and to crossfade. */
const FOLLOW = 0.35;
const SWAP = 0.25;
/** Seconds a scrubbed playhead takes to catch up with the scrollbar. `true` locks it. */
const SCRUB = 0.5;
/** Sequence frames loading at once. */
const CONCURRENCY = 4;
/** Cap on device pixel ratio for the sequence canvas; 3x bitmaps cost too much for the sharpness they add. */
const MAX_DPR = 2;

export type Teardown = () => void;
export type Scroller = Element | string | undefined;
type Register = (fn: () => void) => void;

/**
 * Runs setup in its own GSAP context. `dispose` registers stops that run before
 * the context reverts; `after` registers restores that run after it. Teardown
 * runs once, attempts every step, and rolls back a setup that threw.
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
const MOTION_PROPS = ["transform", "translate", "rotate", "scale", "opacity", "visibility", "clip-path"];

/**
 * Records inline properties and returns a restore. `quickTo` retargets its
 * tween on every call, so reverting it can leave the last value inline;
 * restore after the context reverts. `clearProps` also resets GSAP's cache.
 */
function snapshotStyles(elements: HTMLElement[], props = MOTION_PROPS): () => void {
  const saved = elements.map((element) => props.map((prop) =>
    [element.style.getPropertyValue(prop), element.style.getPropertyPriority(prop)] as const));
  return () =>
    elements.forEach((element, i) => {
      gsap.set(element, { clearProps: props.join(",") });
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
```

## imageReveal

A wipe opens the frame while the image settles from a slight zoom. The wipe is a `clip-path` on the frame (any element wrapping the image), so its radius and layout box stay as styled. `direction` is the way the wipe's edge travels. The timeline plays at once for the controller to compose; `onScroll` holds it closed until the frame enters the viewport. A waiting frame is clipped, never hidden, so its image stays in the accessibility tree; focus inside it opens it at once.

```html
<figure class="frame"><img src="…" alt="…" /></figure>
```

```css
.frame { margin: 0; } .frame img { display: block; width: 100%; height: auto; }
```

```ts
export type RevealDirection = "up" | "down" | "left" | "right";
export type ImageRevealOptions = {
  direction?: RevealDirection;
  duration?: number;
  /** Scale the image settles from. */
  from?: number;
  /** Seconds before an immediate reveal starts. The scroll variant starts on entry. */
  delay?: number;
  onComplete?: () => void;
  /** Reveal once when the frame enters the viewport instead of playing at once. */
  onScroll?: boolean | { start?: string; scroller?: Scroller };
};
export type ImageReveal = { timeline: gsap.core.Timeline; revert: Teardown };

const OPEN = "inset(0% 0% 0% 0%)";
/** The closed inset for each travel direction: the whole box is inset from the edge the wipe starts at. */
const CLOSED: Record<RevealDirection, string> = {
  up: "inset(100% 0% 0% 0%)",
  down: "inset(0% 0% 100% 0%)",
  left: "inset(0% 0% 0% 100%)",
  right: "inset(0% 100% 0% 0%)",
};

export function imageReveal(
  frame: HTMLElement,
  { direction = "up", duration = REVEAL, from = SETTLE_FROM, delay = 0, onComplete, onScroll = false }: ImageRevealOptions = {},
): ImageReveal {
  // An <img> inside <picture>, not the <picture>: transforms do not apply to its inline box.
  const inner = frame.querySelector<HTMLElement>("[data-reveal-inner], img, video");
  const scroll = onScroll ? (onScroll === true ? {} : onScroll) : undefined;
  const reduced = prefersReducedMotion();
  let timeline!: gsap.core.Timeline;
  const revert = own((dispose, after) => {
    const restore = snapshotStyles(inner ? [frame, inner] : [frame]);
    after(restore);
    timeline = gsap.timeline({
      paused: !!scroll,
      delay: scroll ? 0 : delay,
      defaults: { overwrite: "auto" },
      // Settled: the open inset. Restoring leaves nothing inline, so another owner can take the frame.
      onComplete: () => {
        restore();
        onComplete?.();
      },
    });
    if (reduced) {
      timeline.set(frame, { clipPath: OPEN });
    } else {
      gsap.set(frame, { clipPath: CLOSED[direction] });
      timeline.to(frame, { clipPath: OPEN, duration, ease: "power3.inOut" }, 0);
      if (inner) {
        gsap.set(inner, { scale: from });
        timeline.to(inner, { scale: 1, duration: duration * 1.2, ease: "power2.out" }, 0);
      }
    }
    if (!scroll) return;
    let played = false;
    const play = () => {
      if (played) return;
      played = true;
      timeline.play();
    };
    ScrollTrigger.create({ trigger: frame, start: scroll.start ?? REVEAL_START, scroller: scroll.scroller, once: true, onEnter: play });
    // Focus can reach a linked image before it crosses the line; a focused frame is never clipped shut.
    listen(dispose, frame, "focusin", play);
  });
  return { timeline, revert };
}
```

A frame can carry a brand shape, such as a logo outline or a torn edge, with a CSS mask. The mask and the wipe's `clip-path` combine, so the image opens inside the shape. Keep the shape as its own SVG file:

```css
.frame--shaped {
  -webkit-mask: url("/shapes/frame.svg") center / contain no-repeat;
  mask: url("/shapes/frame.svg") center / contain no-repeat;
}
```

A shaped frame's `alt` text still describes the image, never the shape.

## hoverPreview

List items carry an image URL in `data-preview`. One floating image follows the mouse over the list, crossfades between items, and hides on leave. The app supplies the empty floating element and styles its size, radius, and shadow; the builder adds and removes two `<img>` crossfade layers. Mouse only: touch and pen never show it, and items stay ordinary links.

```html
<ul class="works">
  <li><a href="/work/one" data-preview="/previews/one.jpg">One</a></li>
</ul>
<div class="preview" aria-hidden="true"></div>
```

```css
.preview {
  position: fixed; left: 0; top: 0; z-index: 40;
  width: 240px; aspect-ratio: 4 / 3; overflow: hidden;
  pointer-events: none; visibility: hidden;
}
```

```ts
export type HoverPreviewOptions = {
  /** Offset of the preview's top-left corner from the pointer, px. */
  offset?: { x: number; y: number };
};

export function hoverPreview(list: HTMLElement, preview: HTMLElement, { offset = { x: 24, y: 24 } }: HoverPreviewOptions = {}): Teardown {
  if (prefersReducedMotion() || !finePointer()) return () => {};
  return own((dispose, after) => {
    after(snapshotStyles([preview]));
    const hadAria = preview.getAttribute("aria-hidden");
    preview.setAttribute("aria-hidden", "true");
    after(() => (hadAria === null ? preview.removeAttribute("aria-hidden") : preview.setAttribute("aria-hidden", hadAria)));
    // Two stacked layers so a swap can crossfade. Both belong to the effect and leave with it.
    const layers = [0, 1].map(() => {
      const img = document.createElement("img");
      img.alt = "";
      img.decoding = "async";
      Object.assign(img.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: "0" });
      preview.append(img);
      return img;
    });
    after(() => layers.forEach((img) => img.remove()));
    dispose(() => gsap.killTweensOf([preview, ...layers]));
    gsap.set(preview, { autoAlpha: 0 });
    const xTo = gsap.quickTo(preview, "x", { duration: FOLLOW, ease: "power3.out" });
    const yTo = gsap.quickTo(preview, "y", { duration: FOLLOW, ease: "power3.out" });
    let live = true;
    dispose(() => (live = false));
    let front = 0;
    let current: string | undefined;
    let shown = false;

    const show = (src: string) => {
      if (src === current) return;
      current = src;
      const incoming = layers[1 - front];
      const outgoing = layers[front];
      front = 1 - front;
      const swap = () => {
        // A later hover may have replaced this source while it loaded.
        if (!live || current !== src) return;
        gsap.to(incoming, { opacity: 1, duration: SWAP, overwrite: "auto" });
        gsap.to(outgoing, { opacity: 0, duration: SWAP, overwrite: "auto" });
      };
      // A source that fails to load hides the preview rather than showing the last item's image, and can be retried.
      const fail = () => {
        if (!live || current !== src) return;
        current = undefined;
        gsap.to(layers, { opacity: 0, duration: SWAP, overwrite: "auto" });
      };
      incoming.src = src;
      if (incoming.complete && incoming.naturalWidth) swap();
      else {
        incoming.addEventListener("load", swap, { once: true });
        incoming.addEventListener("error", fail, { once: true });
      }
    };

    listen(dispose, list, "pointerover", (event) => {
      if (event.pointerType !== "mouse") return;
      const item = (event.target as Element | null)?.closest<HTMLElement>("[data-preview]");
      const src = item && list.contains(item) ? item.dataset.preview : undefined;
      if (!src) return;
      if (!shown) {
        // Appear at the pointer, not sliding in from where it last hid.
        shown = true;
        // quickTo's second argument also moves its start, so the next move does not fly in from the old spot.
        xTo(event.clientX + offset.x, event.clientX + offset.x);
        yTo(event.clientY + offset.y, event.clientY + offset.y);
        gsap.to(preview, { autoAlpha: 1, duration: SWAP, overwrite: "auto" });
      }
      show(src);
    });
    listen(dispose, list, "pointermove", (event) => {
      if (event.pointerType !== "mouse" || !shown) return;
      xTo(event.clientX + offset.x);
      yTo(event.clientY + offset.y);
    });
    listen(dispose, list, "pointerleave", () => {
      shown = false;
      gsap.to(preview, { autoAlpha: 0, duration: SWAP, overwrite: "auto" });
    });
  });
}
```

Images load on first hover; `<link rel="preload" as="image">` the few whose first swap must be instant. The preview never flips at the viewport edge, so keep it small.

## scrubVideo

A muted inline video whose `currentTime` follows the scroll through its tall section, in both directions. Scrubbing waits for metadata. Encode a keyframe on every frame (or at least every half second) so seeks never stall, keep clips short, and give the element a `poster`.

```html
<section class="scrub"><video muted playsinline preload="metadata" poster="…" src="…"></video></section>
```

```css
.scrub { height: 300vh; } .scrub video { position: sticky; top: 0; display: block; width: 100%; height: 100vh; object-fit: cover; }
```

```ts
export type ScrubVideoOptions = {
  /** The scroll extent; defaults to the video's parent. */
  section?: HTMLElement;
  start?: string;
  end?: string;
  scrub?: number | boolean;
  scroller?: Scroller;
};

export function scrubVideo(
  video: HTMLVideoElement,
  { section = video.parentElement ?? video, start = "top top", end = "bottom bottom", scrub = SCRUB, scroller }: ScrubVideoOptions = {},
): Teardown {
  if (prefersReducedMotion()) return () => {};
  return own((dispose, after) => {
    const was = { muted: video.muted, playsInline: video.playsInline };
    after(() => Object.assign(video, was));
    // Scrubbing needs a muted, inline, paused element; autoplay policies never apply.
    video.muted = true;
    video.playsInline = true;
    video.pause();
    const playhead = { time: 0 };
    let tween: gsap.core.Tween | undefined;
    // Metadata may arrive after setup, outside the context, so the tween and its trigger are stopped here.
    dispose(() => {
      tween?.scrollTrigger?.kill();
      tween?.kill();
    });
    const ready = () => {
      if (tween || !Number.isFinite(video.duration) || video.duration <= 0) return;
      tween = gsap.to(playhead, {
        time: video.duration,
        ease: "none",
        onUpdate: () => (video.currentTime = playhead.time),
        scrollTrigger: { trigger: section, start, end, scrub, scroller },
      });
    };
    if (video.readyState >= 1) ready();
    else listen(dispose, video, "loadedmetadata", ready);
  });
}
```

The poster and static layout are the no-script state; the recipe never plays the video. A live stream (infinite duration) builds nothing.

## frameSequence

An image sequence drawn to a canvas and scrubbed by scroll: the sharpness of stills without decoder stalls. Frames load coarse to fine, so a partly loaded sequence scrubs end to end; the canvas draws the nearest loaded frame, skipping failures. It sizes to its CSS box and `devicePixelRatio`.

Budget: `concurrency` requests in flight, starting one viewport before the section arrives. Loaded frames stay encoded for the section's life (the browser decodes on draw), so memory tracks total file size: 100–200 frames, 1600 px or less, WebP or AVIF, a few MB in all. Teardown aborts in-flight requests. Give the canvas `role="img"` and an `aria-label`, or `aria-hidden="true"` beside text that describes it.

```html
<section class="sequence"><canvas role="img" aria-label="…"></canvas></section>
```

```css
.sequence { height: 300vh; } .sequence canvas { position: sticky; top: 0; display: block; width: 100%; height: 100vh; }
```

```ts
export type FrameSequenceOptions = {
  /** The scroll extent; defaults to the canvas's parent. */
  section?: HTMLElement;
  start?: string;
  end?: string;
  scrub?: number | boolean;
  scroller?: Scroller;
  /** How a frame fills the canvas. */
  fit?: "cover" | "contain";
  /** Frames loading at once. */
  concurrency?: number;
  /** The one frame drawn under reduced motion. */
  still?: number;
};

/** Frame indexes coarse to fine: the ends, then halves, quarters, and so on. */
function coarseToFine(count: number): number[] {
  const order = count > 1 ? [0, count - 1] : [0];
  const seen = new Set(order);
  for (let stride = Math.floor(count / 2); stride >= 1; stride = Math.floor(stride / 2)) {
    for (let i = stride; i < count; i += stride) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
  }
  return order;
}

export function frameSequence(
  canvas: HTMLCanvasElement,
  frames: string[],
  {
    section = canvas.parentElement ?? canvas,
    start = "top top",
    end = "bottom bottom",
    scrub = SCRUB,
    scroller,
    fit = "cover",
    concurrency = CONCURRENCY,
    still = 0,
  }: FrameSequenceOptions = {},
): Teardown {
  const reduced = prefersReducedMotion();
  return own((dispose, after) => {
    const context = canvas.getContext("2d");
    if (!context || !frames.length) throw new Error("frameSequence needs a 2D canvas and at least one frame");
    // The bitmap size is written to the width/height attributes; restoring them also clears the drawing.
    const saved = { width: canvas.getAttribute("width"), height: canvas.getAttribute("height") };
    after(() =>
      (["width", "height"] as const).forEach((name) => {
        const value = saved[name];
        if (value === null) canvas.removeAttribute(name);
        else canvas.setAttribute(name, value);
      }),
    );
    const loaded: Array<HTMLImageElement | undefined> = new Array(frames.length);
    let live = true;
    dispose(() => (live = false));
    let wanted = reduced ? gsap.utils.clamp(0, frames.length - 1, Math.round(still)) : 0;
    let drawn = -1;

    const nearest = (index: number) => {
      for (let d = 0; d < frames.length; d++) {
        if (loaded[index - d]) return index - d;
        if (loaded[index + d]) return index + d;
      }
      return -1;
    };
    const paint = (force = false) => {
      const index = nearest(wanted);
      const image = loaded[index];
      if (!image || (index === drawn && !force)) return;
      drawn = index;
      const { width, height } = canvas;
      const scale = (fit === "cover" ? Math.max : Math.min)(width / image.naturalWidth, height / image.naturalHeight);
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      paint(true);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    dispose(() => observer.disconnect());

    const queue = reduced ? [wanted] : coarseToFine(frames.length);
    const inflight = new Set<HTMLImageElement>();
    // An emptied src aborts a request still in flight.
    dispose(() => inflight.forEach((image) => (image.src = "")));
    const load = () => {
      while (live && inflight.size < concurrency && queue.length) {
        const index = queue.shift() as number;
        const image = new Image();
        image.decoding = "async";
        const settle = (ok: boolean) => {
          inflight.delete(image);
          if (!live) return;
          if (ok) {
            loaded[index] = image;
            paint();
          }
          load();
        };
        image.onload = () => settle(true);
        image.onerror = () => settle(false);
        inflight.add(image);
        image.src = frames[index];
      }
    };
    if (reduced) {
      load();
      return;
    }
    // Loading begins one viewport before the section arrives, not at page load.
    ScrollTrigger.create({ trigger: section, start: "top 200%", once: true, scroller, onEnter: load });
    const playhead = { frame: 0 };
    gsap.to(playhead, {
      frame: frames.length - 1,
      ease: "none",
      onUpdate: () => {
        wanted = Math.round(playhead.frame);
        paint();
      },
      scrollTrigger: { trigger: section, start, end, scrub, scroller },
    });
  });
}
```

## Wiring

```ts
// Example: a hero frame composed into the intro; the controller owns the parent and calls revert at unmount.
const hero = imageReveal(frame, { direction: "right" });
intro.add(hero.timeline, 0.2);

// Example: frames revealed as the reader reaches them, and a sequence from numbered files.
const gallery = frames.map((frame) => imageReveal(frame, { onScroll: true }));
const sequence = frameSequence(canvas, Array.from({ length: 120 }, (_, i) => `/turn/frame-${String(i).padStart(3, "0")}.webp`));
```

## Controller contract

| Builder | Create | Returns | Reduced motion |
|---|---|---|---|
| `imageReveal` | Intro frames at initial state, composed into the intro; `onScroll` frames at settled | `{ timeline, revert }` | Nothing clipped or scaled; timeline completes (on entry for `onScroll`) and fires `onComplete` |
| `hoverPreview` | Settled | teardown | No-op, as on coarse pointers |
| `scrubVideo` | Settled, once the section is measurable | teardown | No-op; poster stays |
| `frameSequence` | Settled, once the canvas has its CSS size | teardown | Draws only the `still` frame; no trigger |

- Keep `imageReveal` frames out of route intro targets; stop magnetic or tilt on the same element before the reveal runs.
- After killing a composed parent, call the reveal's `revert`, then rebuild for a new visit.
- Create video and sequence triggers in document order; refresh ScrollTrigger after fonts or media above them change layout.
- `hoverPreview` reads the fine-pointer check at build; rebuild when input changes.
