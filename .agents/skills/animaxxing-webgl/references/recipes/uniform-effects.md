# Recipe: uniform effects

Seven effects that drive an [image plane](image-planes.md)'s uniforms with GSAP: a hover lens, a scroll-velocity wave, a wipe for reveals and exits, a glitch, a dissolve, a pixelation, and a ripple. Each owns only its uniforms, so the lens and wave share a plane with either the wipe or the glitch; the wipe and the glitch both show and hide the plane through `uProgress`, so use one of them per plane. With no WebGL or reduced motion, the plane's `webgl` is false: hover and wave build nothing, and the wipe's timelines finish at once on the plain image with their callbacks. `webgl` also turns false when the image proves unreadable or the plane reverts; from then on wipe timelines finish at once.

Lifecycle: the framework controller attaches effects after building the plane, calls the wipe's `enter` and `exit` in its intro and outro, and reverts effects before the plane on unmount.

Dependencies: `gsap`, `gsap/ScrollTrigger`, `image-planes.ts` from this skill.

```ts
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ImagePlane } from "./image-planes";

gsap.registerPlugin(ScrollTrigger);

export type Teardown = () => void;

export type HoverDistortionOptions = {
  /** Lens strength at full hover. */
  strength?: number;
  duration?: number;
  /** Seconds the lens takes to catch the pointer. */
  follow?: number;
  /** Element that takes hover and focus. Defaults to the image's link or button, else the image. */
  target?: HTMLElement;
  /**
   * A finger or pen held on the surface moves the lens like the mouse, and lifting it closes the lens. It
   * claims the surface's touch gestures, so a scroll cannot start on it.
   */
  touch?: boolean;
};

/** A lens that follows the mouse and centers on keyboard focus. Touch and pen trigger it only with `touch`. */
export function hoverDistortion(
  plane: ImagePlane,
  { strength = 1, duration = 0.6, follow = 0.4, target, touch = false }: HoverDistortionOptions = {},
): Teardown {
  if (!plane.webgl) return () => {};
  const { uHover, uMouse } = plane.uniforms;
  const start = [uHover.value, ...uMouse.value];
  const surface = target ?? plane.image.closest<HTMLElement>("a[href], button") ?? plane.image;
  const aborter = new AbortController();
  const on = { signal: aborter.signal };
  const toX = gsap.quickTo(uMouse.value, "0", { duration: follow, ease: "power3" });
  const toY = gsap.quickTo(uMouse.value, "1", { duration: follow, ease: "power3" });
  let mouse = false;
  let focus = false;
  /** The finger holding the lens, with `touch`; -1 when none. */
  let finger = -1;
  const previousTouchAction = surface.style.touchAction;
  if (touch) surface.style.touchAction = "none";
  const accepts = (event: PointerEvent) => event.pointerType === "mouse" || event.pointerId === finger;

  const heat = () =>
    gsap.to(uHover, { value: mouse || focus ? strength : 0, duration, ease: "power3.out", overwrite: true });
  /** Moves the lens to the pointer; `jump` places it there without sliding in. */
  const aim = (event: PointerEvent, jump = false) => {
    const box = plane.image.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const x = gsap.utils.clamp(0, 1, (event.clientX - box.left) / box.width);
    const y = gsap.utils.clamp(0, 1, 1 - (event.clientY - box.top) / box.height);
    toX(x, jump ? x : undefined);
    toY(y, jump ? y : undefined);
  };

  surface.addEventListener(
    "pointerenter",
    (event) => {
      if (event.pointerType !== "mouse") return;
      mouse = true;
      aim(event, true);
      heat();
    },
    on,
  );
  surface.addEventListener("pointermove", (event) => accepts(event) && aim(event), on);
  if (touch) {
    surface.addEventListener(
      "pointerdown",
      (event) => {
        if (event.pointerType === "mouse") return;
        finger = event.pointerId;
        mouse = true;
        aim(event, true);
        heat();
      },
      on,
    );
    const lift = (event: PointerEvent) => {
      if (event.pointerId !== finger) return;
      finger = -1;
      mouse = false;
      heat();
    };
    document.addEventListener("pointerup", lift, on);
    document.addEventListener("pointercancel", lift, on);
  }
  surface.addEventListener(
    "pointerleave",
    (event) => {
      if (event.pointerType !== "mouse") return;
      mouse = false;
      heat();
    },
    on,
  );
  surface.addEventListener(
    "focusin",
    (event) => {
      // Focus left by a click or tap does not hold the lens.
      if (!(event.target instanceof Element) || !event.target.matches(":focus-visible")) return;
      focus = true;
      if (!mouse) gsap.set(uMouse.value, { 0: 0.5, 1: 0.5 });
      heat();
    },
    on,
  );
  surface.addEventListener(
    "focusout",
    () => {
      focus = false;
      heat();
    },
    on,
  );

  return () => {
    aborter.abort();
    gsap.killTweensOf([uHover, uMouse.value]);
    [uHover.value, uMouse.value[0], uMouse.value[1]] = start as [number, number, number];
    if (touch) surface.style.touchAction = previousTouchAction;
  };
}

export type ScrollWaveOptions = {
  /** Bend in CSS pixels per pixel-per-second of scroll velocity. */
  strength?: number;
  /** Largest bend in CSS pixels, either way. */
  max?: number;
  /** Seconds to straighten once scrolling stops. */
  settle?: number;
  /** A custom scroller, such as a smooth-scroll wrapper. Defaults to the page. */
  scroller?: Element | Window;
};

/** Bends the plane with scroll velocity and straightens it when scrolling stops. */
export function scrollWave(
  plane: ImagePlane,
  { strength = 0.02, max = 40, settle = 0.6, scroller }: ScrollWaveOptions = {},
): Teardown {
  if (!plane.webgl) return () => {};
  const { uVelocity } = plane.uniforms;
  const start = uVelocity.value;
  const rest = gsap
    .delayedCall(0.1, () => gsap.to(uVelocity, { value: 0, duration: settle, ease: "power3.out", overwrite: true }))
    .pause();
  const trigger = ScrollTrigger.create({
    trigger: plane.image,
    scroller,
    start: "top bottom",
    end: "bottom top",
    onUpdate(self) {
      const value = gsap.utils.clamp(-max, max, self.getVelocity() * strength);
      gsap.to(uVelocity, { value, duration: 0.25, ease: "power2.out", overwrite: true });
      rest.restart(true);
    },
  });
  return () => {
    trigger.kill();
    rest.kill();
    gsap.killTweensOf(uVelocity);
    uVelocity.value = start;
  };
}

export type WipeOptions = {
  duration?: number;
  ease?: string;
  /** Starts with the plane hidden, ready for `enter`. False starts it shown. */
  hidden?: boolean;
};

export type Wipe = {
  /** Wipes the image in. */
  enter(): gsap.core.Timeline;
  /** Wipes the image out. */
  exit(): gsap.core.Timeline;
  revert: Teardown;
};

/** A noisy-edged wipe on `uProgress`. Without WebGL, both timelines finish at once on the plain image. */
export function wipe(plane: ImagePlane, { duration = 1.2, ease = "power2.inOut", hidden = true }: WipeOptions = {}): Wipe {
  const { uProgress } = plane.uniforms;
  const start = uProgress.value;
  let running: gsap.core.Timeline | undefined;
  if (plane.webgl) uProgress.value = hidden ? 0 : 1;
  // Timelines, not tweens, so callbacks added after the call still fire when there is nothing to animate.
  const run = (value: number) => {
    running?.kill();
    running = gsap.timeline().to(uProgress, { value, duration: plane.webgl ? duration : 0, ease, overwrite: "auto" });
    return running;
  };
  return {
    enter: () => run(1),
    exit: () => run(0),
    revert() {
      running?.kill();
      gsap.killTweensOf(uProgress);
      uProgress.value = start;
    },
  };
}

export type GlitchOptions = {
  /** Seconds of glitching per run. */
  duration?: number;
  /** Starts with the plane hidden, ready for `enter`. False starts it shown. */
  hidden?: boolean;
};

export type Glitch = {
  /** Shows the image breaking up, then settling clean. */
  enter(): gsap.core.Timeline;
  /** Breaks the image up more and more, then hides it. */
  exit(): gsap.core.Timeline;
  /** One burst on a shown image, settling clean. */
  burst(): gsap.core.Timeline;
  revert: Teardown;
};

/**
 * Bands and blocks jump sideways on `uGlitch`, in steps from the shader's clock. Nothing blinks:
 * the plane shows once on `enter` and hides once on `exit`. Without WebGL, timelines finish at once.
 */
export function glitch(plane: ImagePlane, { duration = 0.6, hidden = true }: GlitchOptions = {}): Glitch {
  const { uGlitch, uProgress } = plane.uniforms;
  const start = [uGlitch.value, uProgress.value] as const;
  let running: gsap.core.Timeline | undefined;
  if (plane.webgl) uProgress.value = hidden ? 0 : 1;
  const run = (build: (tl: gsap.core.Timeline) => void) => {
    running?.kill();
    running = gsap.timeline();
    if (plane.webgl) build(running);
    else running.to({}, { duration: 0 });
    return running;
  };
  return {
    enter: () =>
      run((tl) => tl.set(uProgress, { value: 1 }, 0).fromTo(uGlitch, { value: 1 }, { value: 0, duration, ease: "power2.in" }, 0)),
    exit: () =>
      run((tl) =>
        tl.fromTo(uGlitch, { value: 0 }, { value: 1, duration: duration * 0.6, ease: "power2.out" }).set(uProgress, { value: 0 }).set(uGlitch, { value: 0 }),
      ),
    burst: () => run((tl) => tl.fromTo(uGlitch, { value: 1 }, { value: 0, duration, ease: "power2.in" })),
    revert() {
      running?.kill();
      gsap.killTweensOf([uGlitch, uProgress]);
      [uGlitch.value, uProgress.value] = start;
    },
  };
}
```

The glitch moves pixels sideways only: no color split, and the plane shows and hides once, well under three flashes a second. For a glitch on text, use the `animaxxing` skill's split-entrances `glitchIn` and `glitchOut`.

## Dissolve, pixelate, and ripple

Three more uniform effects with the same shape as the glitch. `dissolve` shows the image grain by grain on its own uniform, so it can share a plane with the wipe or the glitch. `pixelate` resolves the image from coarse blocks to sharp, and `ripple` sends one ring out from the center; both show and hide the plane through `uProgress`, like the wipe. Without WebGL or under reduced motion, every timeline finishes at once.

```ts
export type ShaderEffectOptions = {
  duration?: number;
  /** Starts with the plane hidden, ready for `enter`. False starts it shown. */
  hidden?: boolean;
};
export type ShaderEffect = { enter(): gsap.core.Timeline; exit(): gsap.core.Timeline; revert: Teardown };

/** Runs one timeline at a time on a plane, finishing at once when the plane has no WebGL. */
function shaderRunner(plane: ImagePlane) {
  let running: gsap.core.Timeline | undefined;
  return {
    run(build: (tl: gsap.core.Timeline) => void) {
      running?.kill();
      running = gsap.timeline();
      if (plane.webgl) build(running);
      else running.to({}, { duration: 0 });
      return running;
    },
    kill: () => running?.kill(),
  };
}

/** The image appears grain by grain in fine noise, and leaves the same way. */
export function dissolve(plane: ImagePlane, { duration = 1.1, hidden = true }: ShaderEffectOptions = {}): ShaderEffect {
  const { uDissolve } = plane.uniforms;
  const start = uDissolve.value;
  const runner = shaderRunner(plane);
  if (plane.webgl) uDissolve.value = hidden ? 0 : 1;
  return {
    enter: () => runner.run((tl) => tl.fromTo(uDissolve, { value: 0 }, { value: 1, duration, ease: "power2.out" })),
    exit: () => runner.run((tl) => tl.to(uDissolve, { value: 0, duration: duration * 0.6, ease: "power2.in" })),
    revert() {
      runner.kill();
      gsap.killTweensOf(uDissolve);
      uDissolve.value = start;
    },
  };
}

/** The image resolves from coarse blocks to sharp, and breaks back into blocks to leave. */
export function pixelate(plane: ImagePlane, { duration = 1, hidden = true }: ShaderEffectOptions = {}): ShaderEffect {
  const { uPixelate, uProgress } = plane.uniforms;
  const start = [uPixelate.value, uProgress.value] as const;
  const runner = shaderRunner(plane);
  if (plane.webgl) uProgress.value = hidden ? 0 : 1;
  return {
    // Stepped, so the blocks halve in size in clear jumps rather than sliding.
    enter: () =>
      runner.run((tl) => tl.set(uProgress, { value: 1 }, 0).fromTo(uPixelate, { value: 1 }, { value: 0, duration, ease: "steps(8)" }, 0)),
    exit: () =>
      runner.run((tl) =>
        tl.fromTo(uPixelate, { value: 0 }, { value: 1, duration: duration * 0.6, ease: "steps(6)" }).set(uProgress, { value: 0 }).set(uPixelate, { value: 0 }),
      ),
    revert() {
      runner.kill();
      gsap.killTweensOf([uPixelate, uProgress]);
      [uPixelate.value, uProgress.value] = start;
    },
  };
}

export type Ripple = ShaderEffect & { burst(): gsap.core.Timeline };

/** One ring rolls out from the center across the image: on arrival, on leaving, or as a burst. */
export function ripple(plane: ImagePlane, { duration = 1.2, hidden = true }: ShaderEffectOptions = {}): Ripple {
  const { uRipple, uProgress } = plane.uniforms;
  const start = [uRipple.value, uProgress.value] as const;
  const runner = shaderRunner(plane);
  if (plane.webgl) uProgress.value = hidden ? 0 : 1;
  // The ring runs 0 to 1 and the uniform returns to 0, so a plane at rest always reads 0.
  const ring = (tl: gsap.core.Timeline, at = 0) =>
    tl.fromTo(uRipple, { value: 0 }, { value: 1, duration, ease: "power2.out" }, at).set(uRipple, { value: 0 }, at + duration);
  return {
    enter: () => runner.run((tl) => ring(tl.set(uProgress, { value: 1 }, 0))),
    exit: () => runner.run((tl) => ring(tl).set(uProgress, { value: 0 }, duration * 0.5)),
    burst: () => runner.run((tl) => ring(tl)),
    revert() {
      runner.kill();
      gsap.killTweensOf([uRipple, uProgress]);
      [uRipple.value, uProgress.value] = start;
    },
  };
}
```

Pixelate steps through block sizes rather than sliding, which reads as a resolution change. The ripple is flat at both ends of its run, so a plane at rest draws the plain image.

A hidden wipe needs care above the fold: the `<img>` shows until the plane draws, then the plane starts hidden. Hold the image in the framework's initial state, through a wrapper or class rather than the image's own inline `opacity`, and await the plane's `ready` within the deadline in the framework skill's `references/initialization.md`; on `false` or timeout, reveal the `<img>` without WebGL, such as with the `animaxxing` skill's `media-effects` reveal. Below the fold, build the plane early and call `enter` from a ScrollTrigger; the swap happens off screen. A lost context during a hidden wipe shows the whole `<img>`, which keeps the content readable.

## Wiring

```ts
// Example: a reveal on scroll, a hover lens, and a scroll wave on one plane.
const plane = imagePlane(image);
const lens = hoverDistortion(plane);
const wave = scrollWave(plane);
const reveal = wipe(plane);
const trigger = ScrollTrigger.create({ trigger: image, start: "top 80%", once: true, onEnter: () => reveal.enter() });
// On unmount:
trigger.kill();
[lens, wave, reveal.revert].forEach((revert) => revert());
plane.revert();
```

## Controller contract

| Phase | Call |
|---|---|
| initial state | `wipe(plane)` starts the plane hidden; the `<img>` shows until the plane draws. |
| intro | `enter()` on the wipe or the glitch, after `plane.ready` for images on screen. |
| settled | `hoverDistortion` and `scrollWave` run on their own input; nothing ambient runs without input. |
| outro | Stop hover and wave by reverting them, then `exit()`. A glitch's `burst()` can run any time the image is shown. |
| unmount | Each teardown kills its tweens, trigger, and listeners and restores its uniforms; then the plane reverts. |

Reduced motion builds no plane, so hover and wave do nothing and every reveal effect's timelines complete at once with their callbacks.
