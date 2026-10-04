# Recipe: particle field

A canvas bleeding past a target, stepped by the GSAP ticker only while it has something to draw and is on screen. Drive particles with emitters (run each frame), per-particle `update` hooks, or GSAP tweens on the particle objects.

Lifecycle: `attachParticleEffect` binds a field to a target for a component's life; the framework controller calls its [controls](#controller-contract) per phase. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`.

## Markup

The canvas shares a wrapper with the target, offset by the effect's bleed, `aria-hidden`, and `pointer-events: none`. It draws in its computed `color`, inherited by default; set an existing brand color if contrast needs it. Stack it above the target for `layer: "over"`, below for `"under"`.

```html
<div class="relative isolate" data-particle-button>
  <canvas aria-hidden="true" class="pointer-events-none absolute z-10 text-inherit" style="left:-180px; top:-180px"></canvas>
  <button class="relative z-20 …">Continue</button>
</div>
```

Plain CSS for the classes above (under layer):

```css
[data-particle-button] { position: relative; isolation: isolate; }
[data-particle-button] canvas {
  pointer-events: none; position: absolute; z-index: 10; color: inherit;
}
[data-particle-button] button { position: relative; z-index: 20; }
```

## field.ts

```ts
import gsap from "gsap";

export type Shape = "dot" | "spark" | "ring" | "square" | "star" | "outline" | "streak";

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Radius for dots and rings, half-width for squares, stroke width for sparks, half-length for streaks, spread for outlines. */
  size: number;
  alpha: number;
  shape: Shape;
  rotation: number;
  /** Radians per second. */
  spin: number;
  /** Fraction of velocity kept after one second. 1 keeps it all. */
  drag: number;
  /** Pixels per second squared, downward positive. */
  gravity: number;
  /** Total seconds to live, or Infinity while something else owns the particle. */
  life: number;
  age: number;
  /** Alpha falls to zero over the particle's life. */
  fade: boolean;
  /** Size falls to zero over the particle's life. */
  shrink: boolean;
  /** Sideways sway: amplitude in px/s and frequency in Hz. */
  wobble: number;
  wobbleFreq: number;
  phase: number;
  update?: (p: Particle, dt: number, time: number) => void;
};

export type Box = { x: number; y: number; w: number; h: number };
export type Emitter = (dt: number, time: number) => void;

const DEFAULTS: Omit<Particle, "x" | "y"> = {
  vx: 0, vy: 0, size: 2, alpha: 1, shape: "dot", rotation: 0, spin: 0, drag: 1, gravity: 0,
  life: 1, age: 0, fade: true, shrink: false, wobble: 0, wobbleFreq: 0, phase: 0,
};

/** Longest step the simulation will take, so a stalled tab does not fling everything off screen. */
const MAX_STEP = 0.05;

export class ParticleField {
  readonly canvas: HTMLCanvasElement;
  readonly particles: Particle[] = [];
  readonly emitters = new Set<Emitter>();
  /** The target element's rectangle, in canvas CSS pixels. */
  readonly box: Box = { x: 0, y: 0, w: 0, h: 0 };
  /** Corner radius of the target, read from its computed style. */
  radius = 0;
  color = "#000";
  time = 0;
  /** Transient particle budget; outlines and owned particles are exempt. */
  density = 1;

  private readonly ctx: CanvasRenderingContext2D;
  private readonly target: HTMLElement;
  private readonly bleed: number;
  private width = 0;
  private height = 0;
  private running = false;
  private onScreen = true;
  private paused = false;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement, target: HTMLElement, bleed: number) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("ParticleField needs a 2d canvas context");
    this.canvas = canvas;
    this.ctx = ctx;
    this.target = target;
    this.bleed = bleed;
    this.sync();
  }

  /** Re-measure the target and resize the canvas around it. */
  sync(): void {
    if (this.destroyed) return;
    const { offsetWidth: w, offsetHeight: h } = this.target;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = w + this.bleed * 2;
    this.height = h + this.bleed * 2;
    this.box.x = this.bleed;
    this.box.y = this.bleed;
    this.box.w = w;
    this.box.h = h;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.radius = parseFloat(getComputedStyle(this.target).borderTopLeftRadius) || 0;
    this.recolor();
  }

  /** Re-read the particle colour from the canvas's computed `color`, without resizing or clearing. */
  recolor(): void {
    this.color = getComputedStyle(this.canvas).color;
  }

  spawn(init: Partial<Particle> & { x: number; y: number }): Particle {
    const p: Particle = { ...DEFAULTS, ...init };
    if (this.destroyed) return p;
    const structural = p.life === Infinity || p.shape === "outline";
    if (!structural && this.density < 1 && Math.random() > this.density) return p;
    this.particles.push(p);
    this.start();
    return p;
  }

  /** Let every managed particle finish within `within` seconds. */
  release(within = 0.3): void {
    for (const p of this.particles) {
      if (p.life === Infinity || p.life - p.age > within) {
        p.life = p.age + within;
        p.fade = true;
      }
    }
  }

  /** Let particles an interrupted tween still owns (`life: Infinity`) fade out within `within` seconds. */
  releaseOwned(within = 0.3): void {
    for (const p of this.particles) {
      if (p.life === Infinity) {
        p.life = p.age + within;
        p.fade = true;
      }
    }
  }

  addEmitter(emitter: Emitter): void {
    if (this.destroyed) return;
    this.emitters.add(emitter);
    this.start();
  }
  removeEmitter(emitter: Emitter): void { this.emitters.delete(emitter); }

  setOnScreen(onScreen: boolean): void {
    this.onScreen = onScreen;
    if (onScreen) this.start(); else this.stop();
  }

  /** Holds the field still, as last drawn, until unpaused. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.stop(); else this.start();
  }

  start(): void {
    if (this.destroyed || this.paused || this.running || !this.onScreen) return;
    if (this.particles.length === 0 && this.emitters.size === 0) return;
    this.running = true;
    gsap.ticker.add(this.tick);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    gsap.ticker.remove(this.tick);
  }

  /** Stops for good: spawns, emitters, and delayed callbacks that arrive later draw nothing. */
  destroy(): void {
    this.destroyed = true;
    this.stop();
    this.emitters.clear();
    this.particles.length = 0;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  private readonly tick = (_time: number, deltaMs: number) => {
    const dt = Math.min(deltaMs / 1000, MAX_STEP);
    this.time += dt;
    for (const emitter of this.emitters) emitter(dt, this.time);
    this.step(dt);
    this.draw();
    if (this.particles.length === 0 && this.emitters.size === 0) this.stop();
  };

  private step(dt: number): void {
    const list = this.particles;
    let keep = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!;
      p.age += dt;
      if (p.age >= p.life) continue;
      if (p.drag !== 1) {
        const keepVelocity = Math.pow(p.drag, dt);
        p.vx *= keepVelocity;
        p.vy *= keepVelocity;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.wobble !== 0) p.x += Math.sin(this.time * p.wobbleFreq * Math.PI * 2 + p.phase) * p.wobble * dt;
      p.rotation += p.spin * dt;
      p.update?.(p, dt, this.time);
      list[keep++] = p;
    }
    list.length = keep;
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;
    ctx.lineCap = "round";
    for (const p of this.particles) {
      const progress = p.life === Infinity ? 0 : p.age / p.life;
      const alpha = p.alpha * (p.fade ? 1 - progress : 1);
      const size = p.size * (p.shrink ? 1 - progress : 1);
      if (alpha <= 0.005 || size <= 0.05) continue;
      ctx.globalAlpha = Math.min(alpha, 1);
      switch (p.shape) {
        case "dot":
          ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
          break;
        case "ring":
          ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.stroke();
          break;
        case "spark": {
          // A streak trailing the direction of travel; a still spark is a dot.
          const speed = Math.hypot(p.vx, p.vy);
          if (speed < 1) { ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill(); break; }
          const tail = Math.min(speed * 0.04, 18);
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - (p.vx / speed) * tail, p.y - (p.vy / speed) * tail);
          ctx.stroke();
          break;
        }
        case "streak":
          // A level hairline, centred on the particle.
          ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x - size, p.y); ctx.lineTo(p.x + size, p.y); ctx.stroke();
          break;
        case "square":
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
          ctx.fillRect(-size, -size, size * 2, size * 2);
          ctx.restore();
          break;
        case "star":
          // Four thin rays crossing at the centre, like a lens glint.
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
          ctx.lineWidth = 1; ctx.beginPath();
          ctx.moveTo(-size, 0); ctx.lineTo(size, 0); ctx.moveTo(0, -size); ctx.lineTo(0, size);
          ctx.stroke(); ctx.restore();
          break;
        case "outline": {
          // The target's rounded rectangle, pushed outward by `size`.
          const { x, y, w, h } = this.box;
          ctx.lineWidth = 1.5; ctx.beginPath();
          ctx.roundRect(x - size, y - size, w + size * 2, h + size * 2, this.radius + size);
          ctx.stroke();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}

export type EdgePoint = { x: number; y: number; nx: number; ny: number };

/** Length of a rounded rectangle's outline. */
export function perimeterLength(box: Box, radius: number): number {
  const r = Math.min(radius, box.w / 2, box.h / 2);
  return 2 * (box.w - 2 * r) + 2 * (box.h - 2 * r) + 2 * Math.PI * r;
}

/** A point on a rounded rectangle's outline at `t` in [0, 1), clockwise from the top-left corner, with the outward normal. */
export function perimeterPoint(box: Box, radius: number, t: number): EdgePoint {
  const r = Math.min(radius, box.w / 2, box.h / 2);
  const { x, y, w, h } = box;
  const sw = w - 2 * r;
  const sh = h - 2 * r;
  const arc = (Math.PI * r) / 2;
  const total = 2 * sw + 2 * sh + 4 * arc;
  let d = (((t % 1) + 1) % 1) * total;

  if (d < sw) return { x: x + r + d, y, nx: 0, ny: -1 };
  d -= sw;
  if (d < arc) { const a = -Math.PI / 2 + d / r; return { x: x + w - r + Math.cos(a) * r, y: y + r + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) }; }
  d -= arc;
  if (d < sh) return { x: x + w, y: y + r + d, nx: 1, ny: 0 };
  d -= sh;
  if (d < arc) { const a = d / r; return { x: x + w - r + Math.cos(a) * r, y: y + h - r + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) }; }
  d -= arc;
  if (d < sw) return { x: x + w - r - d, y: y + h, nx: 0, ny: 1 };
  d -= sw;
  if (d < arc) { const a = Math.PI / 2 + d / r; return { x: x + r + Math.cos(a) * r, y: y + h - r + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) }; }
  d -= arc;
  if (d < sh) return { x, y: y + h - r - d, nx: -1, ny: 0 };
  d -= sh;
  const a = Math.PI + d / r;
  return { x: x + r + Math.cos(a) * r, y: y + r + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) };
}
```

## attach.ts

Sizes the field, follows theme changes, pauses off screen, and merges hover, keyboard focus, and touch presses into one hot state.

```ts
import gsap from "gsap";
import { ParticleField } from "./field";

/* Swap for the project's helper if it has one. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Editable coarse-pointer budget. 1 keeps all transient particles. */
export const COARSE_POINTER_DENSITY = 0.6;

/** Inline properties the entrance, exit, and hover states write on the target; destroy puts them back. */
const TARGET_PROPS = ["opacity", "visibility", "transform", "translate", "rotate", "scale", "transform-origin", "clip-path"];

/** Records inline properties and returns a restore that also resets GSAP's cached transform. */
function snapshotStyles(element: HTMLElement, props: string[]): () => void {
  const hadStyle = element.hasAttribute("style");
  const saved = props.map((prop) => [element.style.getPropertyValue(prop), element.style.getPropertyPriority(prop)] as const);
  return () => {
    gsap.set(element, { clearProps: props.join(",") });
    props.forEach((prop, i) => {
      const [value, priority] = saved[i] ?? ["", ""];
      if (value) element.style.setProperty(prop, value, priority);
      else element.style.removeProperty(prop);
    });
    if (!hadStyle && !element.style.length) element.removeAttribute("style");
  };
}

type Register = (fn: () => void) => void;

/** Roll back partial construction and attempt every cleanup, even if one throws. */
function own(setup: (dispose: Register, after: Register) => void): () => void {
  const ctx = gsap.context(() => {});
  const disposers: Array<() => void> = [];
  const restores: Array<() => void> = [];
  let done = false;
  const teardown = () => {
    if (done) return;
    done = true;
    let failure: unknown;
    const attempt = (fn: () => void) => {
      try { fn(); } catch (error) { failure ??= error; }
    };
    disposers.splice(0).reverse().forEach(attempt);
    attempt(() => ctx.revert());
    restores.splice(0).reverse().forEach(attempt);
    if (failure) throw failure;
  };
  let failure: { error: unknown } | undefined;
  // Catch inside add so GSAP always restores its previous global context.
  ctx.add(() => {
    try { setup((fn) => disposers.push(fn), (fn) => restores.push(fn)); }
    catch (error) { failure = { error }; }
  });
  if (failure) {
    try { teardown(); } catch { /* Preserve the construction error after attempting every restore. */ }
    throw failure.error;
  }
  return teardown;
}

/** Focus visibility alone does not identify keyboard input. */
function isFocusVisible(el: Element): boolean {
  try { return el.matches(":focus-visible"); } catch { return true; }
}

export type ParticleEffectInstance = {
  /** Builds the entrance, starting after `delay` seconds. The timeline reveals the target itself. */
  enter(delay: number): gsap.core.Timeline;
  /** Stops the ambient loop and lets the particles die. */
  exit(): void;
  /** Everything at once: the biggest burst the effect has, then silence. */
  blast(): void;
  /** Restarts the ambient loop after an exit or blast. */
  idle(): void;
  /** Intensifies the effect while hovered, keyboard-focused, or touch-pressed. */
  hover(on: boolean): void;
  destroy(): void;
};

export type ParticleEffectDefinition<Instance extends ParticleEffectInstance = ParticleEffectInstance> = {
  /** Whether the canvas sits under or over the target. */
  layer?: "under" | "over";
  /** How far the canvas extends past the target on each side, in px. */
  bleed: number;
  create(field: ParticleField, target: HTMLElement): Instance;
};

export type ParticleEffectControls = {
  enter(delay?: number): void;
  exit(): void;
  blast(): void;
  idle(): void;
  /** Holds the particles still, as drawn, for the page's pause control. */
  pause(): void;
  /** Resumes after `pause`. */
  play(): void;
  /** Tear everything down. Call on unmount. */
  destroy(): void;
};

export function attachParticleEffect(
  root: HTMLElement,
  canvas: HTMLCanvasElement,
  target: HTMLElement,
  effect: ParticleEffectDefinition,
): ParticleEffectControls {
  let destroyed = false;
  let controls!: ParticleEffectControls;
  const revert = own((dispose, after) => {
    const restoreTarget = snapshotStyles(target, TARGET_PROPS);
    after(restoreTarget);
    const canvasState = ["width", "height", "style"].map((name) => [name, canvas.getAttribute(name)] as const);
    after(() => canvasState.forEach(([name, value]) => {
      if (value === null) canvas.removeAttribute(name);
      else canvas.setAttribute(name, value);
    }));
    const field = new ParticleField(canvas, target, effect.bleed);
    dispose(() => field.destroy());
    const instance = effect.create(field, target);
    dispose(() => instance.destroy());
    let entrance: gsap.core.Timeline | null = null;
    /** An entrance a blast cut short; the next idle lands the target where it ends. */
    let unfinished: gsap.core.Timeline | null = null;
    let fade: gsap.core.Tween | null = null;
    let ready = false;

    /** Stops the entrance. Particles its tweens still own fade out instead of hanging in place forever. */
    const cutEntrance = () => {
      const cut = entrance && entrance.progress() < 1 ? entrance : null;
      entrance?.kill();
      entrance = null;
      field.releaseOwned();
      return cut;
    };

    const resize = new ResizeObserver(() => field.sync());
    dispose(() => resize.disconnect());
    resize.observe(target);
    // Theme changes land on <html> or follow the system scheme; re-read the colour without clearing the canvas.
    const recolor = () => field.recolor();
    const theme = new MutationObserver(recolor);
    dispose(() => theme.disconnect());
    theme.observe(document.documentElement, { attributes: true });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    dispose(() => scheme.removeEventListener("change", recolor));
    scheme.addEventListener("change", recolor);
    const visibility = new IntersectionObserver(([entry]) => field.setOnScreen(entry?.isIntersecting ?? true));
    dispose(() => visibility.disconnect());
    visibility.observe(root);
    // Re-evaluate when the primary pointer changes.
    const coarse = window.matchMedia("(pointer: coarse)");
    const applyDensity = () => { field.density = coarse.matches ? COARSE_POINTER_DENSITY : 1; };
    applyDensity();
    dispose(() => coarse.removeEventListener("change", applyDensity));
    coarse.addEventListener("change", applyDensity);

    const listeners = new AbortController();
    dispose(() => listeners.abort());
    const { signal } = listeners;
    let keyboardInput = false;
    let hovering = false;
    let pressing = false;
    let hot = false;
    const syncHot = () => {
      if (!ready) return;
      const focused = keyboardInput && document.activeElement === target && isFocusVisible(target);
      const on = !prefersReducedMotion() && (hovering || pressing || focused);
      if (on === hot) return;
      hot = on;
      instance.hover(on);
    };
    // Capture modality before focus fires, including focus after touch release.
    document.addEventListener("pointerdown", () => { keyboardInput = false; syncHot(); }, { capture: true, signal });
    document.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || ["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      keyboardInput = true;
      syncHot();
    }, { capture: true, signal });
    target.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "touch") { hovering = true; syncHot(); }
    }, { signal });
    target.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") { pressing = true; syncHot(); }
    }, { signal });
    target.addEventListener("pointerup", (e) => {
      if (e.pointerType === "touch") { pressing = false; syncHot(); }
    }, { signal });
    const release = (e: PointerEvent) => {
      if (e.pointerType === "touch") pressing = false; else hovering = false;
      syncHot();
    };
    target.addEventListener("pointercancel", release, { signal });
    target.addEventListener("pointerleave", release, { signal });
    target.addEventListener("focus", syncHot, { signal });
    target.addEventListener("blur", syncHot, { signal });

    dispose(() => {
      destroyed = true;
      ready = false;
      entrance?.kill();
      entrance = null;
      unfinished = null;
      fade?.kill();
    });
    controls = {
      enter(delay = 0) {
        if (destroyed) return;
        entrance?.kill();
        unfinished = null;
        if (prefersReducedMotion()) {
          gsap.set(target, { autoAlpha: 1, clearProps: "transform" });
          ready = true;
          return;
        }
        entrance = instance.enter(delay);
        entrance.eventCallback("onComplete", () => { ready = true; syncHot(); });
      },
      exit() {
        if (destroyed) return;
        ready = false;
        cutEntrance();
        unfinished = null;
        instance.exit();
        fade = gsap.to(target, { autoAlpha: 0, duration: prefersReducedMotion() ? 0 : 0.2, overwrite: "auto" });
      },
      blast() {
        if (destroyed) return;
        ready = false;
        unfinished = cutEntrance() ?? unfinished;
        if (!prefersReducedMotion()) instance.blast();
      },
      idle() {
        if (destroyed) return;
        // Land a cut-short entrance's end state (target shown, unclipped) without replaying its bursts.
        unfinished?.progress(1, true);
        unfinished = null;
        if (!prefersReducedMotion()) instance.idle();
        ready = true;
        syncHot();
      },
      pause() {
        if (destroyed) return;
        field.setPaused(true);
      },
      play() {
        if (destroyed) return;
        field.setPaused(false);
      },
      destroy: () => revert(),
    };
  });
  return controls;
}
```

## Controller contract

`attachParticleEffect(wrapper, canvas, target, effect)` returns void controls: `enter`, `exit`, `blast`, `idle`, `pause`, `play`, and `destroy`. They drive a surface, not navigation completion. The framework controller owns their GSAP context.

- `enter` prepares the target. Reveal a hidden wrapper separately so its canvas shows while the target assembles.
- `exit` or `blast` mid-entrance stops it and fades the particles it steered. A later `idle` lands the entrance's end state without replaying its bursts.
- Idle loops need a user pause (WCAG 2.2.2): wire the page's pause control or motion setting to `pause` and `play`, which freeze particles without hiding the target.
- `destroy` releases observers, listeners, timelines, and the ticker, and restores the target's inline properties and priorities and the canvas's width, height, and style attributes. Construction failures roll back the same resources. Cleanup attempts every step even if a treatment's `destroy` throws; repeated teardown and later controls do nothing.

## Input and density

- Hover uses `pointerType`; touch presses end on `pointerup`, `pointercancel`, or `pointerleave`. The controller owns click blasts.
- Keyboard focus requires keyboard input and `:focus-visible`. Text fields match `:focus-visible` after taps too.
- Programmatic focus follows the last input modality. Pointer-derived focus stays cold; keyboard-derived focus remains accessible.
- `COARSE_POINTER_DENSITY` thins transient particles. Outlines and `life: Infinity` particles are exempt; runner counts stay unchanged.
- Reduced motion blocks hot activation. Unchanged input states do not repeat bursts.
