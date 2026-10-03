# Recipe: uniform effects

Three effects that drive an [image plane](image-planes.md)'s uniforms with GSAP: a hover lens, a scroll-velocity wave, and a wipe for reveals and exits. Each owns only its uniforms, so all three can share a plane. With no WebGL or reduced motion, the plane's `webgl` is false: hover and wave build nothing, and the wipe's timelines finish at once on the plain image with their callbacks. `webgl` also turns false when the image proves unreadable or the plane reverts; from then on wipe timelines finish at once.

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
};

/** A lens that follows the mouse and centers on keyboard focus. Touch and pen never trigger it. */
export function hoverDistortion(
  plane: ImagePlane,
  { strength = 1, duration = 0.6, follow = 0.4, target }: HoverDistortionOptions = {},
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
  surface.addEventListener("pointermove", (event) => event.pointerType === "mouse" && aim(event), on);
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
```

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
| intro | `enter()`, after `plane.ready` for images on screen. |
| settled | `hoverDistortion` and `scrollWave` run on their own input; nothing ambient runs without input. |
| outro | Stop hover and wave by reverting them, then `exit()`. |
| unmount | Each teardown kills its tweens, trigger, and listeners and restores its uniforms; then the plane reverts. |

Reduced motion builds no plane, so hover and wave do nothing and the wipe's timelines complete at once with their callbacks.
