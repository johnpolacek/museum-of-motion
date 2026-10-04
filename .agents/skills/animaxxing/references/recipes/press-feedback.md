# Recipe: press feedback

A control answers the moment it is pressed. It squashes a little under the press and springs back on release, and an ink ripple spreads from the exact point pressed. Mouse, touch, pen, and the keyboard all get it: Enter and Space press from the center. Use either move alone or both together.

Lifecycle: the framework controller builds it once the control is mounted and calls the idempotent teardown on unmount. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`.

```css
/* The ripple's ink: the control's text color by default. */
[data-ripple] { background: currentColor; }
```

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

/** Records inline properties and returns a restore; `clearProps` also resets GSAP's cached transform. */
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

export type PressOptions = {
  /** Scale while pressed; 1 turns the squash off. */
  squash?: number;
  /** Spread an ink ripple from the press point. */
  ripple?: boolean;
  /** Ripple ink opacity at its start. */
  ink?: number;
};

/** The press and the release, with the spring on the way back. */
const PRESS = { duration: 0.12, ease: "power2.out" } as const;
const RELEASE = { duration: 0.5, ease: "elastic.out(1, 0.45)" } as const;
const RIPPLE = { duration: 0.6, ease: "power2.out" } as const;

export function pressFeedback(control: HTMLElement, { squash = 0.94, ripple = true, ink = 0.3 }: PressOptions = {}): Teardown {
  if (prefersReducedMotion()) return () => {};
  return own((dispose, after) => {
    after(snapshotStyles([control], ["transform", "translate", "scale", "position", "overflow"]));
    const style = getComputedStyle(control);
    // The ripple needs a positioned, clipping box; set only what the control lacks.
    if (ripple && style.position === "static") control.style.position = "relative";
    if (ripple && style.overflow === "visible") control.style.overflow = "clip";
    const ripples = new Set<HTMLElement>();
    dispose(() => {
      ripples.forEach((element) => element.remove());
      gsap.killTweensOf(control);
    });
    let pressed = false;

    const spread = (x: number, y: number) => {
      const box = control.getBoundingClientRect();
      // Large enough to reach the farthest corner from the press point.
      const reach = Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y));
      const drop = document.createElement("span");
      drop.dataset.ripple = "";
      drop.setAttribute("aria-hidden", "true");
      Object.assign(drop.style, {
        position: "absolute",
        left: `${x - reach}px`,
        top: `${y - reach}px`,
        width: `${reach * 2}px`,
        height: `${reach * 2}px`,
        borderRadius: "50%",
        pointerEvents: "none",
      });
      control.append(drop);
      ripples.add(drop);
      gsap.fromTo(drop, { scale: 0, opacity: ink }, { scale: 1, opacity: 0, ...RIPPLE, onComplete: () => (drop.remove(), ripples.delete(drop)) });
    };
    const press = (x: number, y: number) => {
      if (pressed) return;
      pressed = true;
      if (squash !== 1) gsap.to(control, { scale: squash, ...PRESS, overwrite: "auto" });
      if (ripple) spread(x, y);
    };
    const release = () => {
      if (!pressed) return;
      pressed = false;
      if (squash !== 1) gsap.to(control, { scale: 1, ...RELEASE, overwrite: "auto" });
    };

    const on = <K extends keyof HTMLElementEventMap>(type: K, handler: (event: HTMLElementEventMap[K]) => void) => {
      control.addEventListener(type, handler);
      dispose(() => control.removeEventListener(type, handler));
    };
    on("pointerdown", (event) => {
      if (event.button !== 0) return;
      const box = control.getBoundingClientRect();
      press(event.clientX - box.left, event.clientY - box.top);
    });
    // A scroll that starts on touch cancels the pointer; the control springs back.
    on("pointerup", release);
    on("pointercancel", release);
    on("pointerleave", release);
    on("keydown", (event) => {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
      const box = control.getBoundingClientRect();
      press(box.width / 2, box.height / 2);
    });
    on("keyup", release);
    on("blur", release);
  });
}
```

The squash scales the whole control, so keep it near 1 on large surfaces and leave text-heavy cards at `squash: 1`. The ripple uses the control's text color at `ink` opacity; on a control whose text color is near its background, set a `[data-ripple]` background from an existing brand token.

## Controller contract

| Builder | Create | Returns | Reduced motion |
|---|---|---|---|
| `pressFeedback` | Settled, once the control is mounted | teardown | No-op; the control's own `:active` style stays |

- One pointer response per control: do not combine with `magnetic`, `tilt`, or a particle hot state, which also write the control's transform.
- The ripple spans live only while they spread, and teardown removes any in flight.
