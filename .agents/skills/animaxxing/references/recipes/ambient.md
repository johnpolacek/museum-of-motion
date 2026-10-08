# Recipe: pulse and ambient

Two kinds of repeated motion. A pulse is a beat that draws the eye to one thing and then rests: a ring spreading from a live dot, a heart that thumps twice, a badge that bumps when its count changes. Ambient motion keeps going while nothing else happens: shapes that float, wander, breathe, or circle. Both use only transforms and opacity, on the app's own markup.

Pulses play a few beats and stop, so they need no controls. Ambient loops never start on their own: `watch` plays them while their section is on screen and the visitor has not paused them, and drives the pause button that any loop longer than five seconds needs.

Lifecycle: see the [controller contract](#controller-contract); the controller calls each `revert` on unmount. Partial setup rolls back per [effect restoration](../effect-restoration.md).

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

export type Teardown = () => void;
/** A pulse: its beats as one timeline, a way to beat again, and its undo. */
export type Pulse = { timeline: gsap.core.Timeline; again(): void; revert: Teardown };
/** An ambient loop. It starts paused; `watch` plays it. */
export type Loop = { play(): void; pause(): void; revert: Teardown };

/** A small seeded random, so a loop's wandering is the same on every visit. */
function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296;
}

/** Reduced motion: a pulse that does nothing. */
const none = (): Pulse => ({ timeline: gsap.timeline(), again() {}, revert() {} });
```

## ping

Rings spread from a dot and fade, a few times, then rest: a live indicator, a new item, a recording light. The rings are added behind the dot and take its color, so style the dot and the rings follow. The dot needs `position: relative` or any position the rings can sit in.

```ts
export type PingOptions = {
  /** Beats before it rests. */
  beats?: number;
  /** Seconds between beats. */
  every?: number;
  /** How far a ring spreads, as a multiple of the dot's size. */
  spread?: number;
};

export function ping(dot: HTMLElement, { beats = 3, every = 1.4, spread = 3 }: PingOptions = {}): Pulse {
  if (prefersReducedMotion()) return none();
  const rings = [0, 1].map(() => {
    const ring = document.createElement("span");
    ring.setAttribute("aria-hidden", "true");
    ring.style.cssText = "position:absolute;inset:0;border-radius:50%;border:2px solid currentColor;pointer-events:none;opacity:0";
    dot.append(ring);
    return ring;
  });
  const position = dot.style.position;
  if (getComputedStyle(dot).position === "static") dot.style.position = "relative";
  let timeline = gsap.timeline();
  const build = () => {
    timeline.kill();
    timeline = gsap.timeline();
    for (let i = 0; i < beats; i++) {
      // Two rings a beat, the second a little behind, so the spread reads as a wave.
      rings.forEach((ring, k) =>
        timeline.fromTo(ring, { scale: 1, opacity: 0.7 }, { scale: spread, opacity: 0, duration: 1.1, ease: "power2.out", immediateRender: false }, i * every + k * 0.22),
      );
    }
    return timeline;
  };
  build();
  return {
    get timeline() {
      return timeline;
    },
    again: () => void build(),
    revert() {
      timeline.kill();
      rings.forEach((ring) => ring.remove());
      dot.style.position = position;
    },
  };
}
```

## heartbeat

A thump and a smaller echo, the way a heart beats, twice by default: for a like button, a favorite, a call to act now. It scales the element itself, so put it on an element nothing else transforms.

```ts
export type HeartbeatOptions = { beats?: number; strength?: number };

export function heartbeat(element: HTMLElement, { beats = 2, strength = 0.14 }: HeartbeatOptions = {}): Pulse {
  if (prefersReducedMotion()) return none();
  let timeline = gsap.timeline();
  const build = () => {
    timeline.kill();
    timeline = gsap.timeline({ onComplete: () => void gsap.set(element, { clearProps: "scale,transform" }) });
    for (let i = 0; i < beats; i++) {
      const at = i * 0.9;
      timeline
        .to(element, { scale: 1 + strength, duration: 0.11, ease: "power2.out" }, at)
        .to(element, { scale: 1, duration: 0.14, ease: "power2.in" }, at + 0.11)
        .to(element, { scale: 1 + strength * 0.55, duration: 0.1, ease: "power2.out" }, at + 0.25)
        .to(element, { scale: 1, duration: 0.4, ease: "elastic.out(1, 0.5)" }, at + 0.35);
    }
    return timeline;
  };
  build();
  return {
    get timeline() {
      return timeline;
    },
    again: () => void build(),
    revert() {
      timeline.kill();
      gsap.set(element, { clearProps: "scale,transform" });
    },
  };
}
```

## bump

A badge answers a change: it pops and tips as its count goes up. Change the text first, then bump. Give the badge `font-variant-numeric: tabular-nums` and a `min-width` for its widest count, so a new number never changes its size.

```ts
export function bump(badge: HTMLElement): Pulse {
  if (prefersReducedMotion()) return none();
  let timeline = gsap.timeline();
  const build = () => {
    timeline.kill();
    timeline = gsap
      .timeline({ onComplete: () => void gsap.set(badge, { clearProps: "scale,rotate,transform" }) })
      .fromTo(badge, { scale: 1, rotate: 0 }, { scale: 1.35, rotate: -8, duration: 0.14, ease: "power2.out" })
      .to(badge, { scale: 1, rotate: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
    return timeline;
  };
  build();
  return {
    get timeline() {
      return timeline;
    },
    again: () => void build(),
    revert() {
      timeline.kill();
      gsap.set(badge, { clearProps: "scale,rotate,transform" });
    },
  };
}
```

## Ambient loops

Each loop starts paused and ends every cycle where it began, so pausing never leaves a shape stranded and reverting restores the page exactly.

```ts
/** A set of tweens as one loop: paused until played, killed and cleared on revert. */
function loopOf(targets: Element[], tweens: gsap.core.Animation[], props: string): Loop {
  tweens.forEach((tween) => tween.pause());
  return {
    play: () => tweens.forEach((tween) => tween.play()),
    pause: () => tweens.forEach((tween) => tween.pause()),
    revert() {
      tweens.forEach((tween) => tween.kill());
      gsap.set(targets, { clearProps: props });
    },
  };
}

export type FloatOptions = { distance?: number; tilt?: number; duration?: number };

/** Each target bobs and sways gently, out of step with the others. */
export function float(targets: HTMLElement[], { distance = 10, tilt = 2, duration = 3.4 }: FloatOptions = {}): Loop {
  const random = seeded(targets.length * 31 + 7);
  const tweens = targets.flatMap((target) => {
    const offset = random() * duration;
    return [
      gsap.fromTo(target, { y: -distance / 2 }, { y: distance / 2, duration, ease: "sine.inOut", yoyo: true, repeat: -1 }).progress(offset / duration),
      gsap.fromTo(target, { rotate: -tilt }, { rotate: tilt, duration: duration * 1.3, ease: "sine.inOut", yoyo: true, repeat: -1 }).progress(random()),
    ];
  });
  return loopOf(targets, tweens, "y,rotate,transform");
}

export type BreatheOptions = { scale?: number; duration?: number };

/** A slow swell and settle, four seconds in and four out by default: the pace of a calm breath. */
export function breathe(targets: HTMLElement[], { scale = 1.08, duration = 4 }: BreatheOptions = {}): Loop {
  const tweens = targets.map((target, i) =>
    gsap.fromTo(target, { scale: 1 }, { scale, duration, ease: "sine.inOut", yoyo: true, repeat: -1, delay: i * 0.3 }),
  );
  return loopOf(targets, tweens, "scale,transform");
}

export type OrbitOptions = { radius?: number; duration?: number; tilt?: number };

/**
 * Marks circle a center, evenly spaced. Place every mark at the center in CSS; the loop moves it out along
 * its path. `tilt` squashes the circle into an ellipse, as if seen at an angle.
 */
export function orbit(marks: HTMLElement[], { radius = 120, duration = 14, tilt = 1 }: OrbitOptions = {}): Loop {
  const setters = marks.map((mark) => ({ x: gsap.quickSetter(mark, "x", "px"), y: gsap.quickSetter(mark, "y", "px") }));
  let turn = 0;
  // A setter, so a seek or a pause anywhere places every mark exactly.
  const state = {
    get turn() {
      return turn;
    },
    set turn(value: number) {
      turn = value;
      setters.forEach((set, i) => {
        const angle = (value + i / marks.length) * Math.PI * 2;
        set.x(Math.cos(angle) * radius);
        set.y(Math.sin(angle) * radius * tilt);
      });
    },
  };
  state.turn = 0;
  return loopOf(marks, [gsap.to(state, { turn: 1, duration, ease: "none", repeat: -1 })], "x,y,transform");
}

export type DriftOptions = { speed?: number; seed?: number };

/**
 * Items wander slowly inside their field, each from one resting point to the next, never leaving it.
 * Place the items at the field's top left; the loop moves them. `speed` is in pixels a second.
 */
export function drift(field: HTMLElement, items: HTMLElement[], { speed = 18, seed = 3 }: DriftOptions = {}): Loop {
  const random = seeded(seed);
  let playing = false;
  let live = true;
  const legs = new Map<HTMLElement, gsap.core.Tween>();
  const next = (item: HTMLElement) => {
    if (!live) return;
    const room = { x: Math.max(0, field.clientWidth - item.offsetWidth), y: Math.max(0, field.clientHeight - item.offsetHeight) };
    const [x, y] = [random() * room.x, random() * room.y];
    const from = { x: Number(gsap.getProperty(item, "x")), y: Number(gsap.getProperty(item, "y")) };
    const duration = Math.max(1.5, Math.hypot(x - from.x, y - from.y) / speed);
    const leg = gsap.to(item, { x, y, duration, ease: "sine.inOut", paused: !playing, onComplete: () => next(item) });
    legs.set(item, leg);
  };
  // Scattered across the field to start, so nothing begins piled in a corner.
  items.forEach((item) => {
    gsap.set(item, { x: random() * Math.max(0, field.clientWidth - item.offsetWidth), y: random() * Math.max(0, field.clientHeight - item.offsetHeight) });
    next(item);
  });
  return {
    play() {
      playing = true;
      legs.forEach((leg) => leg.play());
    },
    pause() {
      playing = false;
      legs.forEach((leg) => leg.pause());
    },
    revert() {
      live = false;
      legs.forEach((leg) => leg.kill());
      gsap.set(items, { clearProps: "x,y,transform" });
    },
  };
}
```

## watch

Plays loops while their section is on screen and the visitor has not paused them. The pause button shows "Pause" or "Play" and carries `aria-pressed`; its own markup and styling are the app's. Under reduced motion loops never play, and the button is hidden, since there is nothing to pause.

```ts
export type WatchOptions = {
  /** The visitor's pause control. Needed for any loop longer than five seconds. */
  button?: HTMLButtonElement | null;
  /** Labels for the button's two states. */
  labels?: { pause: string; play: string };
};

export function watch(section: Element, loops: Loop[], { button = null, labels = { pause: "Pause", play: "Play" } }: WatchOptions = {}): Teardown {
  const reduced = prefersReducedMotion();
  let held = false;
  let seen = false;
  const sync = () => {
    loops.forEach((loop) => (!reduced && !held && seen ? loop.play() : loop.pause()));
    if (button) {
      button.textContent = held ? labels.play : labels.pause;
      button.setAttribute("aria-pressed", String(held));
    }
  };
  const observer = new IntersectionObserver(([entry]) => {
    seen = !!entry?.isIntersecting;
    sync();
  });
  observer.observe(section);
  const toggle = () => {
    held = !held;
    sync();
  };
  const hidden = button?.hidden ?? false;
  if (button) {
    button.hidden = reduced || hidden;
    button.addEventListener("click", toggle);
  }
  sync();
  return () => {
    observer.disconnect();
    if (button) {
      button.removeEventListener("click", toggle);
      button.hidden = hidden;
      button.removeAttribute("aria-pressed");
    }
    loops.forEach((loop) => loop.revert());
  };
}
```

## Wiring

```ts
// Example: a live dot pings on arrival, a like button beats when pressed, and a hero's shapes float until paused.
const live = ping(document.querySelector<HTMLElement>(".live-dot")!);
const like = document.querySelector<HTMLButtonElement>(".like")!;
let beat = heartbeat(like, { beats: 1 });
like.addEventListener("click", () => beat.again());
const stop = watch(document.querySelector(".hero")!, [float([...document.querySelectorAll<HTMLElement>(".hero .shape")])], {
  button: document.querySelector<HTMLButtonElement>(".hero .pause"),
});
// On unmount:
stop();
beat.revert();
live.revert();
```

## Controller contract

| Builder | Phase | Returns | Reduced motion |
|---|---|---|---|
| `ping`, `heartbeat`, `bump` | Settled, or on the event they answer | `{ timeline, again, revert }` | Empty timeline; no rings |
| `float`, `breathe`, `orbit`, `drift` | Settled, after the intro | `{ play, pause, revert }`, paused | Built, never played |
| `watch` | Settled, with the loops | Teardown that also reverts the loops | Loops stay paused; button hidden |

- One effect per target: a floating or breathing element is not also tilted or entered by another tween while the loop owns its transform. Stop the loops before an outro moves their targets.
- Pulses rest after their beats. A pulse that never stops is ambient motion and needs `watch` and a pause control.
- A heartbeat or bump ends at the element's resting scale and clears what it set.
