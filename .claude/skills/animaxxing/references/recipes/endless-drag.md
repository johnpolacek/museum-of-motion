# Recipe: endless drag

Three galleries without ends. `dragLoop` is a horizontal row that wraps seamlessly: drag it, throw it, or wheel it sideways, and it lands on the nearest item, with an optional slow drift. `dragGrid` is a 2D canvas of tiles that wraps on both axes: drag and throw in any direction. `flickCards` is a fanned stack of cards that deals the next card to the front on a drag or flick. The loop and grid follow GSAP's `horizontalLoop` pattern: every item keeps its place in the DOM and moves by its own transform, wrapped into a fixed span, so no element ever jumps in the tab order. Clones fill the span when there are too few items to cover the viewport; they are `aria-hidden` and `inert`, without ids, so each real item is announced and focused once. For a row that stops at its ends, use `dragTrack` from [pointer effects](pointer-effects.md).

Lifecycle: the framework controller builds these once the items have their final sizes (fonts and images loaded), pauses the loop's drift while a menu or dialog owns the page, and calls `revert` on unmount. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`, `gsap/Draggable`, `gsap/InertiaPlugin`.

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

/** Records inline properties and returns a restore that also resets GSAP's cached transform. */
function snapshotStyles(elements: HTMLElement[], props: string[]): () => void {
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
  options?: AddEventListenerOptions,
): void {
  target.addEventListener(type, handler as EventListener, options);
  dispose(() => target.removeEventListener(type, handler as EventListener, options));
}

/**
 * Records the `style` attribute of `root` and every descendant, and restores each exactly.
 * Draggable writes touch and selection styles through the whole trigger; this also drops the
 * empty `style=""` its removal would leave. Register it first so it runs after other restores.
 */
function snapshotStyleAttributes(root: HTMLElement): () => void {
  const saved = [root, ...root.querySelectorAll<HTMLElement>("*")].map((element) => [element, element.getAttribute("style")] as const);
  return () =>
    saved.forEach(([element, value]) => {
      if (value === null) element.removeAttribute("style");
      else element.setAttribute("style", value);
    });
}

/** A copy for filling the span: hidden from assistive technology, unfocusable, without ids. */
function cloneItem(item: HTMLElement): HTMLElement {
  const clone = item.cloneNode(true) as HTMLElement;
  clone.setAttribute("data-drag-clone", "");
  clone.setAttribute("aria-hidden", "true");
  clone.inert = true;
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  return clone;
}

/** Horizontal wheel movement in px, or 0 when the wheel is mostly vertical. Shift turns a vertical wheel sideways. */
function wheelX(event: WheelEvent, both: boolean): { x: number; y: number } {
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
  const x = (event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX) * scale;
  const y = event.shiftKey ? 0 : event.deltaY * scale;
  if (both) return { x, y };
  return Math.abs(x) > Math.abs(y) ? { x, y: 0 } : { x: 0, y: 0 };
}

/** Inline properties the builders write on items, tiles, and the Draggable trigger. */
const ITEM_PROPS = ["transform", "translate", "width", "height"];
const TRIGGER_PROPS = ["overflow", "touch-action", "user-select", "cursor"];
```

Draggable moves a detached proxy element, never the items. Drag, throw, wheel, focus, and drift all write that one proxy position, and a render maps it onto every item.

## dragLoop

```html
<div class="loop-viewport"><div class="loop-track">…items…</div></div>
```

```css
/* No JavaScript: a native horizontal scroller. */
.loop-viewport { overflow-x: auto; }
.loop-track { display: flex; width: max-content; }
```

Use `gap` or margins between items. Items keep their own widths; the loop measures them.

```ts
export type DragLoopOptions = {
  /** Land on the nearest item after a release, a throw, a wheel, or focus. */
  snap?: boolean;
  /** Auto-drift in px per second; 0 turns it off. Needs a visible pause control. */
  drift?: number;
  /** -1 drifts left, 1 right. */
  direction?: -1 | 1;
  /** Landing after a wheel, focus, or `toIndex`. Accepts a registered CustomEase name. */
  ease?: string;
  duration?: number;
};

export type DragLoop = {
  /** Moves to a real item, the shortest way round. */
  toIndex(index: number): gsap.core.Tween | undefined;
  /** The real item nearest the start edge. */
  index(): number;
  /** Stops the drift, such as from a pause control or while a dialog is open. */
  pause(): void;
  play(): void;
  draggable: Draggable | undefined;
  revert: Teardown;
};

export function dragLoop(
  viewport: HTMLElement,
  track: HTMLElement,
  { snap = true, drift = 0, direction = -1, ease = "power3.out", duration = 0.6 }: DragLoopOptions = {},
): DragLoop {
  const reduced = prefersReducedMotion();
  const real = Array.from(track.children).filter((el): el is HTMLElement => el instanceof HTMLElement);
  const proxy = document.createElement("div");
  let items: HTMLElement[] = [];
  let offsets: number[] = [];
  let widths: number[] = [];
  let total = 1;
  let setters: Array<(value: number) => void> = [];
  let draggable: Draggable | undefined;
  let slide: gsap.core.Tween | undefined;
  /** Reasons the drift is holding, besides a drag, throw, or landing in progress; it runs only when all are clear. */
  const holds = new Set<string>();
  const position = () => Number(gsap.getProperty(proxy, "x"));

  const render = () => {
    const x = position();
    items.forEach((item, i) => setters[i]?.(gsap.utils.wrap(-offsets[i]! - widths[i]!, total - offsets[i]! - widths[i]!, x)));
  };
  /** The position that lines item `i` up with the start edge, nearest to `from`. */
  const stop = (i: number, from: number) => -offsets[i]! + total * Math.round((from + offsets[i]!) / total);
  const nearest = (x: number) => {
    let best = x;
    items.forEach((_, i) => {
      const candidate = stop(i, x);
      if (i === 0 || Math.abs(candidate - x) < Math.abs(best - x)) best = candidate;
    });
    return best;
  };
  const glide = (x: number) => {
    slide?.kill();
    slide = gsap.to(proxy, {
      x,
      duration: reduced ? 0 : duration,
      ease,
      overwrite: true,
      onUpdate: render,
      onComplete: () => draggable?.update(),
    });
    return slide;
  };
  const toIndex = (index: number) => {
    if (!real.length) return undefined;
    const target = ((index % real.length) + real.length) % real.length;
    const from = position();
    let best: number | undefined;
    items.forEach((_, i) => {
      if (i % real.length !== target) return;
      const candidate = stop(i, from);
      if (best === undefined || Math.abs(candidate - from) < Math.abs(best - from)) best = candidate;
    });
    return best === undefined ? undefined : glide(best);
  };
  const index = () => {
    const x = nearest(position());
    const i = items.findIndex((_, j) => Math.abs(stop(j, x) - x) < 0.5);
    return i < 0 || !real.length ? 0 : i % real.length;
  };

  const revert = own((dispose, after) => {
    if (!real.length) return;
    after(snapshotStyleAttributes(viewport));
    after(snapshotStyles(real, ITEM_PROPS));
    after(snapshotStyles([viewport], TRIGGER_PROPS));
    let clones: HTMLElement[] = [];
    after(() => clones.forEach((clone) => clone.remove()));
    viewport.scrollLeft = 0;
    gsap.set(viewport, { overflow: "hidden" });

    /** Measures the real set and adds clone sets until the span covers the viewport plus the widest item. */
    const layout = () => {
      clones.forEach((clone) => clone.remove());
      clones = [];
      gsap.set(real, { x: 0 });
      const first = real[0]!;
      const last = real[real.length - 1]!;
      const style = getComputedStyle(track);
      const gap = (parseFloat(style.columnGap) || 0) + (parseFloat(getComputedStyle(last).marginRight) || 0);
      const start = first.offsetLeft - (parseFloat(getComputedStyle(first).marginLeft) || 0);
      const set = Math.max(1, last.offsetLeft + last.offsetWidth + gap - start);
      const widest = Math.max(...real.map((item) => item.offsetWidth));
      const copies = Math.max(0, Math.ceil((viewport.clientWidth + widest) / set) - 1);
      for (let c = 0; c < copies; c++) real.forEach((item) => clones.push(cloneItem(item)));
      track.append(...clones);
      items = [...real, ...clones];
      offsets = items.map((item) => item.offsetLeft - start);
      widths = items.map((item) => item.offsetWidth);
      total = set * (copies + 1);
      setters = items.map((item) => gsap.quickSetter(item, "x", "px") as (value: number) => void);
    };
    layout();
    render();

    [draggable] = Draggable.create(proxy, {
      type: "x",
      trigger: viewport,
      inertia: !reduced,
      dragClickables: true,
      zIndexBoost: false,
      snap: snap ? { x: nearest } : undefined,
      onPress: () => slide?.kill(),
      onDrag: render,
      onThrowUpdate: render,
      onDragEnd() {
        // Without inertia Draggable never applies `snap`, so land here.
        if (reduced && snap) glide(nearest(position()));
      },
    });
    const drag = draggable;
    dispose(() => drag.kill());
    // Stops a throw still in flight and the velocity tracker, both of which kill() leaves running.
    dispose(() => {
      gsap.killTweensOf(proxy);
      InertiaPlugin.untrack(proxy);
    });
    // Links and images start a native drag that swallows the gesture.
    listen(dispose, track, "dragstart", (event) => event.preventDefault());
    // Focus scrolls the clipped viewport natively; the loop's transforms do that job.
    listen(dispose, viewport, "scroll", () => {
      viewport.scrollLeft = 0;
    });

    const rest = gsap.delayedCall(0.15, () => {
      holds.delete("wheel");
      if (snap) glide(nearest(position()));
    }).pause();
    dispose(() => rest.kill());
    listen(
      dispose,
      viewport,
      "wheel",
      (event) => {
        const { x } = wheelX(event, false);
        if (!x) return;
        event.preventDefault();
        slide?.kill();
        gsap.killTweensOf(proxy);
        holds.add("wheel");
        gsap.set(proxy, { x: position() - x });
        drag.update();
        render();
        rest.restart(true);
      },
      { passive: false },
    );

    listen(dispose, track, "focusin", (event) => {
      holds.add("focus");
      // Pressing an item focuses it too; only keyboard focus moves the loop.
      if (!(event.target as Element).matches(":focus-visible")) return;
      // A pending wheel snap or inertia throw must not replace the keyboard landing.
      rest.pause();
      holds.delete("wheel");
      gsap.killTweensOf(proxy);
      const i = real.findIndex((item) => item.contains(event.target as Node));
      // A clone can be nearer, but only the real item holds keyboard focus.
      if (i >= 0) glide(stop(i, position()));
    });
    listen(dispose, track, "focusout", (event) => {
      if (!track.contains(event.relatedTarget as Node | null)) holds.delete("focus");
    });
    listen(dispose, viewport, "pointerenter", (event) => {
      if (event.pointerType === "mouse") holds.add("hover");
    });
    listen(dispose, viewport, "pointerleave", () => holds.delete("hover"));

    // Rebuild on width changes, once per frame, keeping the current item at the start edge.
    let frame = 0;
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = index();
        gsap.killTweensOf(proxy);
        layout();
        gsap.set(proxy, { x: -offsets[current]! });
        drag.update();
        render();
      });
    });
    resize.observe(viewport);
    real.forEach((item) => resize.observe(item));
    dispose(() => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    });

    if (drift && !reduced) {
      const seen = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) holds.delete("hidden");
        else holds.add("hidden");
      });
      seen.observe(viewport);
      dispose(() => seen.disconnect());
      const tick = (_time: number, deltaTime: number) => {
        // Read live state: a wheel or focus can kill a throw or landing without any completion callback.
        if (holds.size || drag.isPressed || drag.isThrowing || slide?.isActive()) return;
        gsap.set(proxy, { x: position() + (direction * drift * deltaTime) / 1000 });
        render();
      };
      gsap.ticker.add(tick);
      dispose(() => gsap.ticker.remove(tick));
    }
  });

  return {
    toIndex,
    index,
    pause: () => void holds.add("paused"),
    play: () => void holds.delete("paused"),
    draggable,
    revert,
  };
}
```

Drift is ambient motion that runs past five seconds, so wire `pause` and `play` to a visible control ([WCAG 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)). It also holds while the mouse is over the loop, while focus is inside, during a drag or throw, and off screen. Vertical wheels and swipes scroll the page; horizontal ones move the loop.

## dragGrid

```html
<div class="grid-viewport"><ul class="grid">…tiles…</ul></div>
```

```css
/* No JavaScript: a scrolling grid. The viewport needs a definite height either way. */
.grid-viewport { height: 80vh; overflow: auto; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, 240px); gap: 16px; }
/* Applies only while the grid is built. */
[data-drag-grid] { position: relative; height: 100%; margin: 0; padding: 0; }
[data-drag-grid] > * { position: absolute; left: 0; top: 0; margin: 0; }
```

Tiles share one size, measured from the first tile in the fallback layout, with the container's `column-gap` and `row-gap` between them.

```ts
export type DragGridOptions = {
  /** Tiles per row of the repeating block. Defaults to a square-ish block. */
  columns?: number;
  /**
   * Axes that touch swipes and the wheel claim. "x" leaves vertical swipes and wheels to the page
   * on a grid inside a scrolling page; "both" suits a full-screen canvas. Mouse drags always move both.
   */
  capture?: "x" | "both";
  /** Centering a focused tile. Accepts a registered CustomEase name. */
  ease?: string;
  duration?: number;
};

export type DragGrid = {
  /** Centers a real tile, the shortest way round on each axis. */
  toTile(index: number): gsap.core.Tween | undefined;
  draggable: Draggable | undefined;
  revert: Teardown;
};

type Cell = { el: HTMLElement; x: number; y: number; setX: (v: number) => void; setY: (v: number) => void };

export function dragGrid(
  viewport: HTMLElement,
  container: HTMLElement,
  { columns, capture = "x", ease = "power3.out", duration = 0.6 }: DragGridOptions = {},
): DragGrid {
  const reduced = prefersReducedMotion();
  const tiles = Array.from(container.children).filter((el): el is HTMLElement => el instanceof HTMLElement);
  const proxy = document.createElement("div");
  let cells: Cell[] = [];
  let size = { tile: [0, 0], cell: [1, 1], span: [1, 1] };
  let draggable: Draggable | undefined;
  let slide: gsap.core.Tween | undefined;
  const at = () => [Number(gsap.getProperty(proxy, "x")), Number(gsap.getProperty(proxy, "y"))] as const;
  /** Places a cell's left or top within [-cell, span - cell), so the span always covers the viewport. */
  const place = (base: number, offset: number, axis: 0 | 1) =>
    gsap.utils.wrap(-size.cell[axis]!, size.span[axis]! - size.cell[axis]!, base + offset);

  const render = () => {
    const [x, y] = at();
    cells.forEach((cell) => {
      cell.setX(place(cell.x, x, 0));
      cell.setY(place(cell.y, y, 1));
    });
  };

  const toTile = (index: number) => {
    const cell = cells[index];
    if (!cell || index >= tiles.length) return undefined;
    const [x, y] = at();
    // Move the wrapped difference, never more than half a span.
    const shift = (axis: 0 | 1, now: number) => {
      const view = axis === 0 ? viewport.clientWidth : viewport.clientHeight;
      const want = (view - size.tile[axis]!) / 2;
      const half = size.span[axis]! / 2;
      return now + gsap.utils.wrap(-half, half, want - place(axis === 0 ? cell.x : cell.y, now, axis));
    };
    slide?.kill();
    slide = gsap.to(proxy, {
      x: shift(0, x),
      y: shift(1, y),
      duration: reduced ? 0 : duration,
      ease,
      overwrite: true,
      onUpdate: render,
      onComplete: () => draggable?.update(),
    });
    return slide;
  };

  const revert = own((dispose, after) => {
    if (!tiles.length) return;
    // Measure in the fallback layout, before anything changes.
    const box = tiles[0]!.getBoundingClientRect();
    const style = getComputedStyle(container);
    const gap = [parseFloat(style.columnGap) || 0, parseFloat(style.rowGap) || 0];
    size.tile = [box.width, box.height];
    size.cell = [box.width + gap[0]!, box.height + gap[1]!];
    const perRow = Math.max(1, Math.min(tiles.length, columns ?? Math.ceil(Math.sqrt(tiles.length))));
    const rows = Math.ceil(tiles.length / perRow);

    after(snapshotStyleAttributes(viewport));
    after(snapshotStyles(tiles, ITEM_PROPS));
    after(snapshotStyles([viewport], TRIGGER_PROPS));
    const hadAttribute = container.hasAttribute("data-drag-grid");
    after(() => {
      if (!hadAttribute) container.removeAttribute("data-drag-grid");
    });
    let clones: HTMLElement[] = [];
    after(() => clones.forEach((clone) => clone.remove()));

    viewport.scrollTo(0, 0);
    gsap.set(viewport, { overflow: "hidden" });
    container.setAttribute("data-drag-grid", "");
    gsap.set(tiles, { width: size.tile[0], height: size.tile[1] });

    /** Repeats the block of tiles until it covers the viewport plus one cell on each axis. */
    const layout = () => {
      clones.forEach((clone) => clone.remove());
      clones = [];
      const block = [perRow * size.cell[0]!, rows * size.cell[1]!];
      const view = [viewport.clientWidth, viewport.clientHeight];
      const repeat = [0, 1].map((axis) => Math.max(1, Math.ceil((view[axis]! + size.cell[axis]!) / block[axis]!)));
      size.span = [repeat[0]! * block[0]!, repeat[1]! * block[1]!];
      cells = [];
      for (let by = 0; by < repeat[1]!; by++) {
        for (let bx = 0; bx < repeat[0]!; bx++) {
          for (let j = 0; j < perRow * rows; j++) {
            // The first block holds the real tiles; its empty last-row cells and every other block are clones.
            const el = bx === 0 && by === 0 && j < tiles.length ? tiles[j]! : cloneItem(tiles[j % tiles.length]!);
            if (!tiles.includes(el)) clones.push(el);
            cells.push({
              el,
              x: bx * block[0]! + (j % perRow) * size.cell[0]!,
              y: by * block[1]! + Math.floor(j / perRow) * size.cell[1]!,
              setX: gsap.quickSetter(el, "x", "px") as (v: number) => void,
              setY: gsap.quickSetter(el, "y", "px") as (v: number) => void,
            });
          }
        }
      }
      // The first block's first cells are the real tiles, so `toTile(i)` finds tile i at cells[i].
      container.append(...clones);
    };
    layout();
    render();

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    [draggable] = Draggable.create(proxy, {
      // Touch-first devices keep vertical swipes for the page unless the grid claims both axes.
      type: capture === "x" && coarse ? "x" : "x,y",
      trigger: viewport,
      inertia: !reduced,
      dragClickables: true,
      zIndexBoost: false,
      onPress: () => slide?.kill(),
      onDrag: render,
      onThrowUpdate: render,
    });
    const drag = draggable;
    dispose(() => drag.kill());
    dispose(() => {
      gsap.killTweensOf(proxy);
      InertiaPlugin.untrack(proxy);
    });
    listen(dispose, container, "dragstart", (event) => event.preventDefault());
    listen(dispose, viewport, "scroll", () => viewport.scrollTo(0, 0));
    listen(
      dispose,
      viewport,
      "wheel",
      (event) => {
        const { x, y } = wheelX(event, capture === "both");
        if (!x && !y) return;
        event.preventDefault();
        slide?.kill();
        gsap.killTweensOf(proxy);
        const [px, py] = at();
        gsap.set(proxy, { x: px - x, y: py - y });
        drag.update();
        render();
      },
      { passive: false },
    );
    listen(dispose, container, "focusin", (event) => {
      if (!(event.target as Element).matches(":focus-visible")) return;
      const i = tiles.findIndex((tile) => tile.contains(event.target as Node));
      if (i >= 0) toTile(i);
    });

    // The block and tile size stay; a new viewport size changes how many copies cover it.
    let frame = 0;
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        layout();
        render();
      });
    });
    resize.observe(viewport);
    dispose(() => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    });
  });

  return { toTile, draggable, revert };
}
```

Tiles need one size; a masonry of mixed sizes does not wrap without gaps. Rebuild the grid after its tiles change. Tab order follows the real tiles' DOM order, and focus centers each tile on its way through.

## flickCards

A fanned stack: the front card faces the viewer, its neighbors lean out to either side, and a drag or flick deals the next one to the front. The deck wraps, so it has no ends. Cards pose by their own size (`xPercent`), so resizing needs no remeasure. For a row of items rather than a pile, use `dragLoop`.

```html
<section class="flick" aria-roledescription="carousel" aria-label="Featured work" tabindex="0">
  <ul class="flick-stack">…cards…</ul>
  <button type="button" data-flick-prev>Previous</button>
  <button type="button" data-flick-next>Next</button>
</section>
```

```css
/* No JavaScript: a native horizontal scroller. */
.flick-stack { display: flex; gap: 16px; overflow-x: auto; }
/* Applies only while the deck is built: every card shares one grid cell, so the tallest sets the height. */
[data-flick] .flick-stack { display: grid; overflow: visible; }
[data-flick] .flick-stack > * { grid-area: 1 / 1; }
```

```ts
/** A resting pose; x and rotation mirror for cards on the left. */
export type FlickPose = { xPercent: number; yPercent: number; rotation: number; scale: number; autoAlpha: number };

/** Poses by distance from the front card. The last is the hidden pose every further card takes. */
export const FLICK_POSES: FlickPose[] = [
  { xPercent: 0, yPercent: 0, rotation: 0, scale: 1, autoAlpha: 1 },
  { xPercent: 25, yPercent: 1, rotation: 10, scale: 0.9, autoAlpha: 1 },
  { xPercent: 45, yPercent: 5, rotation: 15, scale: 0.8, autoAlpha: 1 },
  { xPercent: 55, yPercent: 5, rotation: 20, scale: 0.6, autoAlpha: 0 },
];

export type FlickCardsOptions = {
  poses?: FlickPose[];
  /** Share of the root's width a drag covers to move one card. */
  distance?: number;
  /** Share of `distance` past which a release deals the next card. */
  threshold?: number;
  /** Release speed in px/s that deals the next card however short the drag. */
  flick?: number;
  /** The deal. Accepts a registered CustomEase name. */
  ease?: string;
  duration?: number;
  /** Called with the new front card's index, such as to update a live counter. */
  onChange?: (index: number) => void;
};

export type FlickCards = {
  next(): void;
  prev(): void;
  /** Deals a card to the front, the shortest way round. */
  toIndex(index: number): void;
  /** The front card. */
  index(): number;
  draggable: Draggable | undefined;
  revert: Teardown;
};

export function flickCards(
  root: HTMLElement,
  stack: HTMLElement,
  {
    poses = FLICK_POSES,
    distance = 0.5,
    threshold = 0.15,
    flick = 500,
    ease = "elastic.out(1, 0.8)",
    duration = 0.8,
    onChange,
  }: FlickCardsOptions = {},
): FlickCards {
  const reduced = prefersReducedMotion();
  const cards = Array.from(stack.children).filter((el): el is HTMLElement => el instanceof HTMLElement);
  const n = cards.length;
  const last = poses.length - 1;
  const proxy = document.createElement("div");
  /** The deck's position in cards; fractional mid-drag and mid-deal. */
  const state = { position: 0 };
  let aim = 0;
  let current = 0;
  let deal: gsap.core.Tween | undefined;
  let draggable: Draggable | undefined;
  const wrapIndex = (i: number) => ((i % n) + n) % n;
  const mix = (a: number, b: number, f: number) => a + (b - a) * f;

  const render = () => {
    cards.forEach((card, i) => {
      // Signed distance from the front, the shorter way round the deck.
      const d = gsap.utils.wrap(-n / 2, n / 2, i - state.position);
      const reach = Math.min(Math.abs(d), last);
      const k = Math.floor(reach);
      const from = poses[k]!;
      const to = poses[Math.min(k + 1, last)]!;
      const f = reach - k;
      const side = d < 0 ? -1 : 1;
      gsap.set(card, {
        xPercent: side * mix(from.xPercent, to.xPercent, f),
        yPercent: mix(from.yPercent, to.yPercent, f),
        rotation: side * mix(from.rotation, to.rotation, f),
        scale: mix(from.scale, to.scale, f),
        autoAlpha: mix(from.autoAlpha, to.autoAlpha, f),
        zIndex: Math.round((last - reach) * 10) + 1,
      });
    });
  };

  /** Only the front card is reachable by Tab and assistive technology. */
  const settle = () => {
    const holder = cards.find((card) => card.contains(document.activeElement));
    cards.forEach((card, i) => (card.inert = i !== current));
    // Focus inside a card going inert would drop to the body; keep it on the deck.
    if (holder && holder.inert) root.focus({ preventScroll: true });
  };

  const go = (target: number) => {
    if (!n) return;
    const next = wrapIndex(target);
    const changed = next !== current;
    aim = target;
    current = next;
    settle();
    deal?.kill();
    if (reduced) {
      state.position = target;
      render();
    } else {
      deal = gsap.to(state, { position: target, duration, ease, overwrite: true, onUpdate: render });
    }
    if (changed) onChange?.(current);
  };
  const toIndex = (index: number) => go(aim + gsap.utils.wrap(-n / 2, n / 2, wrapIndex(index) - current));

  const revert = own((dispose, after) => {
    if (!n) return;
    after(snapshotStyleAttributes(root));
    const wasInert = cards.map((card) => card.inert);
    after(() => cards.forEach((card, i) => (card.inert = wasInert[i]!)));
    after(() => root.removeAttribute("data-flick"));
    dispose(() => deal?.kill());
    root.setAttribute("data-flick", "");
    stack.scrollLeft = 0;
    render();
    settle();

    let startX = 0;
    let start = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;
    [draggable] = Draggable.create(proxy, {
      type: "x",
      trigger: root,
      inertia: false,
      dragClickables: true,
      zIndexBoost: false,
      onPress() {
        startX = lastX = drag().x;
        lastT = performance.now();
        velocity = 0;
      },
      onDragStart() {
        deal?.kill();
        start = state.position;
      },
      onDrag() {
        const now = performance.now();
        const x = drag().x;
        velocity = ((x - lastX) / Math.max(now - lastT, 8)) * 1000;
        lastX = x;
        lastT = now;
        // Dragging left brings the next card forward; one card per gesture.
        state.position = start + gsap.utils.clamp(-1, 1, -(x - startX) / (root.clientWidth * distance));
        render();
      },
      onDragEnd() {
        // A pause before release cancels the flick.
        if (performance.now() - lastT > 100) velocity = 0;
        const moved = state.position - start;
        let step = 0;
        if (Math.abs(velocity) > flick) step = velocity < 0 ? 1 : -1;
        else if (Math.abs(moved) > threshold) step = Math.sign(moved);
        go(Math.round(start) + step);
      },
      onClick() {
        // A leaning card is inert, so a click on it lands on the deck; find the card by its box.
        const event = drag().pointerEvent;
        const point = "changedTouches" in event ? event.changedTouches[0] : event;
        if (!point) return;
        const inside = (card: HTMLElement) => {
          const box = card.getBoundingClientRect();
          return point.clientX >= box.left && point.clientX <= box.right && point.clientY >= box.top && point.clientY <= box.bottom;
        };
        if (inside(cards[current]!)) return;
        const hit = cards
          .map((card, i) => ({ card, i, z: Number(gsap.getProperty(card, "zIndex")) }))
          .filter(({ card, i }) => i !== current && Number(gsap.getProperty(card, "autoAlpha")) > 0.5 && inside(card))
          .sort((a, b) => b.z - a.z)[0];
        if (hit) toIndex(hit.i);
      },
    });
    const drag = () => draggable!;
    const instance = draggable;
    dispose(() => instance?.kill());
    // Links and images start a native drag that swallows the gesture.
    listen(dispose, stack, "dragstart", (event) => event.preventDefault());
    listen(dispose, root, "keydown", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowRight") go(aim + 1);
      else if (event.key === "ArrowLeft") go(aim - 1);
      else return;
      event.preventDefault();
    });
  });

  return { next: () => go(aim + 1), prev: () => go(aim - 1), toIndex, index: () => current, draggable, revert };
}
```

The deck needs at least twice as many cards as poses beyond the front, six with the defaults; with fewer, a card crossing the back of the deck pops from one side to the other while visible. Pass fewer poses for a small deck. Rebuild after the cards change.

Only the front card is in the tab order and accessibility tree. Give the deck visible previous and next buttons wired to `prev` and `next`: they are the way through for keyboard, switch, and screen reader users, and arrow keys work while focus is on the deck. Announce the change with `onChange` if the app has a live region.

## Wiring

```ts
// Example: a drifting loop with its pause control.
const loop = dragLoop(viewport, track, { drift: 40 });
pauseButton.addEventListener("click", () => {
  const paused = pauseButton.getAttribute("aria-pressed") === "true";
  pauseButton.setAttribute("aria-pressed", String(!paused));
  if (paused) loop.play();
  else loop.pause();
});
```

## Controller contract

| Builder | Create | Returns | Reduced motion |
|---|---|---|---|
| `dragLoop` | Settled, once item widths are final | `{ toIndex, index, pause, play, draggable, revert }` | Drags, wheels, and lands on items with no throw and no drift |
| `dragGrid` | Settled, once the tile size is final | `{ toTile, draggable, revert }` | Drags and wheels with no throw; focus centers at once |
| `flickCards` | Settled, once the cards have rendered | `{ next, prev, toIndex, index, draggable, revert }` | Drags follow the pointer; deals land at once, without the spring |

- Revert before the items change; rebuild after they render.
- `pause()` the loop while a menu or dialog owns the page, and `play()` after, unless the visitor paused it.
- A link inside an item follows on a click; a drag or throw never follows it.
- Revert mid-throw: the throw stops, clones are removed, and every item's and the viewport's inline styles restore exactly.
