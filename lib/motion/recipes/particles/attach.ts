// Copied from the animaxxing skill: references/recipes/particle-field.md (attach.ts).
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
