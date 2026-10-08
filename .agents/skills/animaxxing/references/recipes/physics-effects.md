# Recipe: physics effects

Decorative DOM pieces thrown under gravity with Physics2DPlugin. `burst` fires a cone of pieces from a point, such as confetti from a pressed button. `rain` drops pieces from the top of the layer, such as emoji falling over a section. `pile` is the one with collisions: pieces fall into a box, bounce off its floor, its walls, and each other, and come to rest in a heap. Pieces are text (an emoji or a glyph) or copies of an element, so they take the page's own fonts and colors. Every piece is removed when it lands or fades, and nothing waits on the run: the triggering control has already done its job.

Lifecycle: the framework controller creates the layer with the persistent shell, calls `burst` or `rain` from an interaction or a settled page, and calls `stop` on each live run at unmount or when navigation starts. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`, `gsap/Physics2DPlugin`.

```html
<!-- Once per document, from the persistent shell. -->
<div class="physics-layer" aria-hidden="true"></div>
```

```css
.physics-layer { position: fixed; inset: 0; z-index: 60; overflow: hidden; pointer-events: none; }
.physics-layer > * { position: absolute; left: 0; top: 0; }
```

```ts
import gsap from "gsap";
import { Physics2DPlugin } from "gsap/Physics2DPlugin";

gsap.registerPlugin(Physics2DPlugin);

/* Swap for the project's helper if it has one. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Pieces alive at once across every run; coarse pointers get half. Runs past the cap spawn fewer. */
const MAX_LIVE = 120;
let live = 0;

function budget(): number {
  const cap = window.matchMedia("(pointer: coarse)").matches ? MAX_LIVE / 2 : MAX_LIVE;
  return Math.max(0, cap - live);
}

/** A piece to throw: text such as an emoji, or an element to copy. */
export type Piece = string | HTMLElement;

export type PhysicsOptions = {
  pieces: Piece[];
  count?: number;
  /** Launch speed range in px/s. */
  velocity?: [number, number];
  /** Downward pull in px/s². */
  gravity?: number;
  /** Most spin in degrees over a piece's flight, either way. */
  spin?: number;
  /** Scale range, for depth. */
  scale?: [number, number];
};

export type PhysicsRun = {
  /** Removes every piece at once. Safe to call twice or after the run ends. */
  stop(): void;
  /** Resolves when the last piece is gone, by landing or by `stop`. */
  finished: Promise<void>;
};

const idle = (): PhysicsRun => ({ stop: () => {}, finished: Promise.resolve() });
const rnd = gsap.utils.random;

/** Builds `count` pieces within the budget; copies lose ids and stay hidden from assistive technology. */
function spawn(layer: HTMLElement, pieces: Piece[], count: number): HTMLElement[] {
  const total = Math.min(count, budget());
  const made: HTMLElement[] = [];
  for (let i = 0; i < total; i++) {
    const source = pieces[i % pieces.length]!;
    let piece: HTMLElement;
    if (typeof source === "string") {
      piece = document.createElement("span");
      piece.textContent = source;
    } else {
      piece = source.cloneNode(true) as HTMLElement;
      piece.removeAttribute("id");
      piece.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    }
    piece.setAttribute("aria-hidden", "true");
    made.push(piece);
  }
  layer.append(...made);
  live += made.length;
  return made;
}

/** Runs one timeline over the spawned pieces and removes them when it ends or stops. */
function run(pieces: HTMLElement[], build: (tl: gsap.core.Timeline) => void): PhysicsRun {
  let resolve = () => {};
  const finished = new Promise<void>((done) => (resolve = done));
  let done = false;
  let tl: gsap.core.Timeline | undefined;
  const stop = () => {
    if (done) return;
    done = true;
    tl?.kill();
    pieces.forEach((piece) => piece.remove());
    live -= pieces.length;
    resolve();
  };
  try {
    tl = gsap.timeline({ onComplete: stop });
    build(tl);
  } catch (error) {
    stop();
    throw error;
  }
  return { stop, finished };
}
```

Pieces live in the layer, not the page, so a run never shifts layout or leaves anything in the content to restore. The budget is shared, so a burst on every click of a busy button stays bounded.

## burst

A cone of pieces from a point in viewport coordinates, arcing up and falling away as they fade. `burstFrom` aims it from an element's center.

```ts
export type BurstOptions = PhysicsOptions & {
  /** Direction of the cone's center in degrees: -90 is straight up, 0 is right. */
  angle?: number;
  /** Width of the cone in degrees. */
  spread?: number;
  /** Seconds each piece flies before it is gone. */
  duration?: number;
};

export function burst(
  layer: HTMLElement,
  x: number,
  y: number,
  {
    pieces,
    count = 24,
    velocity = [500, 900],
    gravity = 1200,
    spin = 540,
    scale = [0.7, 1.3],
    angle = -90,
    spread = 70,
    duration = 1.4,
  }: BurstOptions,
): PhysicsRun {
  if (prefersReducedMotion() || !pieces.length) return idle();
  const made = spawn(layer, pieces, count);
  if (!made.length) return idle();
  return run(made, (tl) => {
    made.forEach((piece) => {
      gsap.set(piece, { x, y, xPercent: -50, yPercent: -50, scale: rnd(scale[0], scale[1]), rotation: rnd(-30, 30) });
      const delay = rnd(0, 0.06);
      const flight = duration * rnd(0.8, 1);
      tl.to(
        piece,
        {
          physics2D: { velocity: rnd(velocity[0], velocity[1]), angle: angle + rnd(-spread / 2, spread / 2), gravity },
          rotation: `+=${rnd(-spin, spin)}`,
          duration: flight,
          ease: "none",
        },
        delay,
      );
      // Fade over the last third, so pieces that stay on screen still leave.
      tl.to(piece, { autoAlpha: 0, duration: flight / 3, ease: "power1.in" }, delay + (flight * 2) / 3);
    });
  });
}

export function burstFrom(layer: HTMLElement, element: Element, options: BurstOptions): PhysicsRun {
  const box = element.getBoundingClientRect();
  return burst(layer, box.left + box.width / 2, box.top + box.height / 2, options);
}
```

## rain

Pieces drop from above the layer at random points across its width, spread over `period` seconds, and fall out the bottom. Each flight lasts exactly as long as the fall needs.

```ts
export type RainOptions = PhysicsOptions & {
  /** Seconds over which pieces start falling. */
  period?: number;
  /** Most sideways drift from straight down, in degrees. */
  sway?: number;
};

export function rain(
  layer: HTMLElement,
  {
    pieces,
    count = 40,
    velocity = [80, 240],
    gravity = 900,
    spin = 120,
    scale = [0.6, 1.2],
    period = 1.2,
    sway = 8,
  }: RainOptions,
): PhysicsRun {
  if (prefersReducedMotion() || !pieces.length) return idle();
  const made = spawn(layer, pieces, count);
  if (!made.length) return idle();
  const width = layer.clientWidth;
  const height = layer.clientHeight;
  return run(made, (tl) => {
    made.forEach((piece) => {
      const size = Math.max(piece.offsetHeight, 1);
      gsap.set(piece, { x: rnd(0, width), y: -size, xPercent: -50, scale: rnd(scale[0], scale[1]), rotation: rnd(-30, 30) });
      const v = rnd(velocity[0], velocity[1]);
      // Time to fall from above the top edge to below the bottom: y = vt + gt²/2.
      const fall = height + size * 2;
      const flight = (-v + Math.sqrt(v * v + 2 * gravity * fall)) / gravity;
      tl.to(
        piece,
        {
          physics2D: { velocity: v, angle: 90 + rnd(-sway, sway), gravity },
          rotation: `+=${rnd(-spin, spin)}`,
          duration: flight,
          ease: "none",
        },
        rnd(0, period),
      );
    });
  });
}
```

Keep `count` and `period` modest: rain is an accent for a moment, such as a vote landing, not a loop. A repeating rain is ambient motion and needs a pause control.

## pile

Pieces fall into a box and stay: each is a circle as wide as its widest side, stepped by GSAP's ticker with gravity, a bounce off the floor and walls, and a push apart from every neighbor it overlaps. Rolling turns a piece by the distance it travels. Physics2DPlugin has no collisions, so this steps its own. The box is any positioned element that clips, such as a stage; its floor is its bottom edge. Round pieces read truest: dots, emoji, rounded tiles.

```css
.pile-box { position: relative; overflow: hidden; }
.pile-box > * { position: absolute; left: 0; top: 0; will-change: transform; }
```

```ts
export type PileOptions = {
  pieces: Piece[];
  /** Downward pull in px/s². */
  gravity?: number;
  /** Share of speed kept after a hit: 0 is dead, 1 bounces forever. */
  bounce?: number;
  /** Share of sideways speed kept per floor contact step. */
  grip?: number;
  /** The box's top edge is solid too, so pieces thrown up bounce back down instead of leaving and falling in again. */
  ceiling?: boolean;
};

export type Pile = {
  /** Drops pieces in from above the box, around `x` if given, within the shared budget. */
  drop(count: number, x?: number): void;
  /** Throws every piece up and sideways. */
  shake(): void;
  /** Adds one piece, the next in `pieces`, centered at `x`, `y` in the box with a velocity in px/s. */
  launch(x: number, y: number, vx: number, vy: number): void;
  /** The pull the pile was made with, in px/s², so a trajectory preview can match it. */
  readonly gravity: number;
  /** Removes every piece. */
  clear(): void;
  /** Stops stepping and removes every piece. Safe to call twice. */
  stop(): void;
};

type Body = {
  el: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  turn: number;
  /** Frames in a row it has barely moved; past SLEEP it is asleep and skipped until something hits it. */
  still: number;
  set: (x: number, y: number, turn: number) => void;
};

/** Slower than this, in px/s, counts as still. */
const REST_SPEED = 25;
/** Still frames before a piece sleeps. Sleeping stops the buzz of a heap pushing back against gravity. */
const SLEEP = 20;

export function pile(box: HTMLElement, { pieces, gravity = 2600, bounce = 0.42, grip = 0.97, ceiling = false }: PileOptions): Pile {
  if (prefersReducedMotion()) return { drop: () => {}, shake: () => {}, launch: () => {}, clear: () => {}, stop: () => {}, gravity };
  const bodies: Body[] = [];
  let width = box.clientWidth;
  let height = box.clientHeight;
  const resize = new ResizeObserver(() => {
    width = box.clientWidth;
    height = box.clientHeight;
  });
  resize.observe(box);
  const remove = (body: Body) => {
    body.el.remove();
    live -= 1;
  };
  /** Substeps per frame keep fast pieces from passing through each other. */
  const STEPS = 3;
  const step = (_time: number, deltaMs: number) => {
    const h = Math.min(deltaMs, 32) / 1000 / STEPS;
    for (let s = 0; s < STEPS; s++) {
      for (const b of bodies) {
        if (b.still >= SLEEP) continue;
        b.vy += gravity * h;
        b.x += b.vx * h;
        b.y += b.vy * h;
      }
      // Each overlapping pair moves apart by half the overlap each, then trades the speed along the line between them.
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i]!;
          const c = bodies[j]!;
          const aSleeps = a.still >= SLEEP;
          const cSleeps = c.still >= SLEEP;
          if (aSleeps && cSleeps) continue;
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const reach = a.r + c.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= reach * reach || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const closing = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          // A hard hit wakes the heap, so nothing is left asleep in the air when its support moves;
          // a gentle lean onto a sleeper treats it as solid ground.
          if (closing < -REST_SPEED * 4 && (aSleeps || cSleeps)) for (const b of bodies) b.still = 0;
          const aFixed = a.still >= SLEEP;
          const cFixed = c.still >= SLEEP;
          const overlap = reach - d;
          const aShare = aFixed ? 0 : cFixed ? 1 : 0.5;
          const cShare = 1 - aShare;
          a.x -= nx * overlap * aShare;
          a.y -= ny * overlap * aShare;
          c.x += nx * overlap * cShare;
          c.y += ny * overlap * cShare;
          if (closing < 0) {
            const impulse = -(1 + bounce) * closing;
            a.vx -= impulse * nx * aShare;
            a.vy -= impulse * ny * aShare;
            c.vx += impulse * nx * cShare;
            c.vy += impulse * ny * cShare;
          }
        }
      }
      for (const b of bodies) {
        if (b.y + b.r > height) {
          b.y = height - b.r;
          // A small bounce dies, so a resting piece does not buzz on the floor.
          b.vy = b.vy > 60 ? -b.vy * bounce : 0;
          b.vx *= grip;
        }
        if (ceiling && b.y - b.r < 0) {
          b.y = b.r;
          b.vy = Math.abs(b.vy) * bounce;
        }
        if (b.x - b.r < 0) {
          b.x = b.r;
          b.vx = Math.abs(b.vx) * bounce;
        } else if (b.x + b.r > width) {
          b.x = width - b.r;
          b.vx = -Math.abs(b.vx) * bounce;
        }
      }
    }
    for (const b of bodies) {
      if (b.still >= SLEEP) continue;
      b.still = Math.hypot(b.vx, b.vy) < REST_SPEED ? b.still + 1 : 0;
      if (b.still >= SLEEP) b.vx = b.vy = 0;
      b.turn += ((b.vx * h * STEPS) / b.r) * (180 / Math.PI);
      b.set(b.x - b.r, b.y - b.r, b.turn);
    }
  };
  gsap.ticker.add(step);
  let stopped = false;
  let next = 0;
  /** A body for a spawned piece, placed by `at` once its size is known. */
  const add = (el: HTMLElement, at: (r: number) => { x: number; y: number; vx: number; vy: number }) => {
    const r = Math.max(el.offsetWidth, el.offsetHeight) / 2 || 8;
    const setX = gsap.quickSetter(el, "x", "px");
    const setY = gsap.quickSetter(el, "y", "px");
    const setTurn = gsap.quickSetter(el, "rotation", "deg");
    const place = at(r);
    const body: Body = { el, r, ...place, turn: rnd(-30, 30), still: 0, set: (px, py, turn) => (setX(px), setY(py), setTurn(turn)) };
    body.set(body.x - r, body.y - r, body.turn);
    bodies.push(body);
  };
  return {
    gravity,
    drop(count, x) {
      if (stopped) return;
      for (const el of spawn(box, pieces, count)) {
        add(el, (r) => ({
          x: x === undefined ? rnd(r, width - r) : gsap.utils.clamp(r, width - r, x + rnd(-60, 60)),
          y: -r - rnd(0, 200),
          vx: rnd(-80, 80),
          vy: rnd(0, 200),
        }));
      }
    },
    launch(x, y, vx, vy) {
      if (stopped) return;
      const [el] = spawn(box, [pieces[next++ % pieces.length]!], 1);
      if (el) add(el, () => ({ x, y, vx, vy }));
    },
    shake() {
      for (const b of bodies) {
        b.still = 0;
        b.vy -= rnd(700, 1200);
        b.vx += rnd(-350, 350);
      }
    },
    clear() {
      bodies.splice(0).forEach(remove);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      gsap.ticker.remove(step);
      resize.disconnect();
      bodies.splice(0).forEach(remove);
    },
  };
}
```

Pieces in a pile count against the shared budget while they rest, so a full pile makes later bursts spawn fewer; `clear` gives the budget back. Every pair is checked each step, which suits the budget's 120 pieces, not thousands.

## slingshot

Pull a piece back from a launcher and let go: it flies off the opposite way, harder the farther it was pulled, arcs under the pile's gravity, and lands in the pile to bounce and heap. A row of dots previews the arc while aiming. The handle is the app's own button, placed where the launcher sits; the recipe moves it with the pull and springs it back.

Keyboard: the handle is a button, so it takes focus. Arrow keys aim (left and right turn, up and down change the pull), and Enter or Space fires. The dots show the aim while it has focus.

```ts
export type SlingshotOptions = {
  /** Farthest pull, in px. */
  reach?: number;
  /** Launch speed per px of pull, in px/s. */
  power?: number;
  /** Dots in the arc preview. */
  dots?: number;
  /** Called after each launch, such as to update a count. */
  onLaunch?: () => void;
};

export function slingshot(box: HTMLElement, handle: HTMLElement, heap: Pile, { reach = 110, power = 11, dots = 12, onLaunch }: SlingshotOptions = {}): () => void {
  if (prefersReducedMotion()) return () => {};
  const aborter = new AbortController();
  const on = { signal: aborter.signal };
  const touchAction = handle.style.touchAction;
  handle.style.touchAction = "none";
  // The arc preview: small dots in the box, hidden until aiming.
  const marks = Array.from({ length: dots }, () => {
    const dot = document.createElement("i");
    dot.setAttribute("aria-hidden", "true");
    Object.assign(dot.style, { position: "absolute", left: "0", top: "0", width: "6px", height: "6px", margin: "-3px 0 0 -3px", borderRadius: "50%", background: "currentColor", pointerEvents: "none", opacity: "0" });
    box.append(dot);
    return dot;
  });
  // The pull, from the handle's resting center: pointing back from where the shot goes.
  const pull = { x: -0.6 * reach, y: 0.45 * reach };
  let dragging: { id: number; x: number; y: number } | undefined;
  const origin = () => {
    const b = box.getBoundingClientRect();
    const h = handle.getBoundingClientRect();
    const [x, y] = [Number(gsap.getProperty(handle, "x")), Number(gsap.getProperty(handle, "y"))];
    return { x: h.left + h.width / 2 - x - b.left, y: h.top + h.height / 2 - y - b.top };
  };
  const clampPull = (x: number, y: number) => {
    const length = Math.hypot(x, y);
    const p = length > reach ? { x: (x / length) * reach, y: (y / length) * reach } : { x, y };
    // The handle never leaves the box, so it can't be pulled out of sight on a narrow screen.
    const o = origin();
    const r = handle.offsetWidth / 2;
    return {
      x: gsap.utils.clamp(r - o.x, box.clientWidth - r - o.x, p.x),
      y: gsap.utils.clamp(r - o.y, box.clientHeight - r - o.y, p.y),
    };
  };
  const show = (on: boolean) => {
    const o = origin();
    const [sx, sy] = [o.x + pull.x, o.y + pull.y];
    const [vx, vy] = [-pull.x * power, -pull.y * power];
    marks.forEach((dot, i) => {
      const t = (i + 1) * 0.045;
      gsap.set(dot, { x: sx + vx * t, y: sy + vy * t + 0.5 * heap.gravity * t * t, opacity: on ? 0.7 * (1 - i / dots) : 0 });
    });
  };
  const aim = () => {
    gsap.set(handle, { x: pull.x, y: pull.y });
    show(true);
  };
  const fire = () => {
    const o = origin();
    heap.launch(o.x + pull.x, o.y + pull.y, -pull.x * power, -pull.y * power);
    onLaunch?.();
    show(false);
    gsap.fromTo(handle, { x: pull.x, y: pull.y }, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)", overwrite: true });
  };
  handle.addEventListener("pointerdown", (event) => {
    gsap.killTweensOf(handle);
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
    handle.setPointerCapture(event.pointerId);
    Object.assign(pull, clampPull(0, 0));
    aim();
  }, on);
  handle.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== dragging.id) return;
    Object.assign(pull, clampPull(event.clientX - dragging.x, event.clientY - dragging.y));
    aim();
  }, on);
  const release = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== dragging.id) return;
    dragging = undefined;
    // A tap with no pull is not a shot: the handle settles back.
    if (Math.hypot(pull.x, pull.y) < 12) {
      show(false);
      gsap.to(handle, { x: 0, y: 0, duration: 0.3, ease: "power2.out", overwrite: true });
      Object.assign(pull, { x: -0.6 * reach, y: 0.45 * reach });
      return;
    }
    fire();
  };
  handle.addEventListener("pointerup", release, on);
  handle.addEventListener("pointercancel", release, on);
  // The keyboard aims with the arrows and fires with Enter or Space. A click from the keyboard has no pointer, so it fires too.
  handle.addEventListener("keydown", (event) => {
    const angle = Math.atan2(pull.y, pull.x);
    const length = Math.hypot(pull.x, pull.y);
    const turn = event.key === "ArrowLeft" ? -0.12 : event.key === "ArrowRight" ? 0.12 : 0;
    const grow = event.key === "ArrowUp" ? 10 : event.key === "ArrowDown" ? -10 : 0;
    if (turn || grow) {
      event.preventDefault();
      const l = gsap.utils.clamp(20, reach, length + grow);
      Object.assign(pull, clampPull(Math.cos(angle + turn) * l, Math.sin(angle + turn) * l));
      aim();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fire();
    }
  }, on);
  handle.addEventListener("focus", () => handle.matches(":focus-visible") && show(true), on);
  handle.addEventListener("blur", () => !dragging && show(false), on);
  return () => {
    aborter.abort();
    gsap.killTweensOf(handle);
    gsap.set(handle, { clearProps: "x,y,transform" });
    handle.style.touchAction = touchAction;
    marks.forEach((dot) => dot.remove());
  };
}
```

## Wiring

```ts
// Example: confetti from a pressed button, stopped if the page leaves first.
const layer = document.querySelector<HTMLElement>(".physics-layer")!;
const runs = new Set<PhysicsRun>();
button.addEventListener("click", () => {
  const confetti = burstFrom(layer, button, { pieces: ["🎉", "✨", "★"] });
  runs.add(confetti);
  void confetti.finished.then(() => runs.delete(confetti));
});
// At unmount or navigation start:
runs.forEach((confetti) => confetti.stop());
```

## Controller contract

| Builder | Create | Returns | Reduced motion |
|---|---|---|---|
| `burst`, `burstFrom` | From an interaction, after the control has done its job | `{ stop, finished }` | Spawns nothing; `finished` is already resolved |
| `rain` | From an interaction or a settled page | `{ stop, finished }` | Spawns nothing; `finished` is already resolved |
| `pile` | Once the box is mounted and sized | `{ drop, shake, launch, clear, stop, gravity }` | Every call does nothing; no pieces, no ticker |
| `slingshot` | Settled, with a pile and its handle mounted | Teardown | Does nothing; the handle is an ordinary button |

- The layer belongs to the persistent shell; a run never creates or removes it.
- Never gate an action on `finished`: navigation, submission, and focus move on at once.
- Stop live runs when navigation starts, so pieces never fall over the next page. Stop a pile at unmount; it steps every frame until then.
- Pieces are `aria-hidden` decoration. Say the event in text if it matters, such as "Added to cart".
