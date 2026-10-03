# Recipe: particle effects

Five [particle field](particle-field.md) treatments with entrance, idle, hot, and blast states.

Lifecycle: attach one with `attachParticleEffect`; the framework controller calls its controls per phase ([contract](#controller-contract)). Partial setup rolls back per [effect restoration](../effect-restoration.md).

| Effect | Element | Layer | Bleed | Idle |
|---|---|---|---|---|
| `marquee` | secondary call to action (outline) | over | 160 | six lights chase the outline; glints |
| `reactor` | primary call to action (solid) | under | 180 | embers rise from the button; a slow heartbeat outline |
| `resolve` | card | over | 140 | one light wanders the outline; glints |
| `slipstream` | an onward link (Next →) | over | 160 | hairlines drift past left to right |
| `ignite` | text on a rule: a command, a giant field | over | 200 | embers and glints off the underline |

Dependencies: `gsap`, `./field`, `./attach`.

```ts
import gsap from "gsap";
import { perimeterLength, perimeterPoint, type ParticleField } from "./field";
import type { ParticleEffectDefinition, ParticleEffectInstance } from "./attach";

const rnd = gsap.utils.random;
export type ButtonEffect = ParticleEffectDefinition<ParticleEffectInstance> & { layer: "under" | "over" };
```

## marquee

Lights converge onto the outline, the button pops in with a burst, and runners set off around it.

```ts
const RUNNERS = 6;
/** Runner speed along the outline, px/s. */
const RUNNER_SPEED = 110;
/** How much faster the runners go under the pointer. */
const RUNNER_RUSH = 4;

export const marquee: ButtonEffect = {
  layer: "over",
  bleed: 160,
  create(field, button) {
    const runners: { t: number }[] = [];
    const state = { rush: 1, hovering: false };
    let twinkleIn = 0.4;
    let sprayAcc = 0;

    const ambient = (dt: number) => {
      const { box, radius } = field;
      const total = perimeterLength(box, radius);
      for (const run of runners) {
        run.t = (run.t + (RUNNER_SPEED * state.rush * dt) / total) % 1;
        const pt = perimeterPoint(box, radius, run.t);
        // The head is bright; each frame leaves a dot that fades, so the faster the runner the longer its tail.
        field.spawn({ x: pt.x, y: pt.y, size: 2.8, alpha: 1, life: 0.4 * (0.6 + state.rush / RUNNER_RUSH), shrink: true });
      }
      if (state.hovering) {
        // Sparkler: fine sparks fly off the outline while the pointer is on it.
        sprayAcc += 90 * dt;
        while (sprayAcc >= 1) {
          sprayAcc -= 1;
          const pt = perimeterPoint(box, radius, Math.random());
          const speed = rnd(60, 180);
          const jitter = rnd(-0.6, 0.6);
          field.spawn({
            x: pt.x, y: pt.y,
            vx: (pt.nx + jitter * pt.ny) * speed, vy: (pt.ny - jitter * pt.nx) * speed,
            size: rnd(0.8, 1.6), alpha: rnd(0.6, 1), life: rnd(0.3, 0.7), drag: 0.08, gravity: 60, shape: "spark",
          });
        }
      }
      twinkleIn -= dt;
      if (twinkleIn <= 0) {
        twinkleIn = rnd(0.25, 0.7) / (state.hovering ? 3 : 1);
        twinkle(perimeterPoint(box, radius, Math.random()));
      }
    };

    function twinkle(pt: { x: number; y: number }) {
      const size = rnd(4, 9);
      field.spawn({
        x: pt.x, y: pt.y, size, shape: "star", rotation: rnd(0, Math.PI), spin: rnd(-1.5, 1.5), life: rnd(0.45, 0.8), fade: false,
        update: (p) => { const k = Math.sin((p.age / p.life) * Math.PI); p.size = size * k; p.alpha = k; },
      });
    }

    function idle() {
      runners.length = 0;
      for (let k = 0; k < RUNNERS; k++) runners.push({ t: k / RUNNERS });
      field.addEmitter(ambient);
    }

    function flash(count: number, speed: [number, number]) {
      const { box, radius } = field;
      for (let i = 0; i < count; i++) {
        const pt = perimeterPoint(box, radius, i / count + rnd(-0.01, 0.01));
        const v = rnd(speed[0], speed[1]);
        field.spawn({ x: pt.x, y: pt.y, vx: pt.nx * v, vy: pt.ny * v, size: rnd(1, 2.2), life: rnd(0.35, 0.7), drag: 0.04, shape: "spark" });
      }
    }

    return {
      enter(delay) {
        field.sync();
        field.particles.length = 0;
        runners.length = 0;
        const { box, radius } = field;
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        const tl = gsap.timeline({ delay });
        gsap.set(button, { autoAlpha: 0, scale: 0.5, transformOrigin: "50% 50%" });

        const count = 72;
        for (let i = 0; i < count; i++) {
          const target = perimeterPoint(box, radius, i / count);
          const angle = rnd(0, Math.PI * 2);
          const dist = rnd(180, 340);
          const p = field.spawn({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, size: rnd(1.4, 2.8), alpha: 0, life: Infinity, fade: false });
          tl.to(
            p,
            {
              x: target.x, y: target.y, alpha: 1, duration: rnd(0.55, 0.85), ease: "power3.inOut",
              onComplete: () => { p.life = 0.5; p.age = 0; p.fade = true; p.shrink = true; },
            },
            rnd(0, 0.25),
          );
        }
        tl.to(button, { autoAlpha: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" }, 0.55);
        tl.call(() => { flash(40, [80, 200]); idle(); }, [], 0.95);
        return tl;
      },
      exit() { field.removeEmitter(ambient); runners.length = 0; field.release(0.25); },
      blast() {
        field.removeEmitter(ambient);
        runners.length = 0;
        flash(90, [350, 900]);
        for (let i = 0; i < 12; i++) twinkle(perimeterPoint(field.box, field.radius, Math.random()));
      },
      idle,
      hover(on) {
        state.hovering = on;
        gsap.to(state, { rush: on ? RUNNER_RUSH : 1, duration: on ? 0.35 : 0.8, ease: on ? "power3.out" : "power2.inOut", overwrite: true });
        if (on) flash(36, [120, 260]);
      },
      destroy() { field.removeEmitter(ambient); gsap.killTweensOf(state); },
    };
  },
};
```

## reactor

Sparks spiral into the button, which pops in as a shockwave rebounds outward.

```ts
const EMBER_RATE = { idle: 9, hover: 70 };
const EMBER_RISE = { idle: 55, hover: 220 };
const PULSE_EVERY = 2.6;

export const reactor: ButtonEffect = {
  layer: "under",
  bleed: 180,
  create(field, button) {
    const state = { rate: EMBER_RATE.idle, rise: EMBER_RISE.idle, hovering: false };
    let emberAcc = 0;
    let pulseIn = 1.2;
    let echoes: gsap.core.Tween[] = [];
    let swell: gsap.core.Tween | undefined;

    const ambient = (dt: number) => {
      const { box } = field;
      // Embers start inside the button, hidden behind it, and surface as they rise past its top edge.
      emberAcc += state.rate * dt;
      while (emberAcc >= 1) {
        emberAcc -= 1;
        field.spawn({
          x: box.x + rnd(4, box.w - 4), y: box.y + rnd(2, box.h - 2),
          vx: rnd(-10, 10) * (state.hovering ? 3 : 1), vy: -rnd(state.rise * 0.6, state.rise * 1.3),
          size: rnd(1.2, 2.8), alpha: rnd(0.7, 1), life: rnd(1.1, 2.1), gravity: -12,
          wobble: rnd(6, 16), wobbleFreq: rnd(1.5, 4), phase: rnd(0, Math.PI * 2),
        });
      }
      pulseIn -= dt;
      if (pulseIn <= 0) {
        pulseIn = PULSE_EVERY;
        if (!state.hovering) shockwave(28, 1.3, 0.35);
      }
    };

    function shockwave(spread: number, duration: number, alpha: number) {
      field.spawn({
        x: 0, y: 0, shape: "outline", size: 0, alpha, life: duration,
        update: (p) => { p.size = spread * gsap.parseEase("power2.out")(p.age / p.life); },
      });
    }

    function erupt(count: number, speed: [number, number]) {
      const { box, radius } = field;
      for (let i = 0; i < count; i++) {
        const pt = perimeterPoint(box, radius, Math.random());
        const v = rnd(speed[0], speed[1]);
        const jitter = rnd(-0.5, 0.5);
        const square = Math.random() < 0.35;
        field.spawn({
          x: pt.x, y: pt.y,
          vx: (pt.nx + jitter * pt.ny) * v, vy: (pt.ny - jitter * pt.nx) * v - 40,
          size: square ? rnd(1.5, 3) : rnd(1, 2.4), shape: square ? "square" : "dot",
          rotation: rnd(0, Math.PI), spin: rnd(-12, 12), life: rnd(0.5, 1.1), drag: 0.12, gravity: 320,
        });
      }
    }

    return {
      enter(delay) {
        field.sync();
        field.particles.length = 0;
        const { box } = field;
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        const tl = gsap.timeline({ delay });
        gsap.set(button, { autoAlpha: 0, scale: 0.5, transformOrigin: "50% 50%" });

        const count = 110;
        for (let i = 0; i < count; i++) {
          const orbit = { radius: rnd(200, 320), angle: rnd(0, Math.PI * 2) };
          const landing = { x: rnd(-box.w * 0.4, box.w * 0.4), y: rnd(-box.h * 0.4, box.h * 0.4) };
          const p = field.spawn({ x: cx + Math.cos(orbit.angle) * orbit.radius, y: cy + Math.sin(orbit.angle) * orbit.radius, size: rnd(1, 2.4), alpha: 0, life: Infinity, fade: false, shape: "spark" });
          const turn = rnd(1.2, 2.4) * (Math.random() < 0.5 ? -1 : 1);
          tl.to(
            orbit,
            {
              radius: 0, angle: orbit.angle + turn, duration: rnd(0.6, 0.9), ease: "power3.in",
              onUpdate() {
                const k = 1 - orbit.radius / 320;
                const nx = cx + landing.x * k + Math.cos(orbit.angle) * orbit.radius;
                const ny = cy + landing.y * k + Math.sin(orbit.angle) * orbit.radius;
                // Velocity only orients the spark's tail; position is set here.
                p.vx = (nx - p.x) * 60; p.vy = (ny - p.y) * 60;
                p.x = nx; p.y = ny;
                p.alpha = Math.min(1, this.progress() * 3);
              },
              onComplete: () => { p.life = 0.12; p.age = 0; p.fade = true; p.vx = 0; p.vy = 0; },
            },
            rnd(0, 0.2),
          );
        }
        tl.to(button, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "back.out(2.2)" }, 0.82);
        tl.call(() => { shockwave(60, 0.7, 0.9); erupt(44, [140, 320]); }, [], 0.84);
        tl.call(() => shockwave(90, 0.9, 0.5), [], 0.96);
        tl.call(() => field.addEmitter(ambient), [], 1.05);
        return tl;
      },
      exit() { field.removeEmitter(ambient); field.release(0.25); },
      blast() {
        field.removeEmitter(ambient);
        shockwave(120, 0.6, 1);
        echoes = [gsap.delayedCall(0.08, () => shockwave(160, 0.7, 0.6)), gsap.delayedCall(0.16, () => shockwave(200, 0.8, 0.3))];
        erupt(140, [400, 1000]);
      },
      idle() { field.addEmitter(ambient); },
      hover(on) {
        state.hovering = on;
        gsap.to(state, { rate: on ? EMBER_RATE.hover : EMBER_RATE.idle, rise: on ? EMBER_RISE.hover : EMBER_RISE.idle, duration: on ? 0.3 : 0.9, ease: on ? "power3.out" : "power2.inOut", overwrite: true });
        swell = gsap.to(button, { scale: on ? 1.04 : 1, duration: 0.3, ease: on ? "back.out(2)" : "power2.out", overwrite: "auto" });
        if (on) { shockwave(40, 0.5, 0.8); erupt(56, [160, 360]); }
      },
      destroy() {
        field.removeEmitter(ambient);
        gsap.killTweensOf(state);
        echoes.forEach((echo) => echo.kill());
        swell?.kill();
      },
    };
  },
};
```

## resolve

Particles settle row by row into a dot grid over the card, which fades up beneath as the grid dissolves.

```ts
/** Spacing of the dot grid the card resolves from, in px. */
const GRID = 16;
const CARD_RUNNERS = { idle: 1, hover: 4 };
const CARD_RUNNER_SPEED = { idle: 50, hover: 260 };

export const resolve: ButtonEffect = {
  layer: "over",
  bleed: 140,
  create(field, card) {
    const runners: { t: number }[] = [];
    const state = { speed: CARD_RUNNER_SPEED.idle, hovering: false };
    let glintIn = 0.6;
    let sprayAcc = 0;

    const ambient = (dt: number) => {
      const { box, radius } = field;
      const total = perimeterLength(box, radius);
      for (const run of runners) {
        run.t = (run.t + (state.speed * dt) / total) % 1;
        const pt = perimeterPoint(box, radius, run.t);
        field.spawn({ x: pt.x, y: pt.y, size: state.hovering ? 2.4 : 1.8, life: state.hovering ? 0.45 : 0.6, shrink: true });
      }
      if (state.hovering) {
        sprayAcc += 40 * dt;
        while (sprayAcc >= 1) {
          sprayAcc -= 1;
          const pt = perimeterPoint(box, radius, Math.random());
          const speed = rnd(40, 120);
          field.spawn({ x: pt.x, y: pt.y, vx: pt.nx * speed, vy: pt.ny * speed, size: rnd(0.8, 1.4), life: rnd(0.3, 0.6), drag: 0.1, shape: "spark" });
        }
      }
      glintIn -= dt;
      if (glintIn <= 0) {
        glintIn = rnd(0.6, 1.6) / (state.hovering ? 4 : 1);
        glint(perimeterPoint(box, radius, Math.random()));
      }
    };

    function glint(pt: { x: number; y: number }) {
      const size = rnd(3, 7);
      field.spawn({
        x: pt.x, y: pt.y, size, shape: "star", rotation: rnd(0, Math.PI), spin: rnd(-1, 1), life: rnd(0.4, 0.7), fade: false,
        update: (p) => { const k = Math.sin((p.age / p.life) * Math.PI); p.size = size * k; p.alpha = k; },
      });
    }

    function setRunners(count: number) {
      runners.length = 0;
      for (let k = 0; k < count; k++) runners.push({ t: k / count });
    }

    function flash(count: number, speed: [number, number]) {
      const { box, radius } = field;
      for (let i = 0; i < count; i++) {
        const pt = perimeterPoint(box, radius, i / count + rnd(-0.01, 0.01));
        const v = rnd(speed[0], speed[1]);
        field.spawn({ x: pt.x, y: pt.y, vx: pt.nx * v, vy: pt.ny * v, size: rnd(1, 2), life: rnd(0.3, 0.6), drag: 0.05, shape: "spark" });
      }
    }

    function idle() { setRunners(CARD_RUNNERS.idle); field.addEmitter(ambient); }

    return {
      enter(delay) {
        field.sync();
        field.particles.length = 0;
        runners.length = 0;
        const { box } = field;
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        const tl = gsap.timeline({ delay });
        gsap.set(card, { autoAlpha: 0, scale: 0.94, transformOrigin: "50% 50%" });

        const cols = Math.max(2, Math.floor(box.w / GRID));
        const rows = Math.max(2, Math.floor(box.h / GRID));
        const padX = (box.w - (cols - 1) * GRID) / 2;
        const padY = (box.h - (rows - 1) * GRID) / 2;
        const settle = 0.75;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const tx = box.x + padX + c * GRID;
            const ty = box.y + padY + r * GRID;
            const angle = rnd(0, Math.PI * 2);
            const dist = rnd(160, 420);
            const p = field.spawn({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, size: rnd(1, 1.8), alpha: 0, life: Infinity, fade: false });
            tl.to(
              p,
              {
                x: tx, y: ty, alpha: rnd(0.6, 1), duration: rnd(0.45, 0.7), ease: "power3.inOut",
                onComplete: () => { p.life = 0.45; p.age = 0; p.fade = true; p.shrink = true; },
              },
              (r / rows) * 0.25 + rnd(0, 0.06),
            );
          }
        }
        tl.to(card, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "power3.out" }, settle);
        tl.call(() => { flash(24, [40, 120]); idle(); }, [], settle + 0.25);
        return tl;
      },
      exit() { field.removeEmitter(ambient); runners.length = 0; field.release(0.25); },
      blast() { field.removeEmitter(ambient); runners.length = 0; flash(60, [250, 700]); },
      idle,
      hover(on) {
        state.hovering = on;
        setRunners(on ? CARD_RUNNERS.hover : CARD_RUNNERS.idle);
        gsap.to(state, { speed: on ? CARD_RUNNER_SPEED.hover : CARD_RUNNER_SPEED.idle, duration: on ? 0.3 : 0.7, ease: on ? "power3.out" : "power2.inOut", overwrite: true });
        if (on) flash(28, [80, 200]);
      },
      destroy() { field.removeEmitter(ambient); gsap.killTweensOf(state); },
    };
  },
};
```

In a grid, call `enter(index * 0.09)` at settled so the route's items land first.

## slipstream

Hairlines rush past the link left to right. It arrives through a gust, docks with sparks off the arrow, and leans into the wind when hot.

```ts
const STREAK_RATE = { idle: 5, hover: 60 };
const STREAK_SPEED = { idle: 90, hover: 520 };
/** How far, in px, the link leans into the wind under the pointer. */
const LEAN = 4;

export const slipstream: ButtonEffect = {
  layer: "over",
  bleed: 160,
  create(field, button) {
    const state = { rate: STREAK_RATE.idle, speed: STREAK_SPEED.idle, hovering: false };
    let streakAcc = 0;
    let sparkIn = 1;
    let leaning: gsap.core.Tween | undefined;

    /** One level hairline crossing the band, left to right. */
    function streak(x: number, speed: number, life = rnd(0.5, 0.9), alpha = rnd(0.3, 0.7)) {
      const { box } = field;
      field.spawn({ x, y: box.y + rnd(-6, box.h + 6), vx: speed, size: gsap.utils.clamp(3, 28, speed * 0.04), alpha, life, shape: "streak", shrink: true });
    }

    /** Sparks leaving the arrow's tip at the right edge. */
    function tip(count: number, speed: [number, number]) {
      const { box } = field;
      for (let i = 0; i < count; i++) {
        const v = rnd(speed[0], speed[1]);
        field.spawn({ x: box.x + box.w - 4, y: box.y + box.h / 2 + rnd(-4, 4), vx: v, vy: rnd(-v * 0.18, v * 0.18), size: rnd(0.8, 1.6), life: rnd(0.3, 0.6), drag: 0.1, shape: "spark" });
      }
    }

    const ambient = (dt: number) => {
      const { box } = field;
      streakAcc += state.rate * dt;
      while (streakAcc >= 1) {
        streakAcc -= 1;
        streak(box.x - rnd(20, 120), state.speed * rnd(0.7, 1.3));
      }
      sparkIn -= dt;
      if (sparkIn <= 0) {
        sparkIn = rnd(0.8, 2.2) / (state.hovering ? 8 : 1);
        tip(state.hovering ? 3 : 1, [state.speed, state.speed * 2]);
      }
    };

    function idle() { field.addEmitter(ambient); }

    return {
      enter(delay) {
        field.sync();
        field.particles.length = 0;
        const { box } = field;
        const tl = gsap.timeline({ delay });
        gsap.set(button, { autoAlpha: 0, x: -48 });
        for (let i = 0; i < 44; i++) {
          tl.call(() => streak(box.x - rnd(40, 160), rnd(500, 900), rnd(0.35, 0.6), rnd(0.4, 0.9)), [], rnd(0, 0.35));
        }
        tl.to(button, { autoAlpha: 1, x: 0, duration: 0.55, ease: "power4.out" }, 0.1);
        tl.call(() => { tip(14, [200, 480]); idle(); }, [], 0.5);
        return tl;
      },
      exit() { field.removeEmitter(ambient); field.release(0.25); },
      blast() {
        field.removeEmitter(ambient);
        const { box } = field;
        for (let i = 0; i < 60; i++) streak(box.x + rnd(-80, box.w), rnd(700, 1400), rnd(0.3, 0.6), rnd(0.5, 1));
        tip(50, [500, 1200]);
      },
      idle,
      hover(on) {
        state.hovering = on;
        gsap.to(state, { rate: on ? STREAK_RATE.hover : STREAK_RATE.idle, speed: on ? STREAK_SPEED.hover : STREAK_SPEED.idle, duration: on ? 0.3 : 0.8, ease: on ? "power3.out" : "power2.inOut", overwrite: true });
        leaning = gsap.to(button, { x: on ? LEAN : 0, duration: 0.3, ease: on ? "back.out(2)" : "power2.out", overwrite: "auto" });
        if (on) tip(10, [200, 500]);
      },
      destroy() {
        field.removeEmitter(ambient);
        gsap.killTweensOf(state);
        leaning?.kill();
      },
    };
  },
};
```

On press, call `blast()` and tween the link to `x: 64, autoAlpha: 0` while navigation proceeds.

## ignite

A runner streaks along the rule under a text block, such as an install command or a large field, revealing the text in its wake; `blast()` lights the whole rule. The rule is the target's bottom edge: give the target a bottom border.

```ts
import type { Particle } from "./field";

/** Embers per second off the underline, idle and hot. */
const RULE_EMBER_RATE = { idle: 4, hot: 26 };
/** Seconds between idle glints. */
const GLINT_EVERY: [number, number] = [0.5, 1.4];

export const ignite: ParticleEffectDefinition<ParticleEffectInstance> = {
  bleed: 200,
  create(field: ParticleField, target: HTMLElement) {
    const state = { rate: RULE_EMBER_RATE.idle, hot: false };
    let emberAcc = 0;
    let glintIn = 0.6;

    function baseline(): number {
      const { box } = field;
      return box.y + box.h;
    }

    const ambient = (dt: number) => {
      const { box } = field;
      const y = baseline();
      emberAcc += state.rate * dt;
      while (emberAcc >= 1) {
        emberAcc -= 1;
        field.spawn({
          x: box.x + rnd(0, box.w),
          y: y + rnd(-1, 1),
          vx: rnd(-6, 6),
          vy: -rnd(20, 60) * (state.hot ? 2 : 1),
          size: rnd(0.8, 2),
          alpha: rnd(0.5, 1),
          life: rnd(0.9, 1.8),
          gravity: -10,
          wobble: rnd(4, 12),
          wobbleFreq: rnd(1.5, 3.5),
          phase: rnd(0, Math.PI * 2),
        });
      }
      glintIn -= dt;
      if (glintIn <= 0) {
        glintIn = rnd(GLINT_EVERY[0], GLINT_EVERY[1]) / (state.hot ? 3 : 1);
        glint(box.x + rnd(0, box.w), y);
      }
    };

    function glint(x: number, y: number) {
      const size = rnd(4, 10);
      field.spawn({
        x,
        y,
        size,
        shape: "star",
        rotation: rnd(0, Math.PI),
        spin: rnd(-1.5, 1.5),
        life: rnd(0.4, 0.8),
        fade: false,
        update: (p) => {
          const k = Math.sin((p.age / p.life) * Math.PI);
          p.size = size * k;
          p.alpha = k;
        },
      });
    }

    /** Sparks fanning up and out from a point, as if struck. */
    function strike(x: number, y: number, count: number, speed: [number, number]) {
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + rnd(-1.1, 1.1);
        const v = rnd(speed[0], speed[1]);
        field.spawn({
          x,
          y,
          vx: Math.cos(angle) * v,
          vy: Math.sin(angle) * v,
          size: rnd(0.9, 2.2),
          alpha: rnd(0.7, 1),
          life: rnd(0.35, 0.8),
          drag: 0.06,
          gravity: 420,
          shape: "spark",
        });
      }
      glint(x, y);
    }

    /** A hairline flare that spreads outward along the rule from a point. */
    function ripple(x: number, y: number, reach: number, duration: number) {
      for (const dir of [-1, 1]) {
        field.spawn({
          x,
          y,
          size: 0,
          alpha: 1,
          shape: "streak",
          life: duration,
          update: (p) => {
            const k = gsap.parseEase("power3.out")(p.age / p.life);
            p.size = 6 + reach * k * 0.5;
            p.x = x + dir * reach * k * 0.5;
          },
        });
      }
    }

    function idle() {
      field.addEmitter(ambient);
    }

    return {
      enter(delay) {
        field.sync();
        field.particles.length = 0;
        const { box } = field;
        const y = baseline();
        const tl = gsap.timeline({ delay });
        gsap.set(target, { autoAlpha: 0, clipPath: "inset(-20% 100% -20% 0)" });

        // The runner reveals the text behind it and kicks up sparks.
        const run = { x: box.x };
        let head: Particle | null = null;
        tl.set(target, { autoAlpha: 1 }, 0);
        tl.to(
          run,
          {
            x: box.x + box.w,
            duration: 0.7,
            ease: "power2.inOut",
            onStart() {
              head = field.spawn({
                x: box.x,
                y,
                size: 2.6,
                alpha: 1,
                life: Infinity,
                fade: false,
                shape: "spark",
              });
            },
            onUpdate() {
              if (!head) {
                return;
              }
              head.vx = (run.x - head.x) * 60;
              head.x = run.x;
              for (let i = 0; i < 3; i++) {
                field.spawn({
                  x: run.x + rnd(-6, 0),
                  y: y + rnd(-1, 1),
                  vx: -rnd(20, 120),
                  vy: -rnd(20, 140),
                  size: rnd(0.8, 1.8),
                  life: rnd(0.3, 0.7),
                  drag: 0.08,
                  gravity: 240,
                  shape: "spark",
                });
              }
              gsap.set(target, {
                clipPath: `inset(-20% ${(1 - this.progress()) * 100}% -20% 0)`,
              });
            },
            onComplete: () => {
              if (head) {
                head.life = 0.1;
                head.age = 0;
                head.fade = true;
                head.vx = 0;
              }
            },
          },
          0,
        );
        tl.set(target, { clearProps: "clipPath" }, 0.72);
        tl.call(
          () => {
            ripple(box.x + box.w, y, 240, 0.5);
            for (let i = 0; i < 6; i++) {
              glint(box.x + rnd(0, box.w), y);
            }
            idle();
          },
          [],
          0.72,
        );
        return tl;
      },
      exit() {
        field.removeEmitter(ambient);
        field.release(0.25);
      },
      blast() {
        field.removeEmitter(ambient);
        const { box } = field;
        const y = baseline();
        // The rule lights end to end and the command is thrown skyward.
        for (let i = 0; i < 6; i++) {
          ripple(box.x + rnd(0, box.w), y, 300, 0.6);
        }
        const columns = Math.max(6, Math.round(box.w / 18));
        for (let i = 0; i <= columns; i++) {
          const x = box.x + (box.w * i) / columns;
          strike(x, y - rnd(0, box.h * 0.6), 9, [260, 720]);
        }
        strike(box.x + box.w, y, 40, [300, 900]);
        for (let i = 0; i < 14; i++) {
          glint(box.x + rnd(0, box.w), y + rnd(-box.h, 0));
        }
      },
      idle,
      hover(on) {
        state.hot = on;
        gsap.to(state, {
          rate: on ? RULE_EMBER_RATE.hot : RULE_EMBER_RATE.idle,
          duration: on ? 0.3 : 0.8,
          overwrite: true,
        });
        if (on) {
          ripple(field.box.x + field.box.w / 2, baseline(), 200, 0.45);
        }
      },
      destroy() {
        field.removeEmitter(ambient);
        gsap.killTweensOf(state);
      },
    };
  },
};
```

On copy or submit, call `blast()`, jitter the block briefly in `x`/`y`, and call `idle()` about a second later. That `idle()` also lands an entrance the blast cut short.

## Controller contract

Pass the definition to `attachParticleEffect(wrapper, canvas, target, effect)`; the owner calls its [controls](particle-field.md#controller-contract) per phase.

A new treatment supplies `layer`, `bleed`, and `create(field, target)` returning `enter`, `exit`, `blast`, `idle`, `hover`, and `destroy`:

- `enter` returns one timeline holding every entrance tween, so a cut-short entrance can land its end state.
- Particles a tween steers keep `life: Infinity` until it completes.
- `hover(on)` tolerates short taps and interruption by `blast()`. `attach.ts` owns [input and density](particle-field.md#input-and-density).
- Runner counts are structural: density does not thin them; lower them explicitly.
- `destroy` kills the treatment's own tweens and delayed calls.
- Keep it monochrome and cheap at rest.
