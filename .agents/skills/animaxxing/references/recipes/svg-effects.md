# Recipe: SVG effects

Six SVG effects on the project's own SVG, keeping its strokes and fills: strokes that draw in and out, an icon morph, a shape that flows through a sequence of shapes, a mark that follows a path, a shape that morphs with scroll, and text that rides a path.

Lifecycle: see the [controller contract](#controller-contract); the controller calls each `revert` on unmount. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`, `gsap/DrawSVGPlugin`, `gsap/MorphSVGPlugin`, `gsap/MotionPathPlugin`. Register only the ones used. `morphScrub` and `pathScrub` also need `gsap/ScrollTrigger`.

```ts
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(DrawSVGPlugin, MorphSVGPlugin, MotionPathPlugin);

/* Swap for the project's helper if it has one. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type Teardown = () => void;
export type SvgEffect = { timeline: gsap.core.Timeline; revert: Teardown };
type Register = (fn: () => void) => void;

/**
 * Runs setup in its own GSAP context and returns a once-only teardown that also rolls back a throw.
 * `dispose` stops writers before the context reverts; `after` restores after it.
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

/** Records attributes and inline properties, and returns a restore for after the revert. */
function snapshot(elements: Element[], attributes: string[], props: string[]): () => void {
  const saved = elements.map((element) => ({
    attributes: attributes.map((name) => element.getAttribute(name)),
    props: props.map((prop) => [(element as SVGElement).style.getPropertyValue(prop), (element as SVGElement).style.getPropertyPriority(prop)] as const),
  }));
  return () =>
    elements.forEach((element, i) => {
      const record = saved[i];
      if (!record) return;
      if (props.length) gsap.set(element, { clearProps: props.join(",") });
      attributes.forEach((name, j) => {
        const value = record.attributes[j];
        if (value === null || value === undefined) element.removeAttribute(name);
        else element.setAttribute(name, value);
      });
      props.forEach((prop, j) => {
        const [value, priority] = record.props[j] ?? ["", ""];
        if (value) (element as SVGElement).style.setProperty(prop, value, priority);
        else (element as SVGElement).style.removeProperty(prop);
      });
    });
}

const STROKE_PROPS = ["stroke-dasharray", "stroke-dashoffset", "visibility", "opacity"];
```

## drawIn and drawOut

Strokes draw along their length in document order. Needs a visible stroke on `path`, `line`, `polyline`, `polygon`, `rect`, `circle`, or `ellipse`; filled shapes need a stroke or outline.

```ts
export type DrawOptions = { duration?: number; stagger?: number; delay?: number; onComplete?: () => void };

function draw(
  targets: gsap.DOMTarget,
  from: string,
  to: string,
  ease: string,
  { duration = 0.8, stagger = 0.12, delay = 0, onComplete }: DrawOptions,
): SvgEffect {
  const strokes = gsap.utils.toArray<SVGGeometryElement>(targets);
  const timeline = gsap.timeline({ delay, paused: true, defaults: { overwrite: "auto" } });
  if (onComplete) timeline.eventCallback("onComplete", onComplete);
  const revert = own((dispose, after) => {
    after(snapshot(strokes, [], STROKE_PROPS));
    dispose(() => timeline.kill());
    if (prefersReducedMotion()) {
      timeline.set(strokes, { drawSVG: to });
    } else {
      timeline.fromTo(strokes, { drawSVG: from }, { drawSVG: to, duration, stagger, ease });
    }
    // Render the start now, so the controller's pre-paint hiding can be released without a flash.
    timeline.progress(0).play();
  });
  return { timeline, revert };
}

/** Strokes draw from nothing to whole. Reduced motion shows them whole at once. */
export function drawIn(targets: gsap.DOMTarget, options: DrawOptions = {}): SvgEffect {
  return draw(targets, "0%", "100%", "power2.inOut", options);
}

/** Strokes retract toward their end. Reduced motion removes them at once. */
export function drawOut(targets: gsap.DOMTarget, options: DrawOptions = {}): SvgEffect {
  return draw(targets, "0% 100%", "100% 100%", "power2.in", options);
}
```

## morphToggle

An icon path morphs between its own shape and an alternate, such as menu to close. `set()` follows the control's state; the control keeps its label and `aria-pressed` or `aria-expanded`.

```html
<button aria-expanded="false" aria-label="Menu">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path id="menu-icon" d="M4 7h16M4 12h16M4 17h16" /></svg>
</button>
<svg hidden><path id="close-icon" d="M6 6l12 12M18 6L6 18" /></svg>
```

```ts
export type MorphToggle = { set: (alternate: boolean) => void; revert: Teardown };

export function morphToggle(
  path: SVGPathElement,
  alternate: SVGPathElement | string,
  { duration = 0.35, ease = "power2.inOut" }: { duration?: number; ease?: string } = {},
): MorphToggle {
  let tween: gsap.core.Tween | undefined;
  let showing = false;
  let active = true;
  const original = path.getAttribute("d") ?? "";
  const revert = own((dispose, after) => {
    after(snapshot([path], ["d"], []));
    dispose(() => {
      active = false;
      tween?.kill();
    });
  });
  const set = (next: boolean) => {
    if (!active || next === showing) return;
    showing = next;
    tween?.kill();
    const shape = next ? alternate : original;
    tween = gsap.to(path, { morphSVG: { shape }, duration: prefersReducedMotion() ? 0 : duration, ease });
  };
  return { set, revert };
}
```

To avoid twisting, draw both shapes with the same segment count and starting corner.

## morphSequence

A path flows through several shapes in order, resting on each, such as a blob that becomes a star, then a logo, then a heart. With `loop` it ends back on its own shape, so the controller can repeat it seamlessly. The timeline starts paused: the controller plays, repeats, or scrubs it.

```html
<svg viewBox="0 0 200 200" aria-hidden="true"><path id="shape" d="M100 30C140 30 170 60 170 100S140 170 100 170 30 140 30 100 60 30 100 30Z" /></svg>
<svg hidden>
  <path id="star" d="…" />
  <path id="heart" d="…" />
</svg>
```

```ts
export type MorphSequenceOptions = {
  /** Seconds each morph takes. */
  duration?: number;
  /** Seconds the shape rests before the next morph. */
  hold?: number;
  ease?: string;
  /** End back on the path's own shape. */
  loop?: boolean;
};

export function morphSequence(
  path: SVGPathElement,
  shapes: Array<SVGPathElement | string>,
  { duration = 0.9, hold = 0.6, ease = "power2.inOut", loop = true }: MorphSequenceOptions = {},
): SvgEffect {
  // Reduced motion keeps the authored shape: an empty timeline, so the controller's calls still work.
  let timeline = gsap.timeline({ paused: true });
  if (prefersReducedMotion()) return { timeline, revert: () => timeline.kill() };
  const revert = own((dispose, after) => {
    after(snapshot([path], ["d"], []));
    timeline = gsap.timeline({ paused: true });
    const stops = loop ? [...shapes, path.getAttribute("d") ?? ""] : shapes;
    stops.forEach((shape, i) => timeline.to(path, { morphSVG: { shape }, duration, ease }, i === 0 ? 0 : `+=${hold}`));
    if (loop) timeline.to({}, { duration: hold });
    dispose(() => timeline.kill());
  });
  return { timeline, revert };
}
```

A sequence that repeats for more than five seconds is ambient: give it the framework's pause control. Keep the segment rules from `morphToggle`; shapes with very different point counts twist mid-morph.

## morphScrub

A path morphs toward an alternate shape as the page scrolls, such as a curved section edge that flattens while its section arrives. Scroll position drives the shape both ways. Also needs `gsap/ScrollTrigger`.

```html
<section class="bowl">
  <svg class="bowl-edge" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
    <path id="edge-curve" d="M0 10 C30 0 70 0 100 10 Z" />
  </svg>
  …
</section>
<svg hidden><path id="edge-flat" d="M0 10 C30 10 70 10 100 10 Z" /></svg>
```

```css
.bowl { position: relative; }
.bowl-edge { position: absolute; left: 0; bottom: 100%; width: 100%; height: 6vw; fill: currentColor; }
```

```ts
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export type MorphScrubOptions = {
  /** The element whose pass through the viewport drives the morph; defaults to the path's `svg`. */
  trigger?: Element;
  start?: string;
  end?: string;
  scrub?: number | boolean;
  scroller?: Element | string;
};

export function morphScrub(
  path: SVGPathElement,
  alternate: SVGPathElement | string,
  { trigger, start = "top bottom", end = "top top", scrub = true, scroller }: MorphScrubOptions = {},
): Teardown {
  // Reduced motion keeps the authored shape; the morph is decoration.
  if (prefersReducedMotion()) return () => {};
  return own((_dispose, after) => {
    after(snapshot([path], ["d"], []));
    gsap.to(path, {
      morphSVG: { shape: alternate },
      ease: "none",
      scrollTrigger: { trigger: trigger ?? path.ownerSVGElement ?? path, start, end, scrub, scroller },
    });
  });
}
```

Match fills: the edge takes the section's own background token, so the curve reads as the section's top. Keep the segment rules from `morphToggle`.

## followPath

A small mark loops along a path, such as a dot along a route. Ambient: one per surface.

```ts
export type FollowOptions = {
  /** Seconds per lap. */
  duration?: number;
  /** Turn the mark to face its direction of travel. */
  autoRotate?: boolean;
};
export type Follower = { pause: () => void; play: () => void; revert: Teardown };

export function followPath(
  mark: SVGGraphicsElement | HTMLElement,
  path: SVGPathElement,
  { duration = 6, autoRotate = false }: FollowOptions = {},
): Follower {
  if (prefersReducedMotion()) return { pause: () => {}, play: () => {}, revert: () => {} };
  let tween: gsap.core.Tween | undefined;
  const revert = own((_dispose, after) => {
    after(snapshot([mark], ["transform"], ["transform", "translate", "rotate", "scale", "transform-origin"]));
    tween = gsap.to(mark, {
      motionPath: { path, align: path, alignOrigin: [0.5, 0.5], autoRotate },
      duration,
      ease: "none",
      repeat: -1,
    });
  });
  return { pause: () => tween?.pause(), play: () => tween?.play(), revert };
}
```

The controller pauses it off screen. The endless loop needs a user pause (WCAG 2.2.2): wire the page's control to `pause()` and `play()`.

## Text on a path

A line of text rides an SVG path. `pathScrub` slides it along an open curve as the page scrolls, both ways, so it rests whenever scrolling stops. `pathLoop` turns it around a closed path, such as a circular badge; it is ambient. Both move the `textPath`'s `startOffset` and nothing else. The text stays real SVG text, read by assistive technology and selectable. Also needs `gsap/ScrollTrigger` for `pathScrub`.

```html
<svg viewBox="0 0 600 200" class="path-line">
  <path id="line-curve" d="M20 160 C160 20 440 20 580 160" fill="none" />
  <text><textPath href="#line-curve" startOffset="0%">Every way a page can move</textPath></text>
</svg>

<!-- A badge: the circle is drawn twice in one path, so a loop of one lap is seamless. Keep the text under one lap. -->
<svg viewBox="0 0 200 200" class="path-badge">
  <path id="badge-ring" d="M100 20 a80 80 0 1 1 0 160 a80 80 0 1 1 0 -160 a80 80 0 1 1 0 160 a80 80 0 1 1 0 -160" fill="none" />
  <text><textPath href="#badge-ring">Museum of Motion · Every way ·</textPath></text>
</svg>
```

```ts
export type PathScrubOptions = {
  /** `startOffset` in percent when the trigger enters, and when it leaves. */
  from?: number;
  to?: number;
  /** The element whose pass drives the slide; defaults to the text's `svg`. */
  trigger?: Element;
  start?: string;
  end?: string;
  scrub?: number | boolean;
  scroller?: Element | string;
};

/** Slides text along its path with scroll. Reduced motion places it at `to`. */
export function pathScrub(
  textPath: SVGTextPathElement,
  { from = 100, to = 0, trigger, start = "top bottom", end = "center center", scrub = 0.6, scroller }: PathScrubOptions = {},
): Teardown {
  return own((_dispose, after) => {
    after(snapshot([textPath], ["startOffset"], []));
    if (prefersReducedMotion()) {
      textPath.setAttribute("startOffset", `${to}%`);
      return;
    }
    gsap.fromTo(
      textPath,
      { attr: { startOffset: `${from}%` } },
      {
        attr: { startOffset: `${to}%` },
        ease: "none",
        scrollTrigger: { trigger: trigger ?? textPath.ownerSVGElement ?? textPath, start, end, scrub, scroller },
      },
    );
  });
}

export type PathLoopOptions = {
  /** Seconds per lap. */
  duration?: number;
  /** 1 runs along the path's direction, -1 against it. */
  direction?: 1 | -1;
};

/** Turns text around a closed path drawn as two laps. Ambient; pauses off screen. */
export function pathLoop(textPath: SVGTextPathElement, { duration = 16, direction = 1 }: PathLoopOptions = {}): Follower {
  if (prefersReducedMotion()) return { pause: () => {}, play: () => {}, revert: () => {} };
  let tween: gsap.core.Tween | undefined;
  let paused = false;
  let visible = true;
  const sync = () => (paused || !visible ? tween?.pause() : tween?.play());
  const revert = own((dispose, after) => {
    after(snapshot([textPath], ["startOffset"], []));
    // Half the two-lap path is one lap, so 0% and 50% look the same.
    const [a, b] = direction > 0 ? [0, 50] : [50, 0];
    tween = gsap.fromTo(textPath, { attr: { startOffset: `${a}%` } }, { attr: { startOffset: `${b}%` }, duration, ease: "none", repeat: -1 });
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      sync();
    });
    seen.observe(textPath.ownerSVGElement ?? textPath);
    dispose(() => seen.disconnect());
  });
  return {
    pause: () => {
      paused = true;
      sync();
    },
    play: () => {
      paused = false;
      sync();
    },
    revert,
  };
}
```

Set the text's size and `letter-spacing` so it fits: text past the path's end is not drawn. Give the scrub's `end` a point where the line should rest, such as `center center`. The loop runs past five seconds, so wire `pause` and `play` to a visible control.

## Controller contract

| Builder | Phase | Returns | Reduced motion |
|---|---|---|---|
| `drawIn` | Intro; strokes hidden by the pre-paint mechanism until built | `{ timeline, revert }` | Whole at once, completion fires |
| `drawOut` | Outro | `{ timeline, revert }` | Removed at once, completion fires |
| `morphToggle` | Settled; `set()` on each state change | `{ set, revert }` | Instant swap |
| `morphSequence` | Intro or settled; the controller plays, repeats, or scrubs `timeline` | `{ timeline, revert }` | Empty timeline; authored shape |
| `followPath` | Settled | `{ pause, play, revert }` | No-op |
| `pathScrub` | Settled, once the trigger is measurable | teardown | Text placed at `to` |
| `pathLoop` | Settled | `{ pause, play, revert }` | No-op |
| `morphScrub` | Settled, once the trigger is measurable; the controller refreshes ScrollTrigger on layout change | teardown | No-op; authored shape |

- SVG markers for pre-paint hiding use `data-draw`; `drawIn` renders its start before the controller releases them.
- Call `revert` before another effect animates the same element. It restores the SVG's own strokes and `d`.
