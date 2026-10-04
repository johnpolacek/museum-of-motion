// Copied from the animaxxing-webgl skill: references/recipes/uniform-effects.md. Edit in place; see the recipe for the contract.
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
