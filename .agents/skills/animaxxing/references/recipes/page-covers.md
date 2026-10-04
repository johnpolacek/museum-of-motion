# Recipe: page covers

Full-screen covers in the persistent shell, outside any route, so they survive the swap they hide: a curtain over a route swap, a curved cover whose edge bows as it sweeps, and a first-visit preloader that follows real readiness.

Lifecycle: the shell's controller runs them per its [contract](#controller-contract); the framework skill's `references/transition-archetypes.md` owns the sequence, navigation locks, and recovery. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`.

## Markup

```html
<!-- In the persistent shell, after the page content. -->
<div class="curtain" aria-hidden="true">
  <div class="curtain-panel"></div><div class="curtain-panel"></div><div class="curtain-panel"></div>
</div>

<div class="preloader" role="progressbar" aria-label="Loading" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
  <span data-preloader-count>0</span>
  <span class="preloader-bar" data-preloader-bar></span>
</div>
```

```css
.curtain { position: fixed; inset: 0; z-index: 50; display: flex; pointer-events: none; }
.curtain-panel { flex: 1; background: currentColor; visibility: hidden; }
.preloader { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; background: Canvas; }
.preloader-bar { position: absolute; left: 0; bottom: 0; width: 100%; height: 2px; background: currentColor; transform: scaleX(0); transform-origin: 0 50%; }
```

Color panels and preloader with existing brand tokens. For a curtain from the left or right, stack panels with `flex-direction: column`. Render the preloader only on visits that run it; the framework's first-paint script decides.

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
type Register = (fn: () => void) => void;

/**
 * Runs setup in a GSAP context. `dispose` stops writers before the revert; `after` restores once it is done.
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

/** Records inline properties and returns a restore that also resets GSAP's cached transform. */
function snapshotStyles(elements: Array<HTMLElement | SVGElement>, props: string[]): () => void {
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

const COVER_PROPS = ["transform", "translate", "visibility", "opacity", "pointer-events", "clip-path"];
```

## curtain

Staggered panels sweep in from one edge to cover the viewport, then out the far edge. Covered panels take pointer events, so a second click cannot reach the swapping page. A cover requested mid-reveal turns back from where the panels are.

Four options change its character. `tilt` swings the panels in at an angle, straightening as they cover and tipping the other way as they leave. `wipe` holds the panels still and opens a `clip-path` from the entry edge instead; `tilt` is ignored with it. `title` names an element inside the curtain that shows the incoming page's name while the page is covered; `cover("About")` fills it. `drift` pushes the persistent content wrapper along with the sweep: the outgoing page slides away as it is covered, and the incoming page trails in behind the panels as they leave.

```html
<!-- Optional title slot, after the panels. -->
<p class="curtain-title" data-curtain-title></p>
```

```css
.curtain-title { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; color: Canvas; visibility: hidden; }
/* Tilt suits one oversized panel, so its corners never show the page. */
.curtain--tilt .curtain-panel { flex: none; width: 150vw; height: 150vh; margin: -25vh -25vw; }
```

```ts
export type CurtainOptions = {
  /** The edge the panels come from. They leave by the opposite edge. */
  from?: "bottom" | "top" | "left" | "right";
  duration?: number;
  stagger?: number;
  /** Degrees the panels lean while moving; 0 keeps them square. */
  tilt?: number;
  /** Open a clip-path from the entry edge instead of sliding the panels. */
  wipe?: boolean;
  /** An element inside the curtain that shows the incoming page's title while covered. */
  title?: HTMLElement;
  /** The persistent wrapper around routed content, and how far it travels, as a fraction of the viewport. */
  drift?: { content: HTMLElement; distance?: number };
};

export type Curtain = {
  /** Sweeps the panels in, showing `title` once covered. Swap the route when it completes. */
  cover(title?: string): gsap.core.Timeline;
  /** Hides the title, then sweeps the panels out, uncovering the incoming page. */
  reveal(): gsap.core.Timeline;
  /** Stops either sweep and restores the panels. */
  revert: Teardown;
};

export function curtain(
  panels: gsap.DOMTarget,
  { from = "bottom", duration = 0.6, stagger = 0.06, tilt = 0, wipe = false, title, drift }: CurtainOptions = {},
): Curtain {
  const items = gsap.utils.toArray<HTMLElement>(panels);
  const vertical = from === "bottom" || from === "top";
  const axis = vertical ? "yPercent" : "xPercent";
  /** Offstage on the entry side is +100 for bottom and right, -100 for top and left. */
  const entry = from === "bottom" || from === "right" ? 100 : -100;
  /** Wipe clips: collapsed onto the entry edge, fully open, and collapsed onto the exit edge. */
  const OPEN = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
  const EDGE = {
    top: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
    bottom: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
    left: "polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)",
    right: "polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)",
  };
  const exitEdge = { bottom: "top", top: "bottom", left: "right", right: "left" } as const;
  /** A panel entering from the bottom or right leans one way; its exit leans the other. */
  const lean = tilt * Math.sign(entry);
  const rest = wipe ? { clipPath: EDGE[from] } : { [axis]: entry, rotation: lean };
  const shut = wipe ? { clipPath: OPEN } : { [axis]: 0, rotation: 0 };
  /** Content offset on the entry side, in px. The sweep carries content from there toward the opposite side. */
  const travel = () => {
    const size = vertical ? window.innerHeight : window.innerWidth;
    return (drift?.distance ?? 0.2) * size * Math.sign(entry);
  };
  const contentAxis = vertical ? "y" : "x";
  let restoreContent: (() => void) | undefined;
  let current: gsap.core.Timeline | undefined;
  const sweep = () => {
    current?.kill();
    current = gsap.timeline({ defaults: { overwrite: "auto" } });
    return current;
  };
  const revert = own((dispose, after) => {
    after(snapshotStyles(items, COVER_PROPS));
    if (drift) {
      restoreContent = snapshotStyles([drift.content], ["transform", "translate"]);
      after(restoreContent);
    }
    if (title) {
      const text = title.textContent;
      after(snapshotStyles([title], COVER_PROPS));
      after(() => (title.textContent = text));
    }
    dispose(() => current?.kill());
    gsap.set(items, { visibility: "hidden" });
    if (title) gsap.set(title, { autoAlpha: 0 });
  });
  return {
    cover(text?: string) {
      const tl = sweep();
      // Reduced motion never flashes a full-screen panel; the framework's swap cover handles the gap.
      if (prefersReducedMotion()) return tl.set(items, { visibility: "hidden", pointerEvents: "none" });
      const resting = items.filter((item) => getComputedStyle(item).visibility === "hidden");
      if (resting.length > 0) tl.set(resting, rest);
      tl.set(items, { visibility: "visible", pointerEvents: "auto" }).to(items, { ...shut, duration, ease: "power3.inOut", stagger });
      if (drift) {
        tl.to(drift.content, { [contentAxis]: () => -travel(), duration, ease: "power3.inOut" }, "<");
      }
      if (title && text) {
        title.textContent = text;
        tl.fromTo(title, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out" }, "-=0.15");
      }
      return tl;
    },
    reveal() {
      const tl = sweep();
      if (prefersReducedMotion()) return tl.set(items, { visibility: "hidden", pointerEvents: "none" });
      if (title && gsap.getProperty(title, "autoAlpha")) {
        tl.to(title, { autoAlpha: 0, y: -8, duration: 0.2, ease: "power2.in" });
      }
      const leave = wipe ? { clipPath: EDGE[exitEdge[from]] } : { [axis]: -entry, rotation: -lean };
      tl.to(items, { ...leave, duration, ease: "power3.inOut", stagger });
      if (drift) {
        // The incoming page trails the panels in from the entry side, then drops its transform.
        tl.fromTo(
          drift.content,
          { [contentAxis]: () => travel() },
          { [contentAxis]: 0, duration, ease: "power3.inOut", onComplete: () => restoreContent?.() },
          "<",
        );
      }
      return tl.set(items, { visibility: "hidden", pointerEvents: "none", ...rest });
    },
    revert,
  };
}
```

## curveCover

One SVG shape sweeps across the viewport with its leading edge bowed ahead of its corners, then flattens as it covers. The reveal pulls the trailing edge across the same way and out the far side. It is the curtain's liquid sibling: one color, no panels, the same `cover()` and `reveal()`. A cover requested mid-reveal, or a reveal mid-cover, turns the edge back from where it is.

```html
<!-- In the persistent shell, in place of the curtain. -->
<svg class="curve-cover" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none"><path /></svg>
```

```css
.curve-cover { position: fixed; inset: 0; z-index: 50; width: 100%; height: 100%; fill: currentColor; pointer-events: none; visibility: hidden; }
```

```ts
type CoverEdge = "bottom" | "top" | "left" | "right";

export type CurveCoverOptions = {
  /** The edge the shape comes from. It leaves by the opposite edge. */
  from?: CoverEdge;
  duration?: number;
  /** How far the edge's middle leads its corners mid-sweep, in percent of the viewport. */
  bend?: number;
};

export type CurveCover = {
  /** Sweeps the shape in. Swap the route when it completes. */
  cover(): gsap.core.Timeline;
  /** Sweeps the shape out the far edge, uncovering the incoming page. */
  reveal(): gsap.core.Timeline;
  revert: Teardown;
};

export function curveCover(svg: SVGSVGElement, { from = "bottom", duration = 0.8, bend = 30 }: CurveCoverOptions = {}): CurveCover {
  const path = svg.querySelector("path");
  if (!path) throw new Error("curveCover needs a <path> inside its <svg>");
  /**
   * `front` is the moving edge's distance from the entry edge, 0 to 100. Covering, the shape
   * spans the entry edge to the front; revealing, it spans the front to the far edge.
   */
  const state = { front: 0, bulge: 0 };
  let mode: "cover" | "reveal" = "cover";
  /** Maps (along the edge, away from the entry edge) onto the viewBox. */
  const at = (along: number, away: number) =>
    from === "bottom" ? `${along} ${100 - away}` : from === "top" ? `${along} ${away}` : from === "left" ? `${away} ${along}` : `${100 - away} ${along}`;
  const draw = () => {
    const { front, bulge } = state;
    const edge = `${at(0, front)} Q${at(50, front + bulge)} ${at(100, front)}`;
    const base = mode === "cover" ? 0 : 100;
    path.setAttribute("d", `M${at(0, base)} L${edge} L${at(100, base)} Z`);
  };
  let current: gsap.core.Timeline | undefined;
  const sweep = () => {
    current?.kill();
    current = gsap.timeline({ defaults: { overwrite: "auto" } });
    return current;
  };
  /** Moves the front to `to`, bowing its middle ahead in the direction of travel. A turn-back takes its share of the time. */
  const move = (tl: gsap.core.Timeline, to: number) => {
    const distance = to - state.front;
    const time = duration * Math.max(Math.abs(distance) / 100, 0.25);
    const lead = bend * Math.sign(distance);
    return tl
      .to(state, { front: to, duration: time, ease: "power3.inOut", onUpdate: draw }, 0)
      .to(state, { bulge: lead, duration: time / 2, ease: "power2.out", onUpdate: draw }, 0)
      .to(state, { bulge: 0, duration: time / 2, ease: "power2.in", onUpdate: draw }, time / 2);
  };
  const empty = () => {
    mode = "cover";
    state.front = 0;
    state.bulge = 0;
    draw();
  };
  const revert = own((dispose, after) => {
    const d = path.getAttribute("d");
    after(snapshotStyles([svg], COVER_PROPS));
    after(() => (d === null ? path.removeAttribute("d") : path.setAttribute("d", d)));
    dispose(() => current?.kill());
    gsap.set(svg, { visibility: "hidden" });
    empty();
  });
  const hide = { visibility: "hidden", pointerEvents: "none" };
  return {
    cover() {
      const tl = sweep();
      if (prefersReducedMotion()) return tl.set(svg, hide);
      tl.set(svg, { visibility: "visible", pointerEvents: "auto" });
      // Mid-reveal, the trailing edge turns back to the entry edge; otherwise the front crosses to the far edge.
      return move(tl, mode === "reveal" ? 0 : 100);
    },
    reveal() {
      const tl = sweep();
      if (prefersReducedMotion()) return tl.set(svg, hide);
      if (mode === "cover" && state.front < 100) {
        // Mid-cover: the front retreats to the entry edge.
        move(tl, 0);
      } else {
        if (mode === "cover") {
          // Fully covered: the same full shape, now measured from the trailing edge.
          mode = "reveal";
          state.front = 0;
        }
        move(tl, 100);
      }
      return tl.call(empty).set(svg, hide);
    },
    revert,
  };
}
```

A dark shape suits a light site and the reverse; color it with an existing brand token through `fill`. Keep `bend` under about 40, or the bowed middle outruns the viewport before the corners arrive.

## preloader

The count eases toward reported readiness and never runs backward. `finish()` completes the count and lifts the preloader, which then leaves the accessibility tree. The controller reports progress from fonts, critical images, and data under a deadline, never from a fake timer.

```ts
export type PreloaderOptions = {
  /** Seconds the count takes to catch up with reported progress. */
  catchUp?: number;
};

export type Preloader = {
  /** Reports readiness from 0 to 1. Lower values than already shown are ignored. */
  progress(ratio: number): void;
  /** Counts to 100, then lifts the preloader. Start the first intro as it completes, or overlap its end. */
  finish(): gsap.core.Timeline;
  revert: Teardown;
};

export function preloader(root: HTMLElement, { catchUp = 0.5 }: PreloaderOptions = {}): Preloader {
  const count = root.querySelector<HTMLElement>("[data-preloader-count]");
  const bar = root.querySelector<HTMLElement>("[data-preloader-bar]");
  const shown = { value: 0 };
  let target = 0;
  let ease: gsap.QuickToFunc | undefined;
  let exit: gsap.core.Timeline | undefined;
  const render = () => {
    const percent = Math.round(shown.value * 100);
    if (count) count.textContent = String(percent);
    if (bar) gsap.set(bar, { scaleX: shown.value });
    root.setAttribute("aria-valuenow", String(percent));
  };
  const revert = own((dispose, after) => {
    const text = count?.textContent ?? "";
    const valueNow = root.getAttribute("aria-valuenow");
    after(snapshotStyles([root], COVER_PROPS));
    if (bar) after(snapshotStyles([bar], ["transform"]));
    after(() => {
      if (count) count.textContent = text;
      if (valueNow === null) root.removeAttribute("aria-valuenow");
      else root.setAttribute("aria-valuenow", valueNow);
    });
    dispose(() => {
      exit?.kill();
      gsap.killTweensOf(shown);
    });
    ease = gsap.quickTo(shown, "value", { duration: catchUp, ease: "power2.out", onUpdate: render });
    render();
  });
  return {
    progress(ratio) {
      const next = gsap.utils.clamp(0, 1, ratio);
      if (next <= target || exit) return;
      target = next;
      if (prefersReducedMotion() || !ease) {
        shown.value = target;
        render();
      } else ease(target);
    },
    finish() {
      exit?.kill();
      gsap.killTweensOf(shown);
      target = 1;
      exit = gsap.timeline({ defaults: { overwrite: "auto" } });
      if (prefersReducedMotion()) {
        shown.value = 1;
        render();
        return exit.set(root, { autoAlpha: 0 });
      }
      return exit
        .to(shown, { value: 1, duration: 0.35, ease: "power2.out", onUpdate: render })
        .to(root, { yPercent: -100, duration: 0.7, ease: "power4.inOut" }, "+=0.1")
        .set(root, { autoAlpha: 0 });
    },
    revert,
  };
}
```

## Wiring

```ts
// Example: the shell's controller, on a client navigation.
const outro = gsap.timeline();
outro.add(buildPageOutro(page, () => {}));             // optional item exit first
outro.add(cover.cover(), "-=0.15");                     // then the curtain closes
outro.eventCallback("onComplete", () => router.go());   // swap under the cover
// Incoming page prepared and hidden at its initial state:
cover.reveal().eventCallback("onComplete", () => markSettled());
```

## Controller contract

| Builder | Create | Returns | Reduced motion |
|---|---|---|---|
| `curtain` | Once, from the persistent shell; `cover(title)` per navigation | `{ cover, reveal, revert }` | Panels never show and content never drifts; timelines complete next frame. The controller uses its ordinary swap cover |
| `curveCover` | Once, from the persistent shell, in place of `curtain`; `cover()` per navigation | `{ cover, reveal, revert }` | Never shows; timelines complete next frame, like the curtain |
| `preloader` | First paint of a visit that shows it | `{ progress, finish, revert }` | Count jumps to reported values; `finish` hides at once |

- Run `cover()` on the shell's own timeline, never inside a page's GSAP context, and swap when it completes. Where each page builds its own outro, run the cover as a sibling offset into it and swap once both complete. A cover nested in a page timeline must leave that parent before the page's context reverts, or the revert reopens the curtain.
- Call `reveal()` only after every incoming target has its size and start styles.
- `drift` transforms the content wrapper, which re-anchors any `position: fixed` inside it. Keep fixed UI in the shell, outside the wrapper, and build pins after `reveal()` completes, when the transform is gone.
- Back and forward take the intro-only path: no cover, and `reveal()` only if the curtain is still closed.
- A preloader is a deliberate hold under the framework's initialization contract; it counts as the prepared intro, so the framework owns its deadline and recovery.
- Keep the curtain's panels and title out of the accessibility tree; the framework's route announcer still names the new page. The preloader's `role="progressbar"` reports its value while visible; the controller sets `aria-busy` on the content it covers.
