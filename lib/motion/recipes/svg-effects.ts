// Copied from the animaxxing skill: references/recipes/svg-effects.md. Edit in place; see the recipe for the contract.
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
