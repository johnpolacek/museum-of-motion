// Copied from the animaxxing skill: references/recipes/hover-effects.md. Edit in place; see the recipe for the contract.
import gsap from "gsap";

/* Swap for the project's helper if it has one. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Editable defaults; match the app's own hover transitions where it has them. */
const ROLL = { duration: 0.35, ease: "power3.out" } as const;
const SWEEP = { duration: 0.3, ease: "power2.out" } as const;
const ZOOM = { scale: 1.05, duration: 0.6, ease: "power2.out" } as const;

export type Teardown = () => void;
type Register = (fn: () => void) => void;

/**
 * Runs setup in a GSAP context. `dispose` stops writers and listeners before the revert; `after` restores once it is done.
 * Teardown runs once, attempts every step, and rolls back a setup that threw.
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

/** Inline properties these effects write. */
const MOTION_PROPS = ["transform", "translate", "rotate", "scale", "opacity", "visibility"];

/**
 * Records inline properties and returns a restore. Tweens started from a
 * listener are created outside the setup context, so kill them in a disposer
 * and restore after the context reverts. `clearProps` also resets GSAP's cache.
 */
function snapshotStyles(elements: HTMLElement[], props = MOTION_PROPS): () => void {
  const saved = elements.map((element) => props.map((prop) =>
    [element.style.getPropertyValue(prop), element.style.getPropertyPriority(prop)] as const));
  return () =>
    elements.forEach((element, i) => {
      gsap.set(element, { clearProps: props.filter((prop) => !prop.startsWith("--")).join(",") });
      props.forEach((prop, j) => {
        const [value, priority] = saved[i]?.[j] ?? ["", ""];
        if (value) element.style.setProperty(prop, value, priority);
        else element.style.removeProperty(prop);
      });
    });
}

/** Adds a listener and registers its removal. */
function listen<K extends keyof HTMLElementEventMap>(
  dispose: Register,
  target: HTMLElement,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void,
): void {
  target.addEventListener(type, handler as EventListener);
  dispose(() => target.removeEventListener(type, handler as EventListener));
}

type HotHandlers = { on: () => void; off: () => void };

/**
 * Mouse hover and `:focus-visible` focus share one hot state: `on` when the first arrives, `off` when the
 * last leaves. With `touch`, a finger or pen held on the control is hot too, and lifting it, or a scroll
 * that cancels the press, ends it, so nothing sticks after a tap.
 */
function hotState(dispose: Register, control: HTMLElement, { on, off }: HotHandlers, touch = false): void {
  let hovered = false;
  let focused = false;
  let pressed = false;
  let hot = false;
  const update = () => {
    const next = hovered || focused || pressed;
    if (next === hot) return;
    hot = next;
    (hot ? on : off)();
  };
  listen(dispose, control, "pointerenter", (event) => {
    if (event.pointerType !== "mouse") return;
    hovered = true;
    update();
  });
  listen(dispose, control, "pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    hovered = false;
    update();
  });
  if (touch) {
    listen(dispose, control, "pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      pressed = true;
      update();
    });
    const lift = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || !pressed) return;
      pressed = false;
      update();
    };
    listen(dispose, control, "pointerup", lift);
    listen(dispose, control, "pointercancel", lift);
  }
  listen(dispose, control, "focusin", (event) => {
    focused = (event.target as Element).matches(":focus-visible");
    update();
  });
  listen(dispose, control, "focusout", (event) => {
    // Focus moving between controls inside the target, such as a card's links, stays hot.
    if (control.contains(event.relatedTarget as Node | null)) return;
    focused = false;
    update();
  });
}

export type TextRollOptions = {
  /** The text to roll; defaults to `[data-roll-label]` inside the control, else the control itself. */
  label?: HTMLElement | null;
  duration?: number;
  /** A finger or pen held on the control shows the hover until it lifts. */
  touch?: boolean;
};

export function textRoll(control: HTMLElement, { label, duration = ROLL.duration, touch = false }: TextRollOptions = {}): Teardown {
  if (prefersReducedMotion()) return () => {};
  return own((dispose, after) => {
    const target = label ?? control.querySelector<HTMLElement>("[data-roll-label]") ?? control;
    const mask = document.createElement("span");
    const line = document.createElement("span");
    const copy = document.createElement("span");
    const nodes = Array.from(target.childNodes);
    mask.dataset.rollMask = "";
    line.dataset.rollLine = "";
    copy.dataset.rollCopy = "";
    copy.setAttribute("aria-hidden", "true");
    // Both lines share one grid cell. Clip vertically only, so italics and glyph overhang keep their width.
    mask.style.cssText = "display:inline-grid;overflow:visible clip";
    line.style.gridArea = copy.style.gridArea = "1 / 1";
    copy.style.userSelect = "none";
    copy.append(...nodes.map((node) => node.cloneNode(true)));
    copy.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    target.insertBefore(mask, nodes[0] ?? null);
    line.append(...nodes);
    mask.append(line, copy);
    // The original nodes return to their place; the mask and copy leave with the effect.
    after(() => mask.replaceWith(...Array.from(line.childNodes)));
    dispose(() => gsap.killTweensOf([line, copy]));

    /** Pads the clip by the font's overhang past the line box and returns the travel, in percent of the line. */
    const clearance = () => {
      const ink = document.createRange();
      ink.selectNodeContents(line);
      const room = Math.max(0, (ink.getBoundingClientRect().height - line.getBoundingClientRect().height) / 2);
      mask.style.paddingBlock = `${room}px`;
      mask.style.marginBlock = `${-room}px`;
      return (100 * mask.getBoundingClientRect().height) / line.getBoundingClientRect().height;
    };
    gsap.set(copy, { yPercent: clearance() });
    const roll = (hot: boolean) => {
      // Measured per visit, so a font that finished loading after setup still gets its room.
      const travel = clearance();
      gsap.to(line, { yPercent: hot ? -travel : 0, duration, ease: ROLL.ease, overwrite: "auto" });
      gsap.to(copy, { yPercent: hot ? 0 : travel, duration, ease: ROLL.ease, overwrite: "auto" });
    };
    hotState(dispose, control, { on: () => roll(true), off: () => roll(false) }, touch);
  });
}

export type UnderlineSweepOptions = {
  /** A finger or pen held on the control shows the hover until it lifts. */
  touch?: boolean;
};

export function underlineSweep(link: HTMLElement, { touch = false }: UnderlineSweepOptions = {}): Teardown {
  const reduced = prefersReducedMotion();
  return own((dispose, after) => {
    const line = document.createElement("span");
    line.dataset.underline = "";
    line.setAttribute("aria-hidden", "true");
    line.style.cssText =
      "position:absolute;left:0;right:0;bottom:var(--underline-offset,0);height:var(--underline-thickness,1px);" +
      "background:var(--underline-color,currentColor);pointer-events:none";
    after(snapshotStyles([link], ["position"]));
    if (getComputedStyle(link).position === "static") link.style.position = "relative";
    link.append(line);
    after(() => line.remove());
    dispose(() => gsap.killTweensOf(line));
    // Draw from the inline start and clear toward the inline end, so right-to-left text sweeps the other way.
    const rtl = getComputedStyle(link).direction === "rtl";
    const start = rtl ? "100% 50%" : "0% 50%";
    const end = rtl ? "0% 50%" : "100% 50%";
    gsap.set(line, { scaleX: 0, transformOrigin: start });

    const sweep = (hot: boolean) => {
      if (Number(gsap.getProperty(line, "scaleX")) === (hot ? 0 : 1)) {
        gsap.set(line, { transformOrigin: hot ? start : end });
      }
      gsap.to(line, { scaleX: hot ? 1 : 0, duration: reduced ? 0 : SWEEP.duration, ease: SWEEP.ease, overwrite: "auto" });
    };
    hotState(dispose, link, { on: () => sweep(true), off: () => sweep(false) }, touch);
  });
}

export type Edge = "top" | "right" | "bottom" | "left";
export type DirectionalFillOptions = {
  duration?: number;
  /** Edge keyboard focus fills from. */
  focusFrom?: Edge;
};

/** The fill's clip, collapsed onto each edge. */
const COLLAPSED: Record<Edge, string> = {
  top: "inset(0% 0% 100% 0%)",
  right: "inset(0% 0% 0% 100%)",
  bottom: "inset(100% 0% 0% 0%)",
  left: "inset(0% 100% 0% 0%)",
};
const FULL = "inset(0% 0% 0% 0%)";

/** The edge nearest a point, weighed by the box's aspect so a wide tile's sides are not too easy to hit. */
function nearestEdge(box: DOMRect, x: number, y: number): Edge {
  const dx = (x - box.left - box.width / 2) / box.width;
  const dy = (y - box.top - box.height / 2) / box.height;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "bottom" : "top";
}

export function directionalFill(target: HTMLElement, fill: HTMLElement, { duration = 0.3, focusFrom = "bottom" }: DirectionalFillOptions = {}): Teardown {
  const reduced = prefersReducedMotion();
  return own((dispose, after) => {
    after(snapshotStyles([fill], ["clip-path"]));
    dispose(() => gsap.killTweensOf(fill));
    gsap.set(fill, { clipPath: COLLAPSED.top });
    let hovered = false;
    let focused = false;
    let pressed = false;
    let shown = false;
    const go = (show: boolean, edge: Edge) => {
      if (show === shown) return;
      shown = show;
      // Entering starts collapsed on the entry edge; leaving collapses onto the exit edge.
      if (show) gsap.set(fill, { clipPath: COLLAPSED[edge] });
      gsap.to(fill, {
        clipPath: show ? FULL : COLLAPSED[edge],
        duration: reduced ? 0 : show ? duration : duration * 0.8,
        ease: show ? "power3.out" : "power2.in",
        overwrite: "auto",
      });
    };
    const edgeOf = (event: PointerEvent) => nearestEdge(target.getBoundingClientRect(), event.clientX, event.clientY);
    const sync = (edge: Edge) => go(hovered || focused || pressed, edge);

    listen(dispose, target, "pointerenter", (event) => {
      if (event.pointerType !== "mouse") return;
      hovered = true;
      sync(edgeOf(event));
    });
    listen(dispose, target, "pointerleave", (event) => {
      if (event.pointerType !== "mouse") return;
      hovered = false;
      sync(edgeOf(event));
    });
    listen(dispose, target, "pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      pressed = true;
      sync(edgeOf(event));
    });
    const lift = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || !pressed) return;
      pressed = false;
      sync(edgeOf(event));
    };
    listen(dispose, target, "pointerup", lift);
    listen(dispose, target, "pointercancel", lift);
    listen(dispose, target, "focusin", (event) => {
      if (!(event.target as Element).matches(":focus-visible")) return;
      focused = true;
      sync(focusFrom);
    });
    listen(dispose, target, "focusout", (event) => {
      if (target.contains(event.relatedTarget as Node | null)) return;
      focused = false;
      sync(focusFrom);
    });
  });
}

export type FontAxisHoverOptions = {
  /** Weight while hot. Omit to leave weight alone. */
  weight?: number;
  /** `font-stretch` while hot, in percent. Omit to leave width alone. */
  stretch?: number;
  duration?: number;
};

export function fontAxisHover(word: HTMLElement, { weight, stretch, duration = 0.25 }: FontAxisHoverOptions = {}): Teardown {
  const reduced = prefersReducedMotion();
  return own((dispose, after) => {
    // The style attribute comes back exactly, including none at all.
    const saved = word.getAttribute("style");
    after(() => {
      gsap.set(word, { clearProps: "fontWeight,fontStretch" });
      // Read first: Chrome can write a just-cleared inline style back as style="" after a removal.
      void word.getAttribute("style");
      if (saved === null) word.removeAttribute("style");
      else word.setAttribute("style", saved);
    });
    dispose(() => gsap.killTweensOf(word));
    // Once, at build, never on hover: switching to inline-block changes where lines may break.
    if (getComputedStyle(word).display === "inline") word.style.display = "inline-block";
    const style = getComputedStyle(word);
    const rest = { fontWeight: style.fontWeight, fontStretch: style.fontStretch };
    const hot: gsap.TweenVars = {};
    if (weight !== undefined) hot.fontWeight = weight;
    if (stretch !== undefined) hot.fontStretch = `${stretch}%`;
    let held = false;
    // The exact resting width, written directly: GSAP would round it, and a fraction of a pixel can rewrap a full line.
    const hold = () => {
      if (held) return;
      held = true;
      word.style.width = `${word.getBoundingClientRect().width}px`;
      word.style.textAlign = "center";
    };
    const release = () => {
      held = false;
      word.style.removeProperty("width");
      word.style.removeProperty("text-align");
    };
    hotState(dispose, word, {
      on: () => {
        hold();
        gsap.to(word, { ...hot, duration: reduced ? 0 : duration, ease: "power3.out", overwrite: "auto" });
      },
      off: () =>
        gsap.to(word, {
          ...rest,
          duration: reduced ? 0 : duration * 1.4,
          ease: "power3.out",
          overwrite: "auto",
          // Release only at rest, so the box never holds a different width than its type.
          onComplete: release,
        }),
    });
  });
}

export type ImageZoomOptions = {
  /** Defaults to `[data-zoom-image]` inside the card, else its first `img` or `video`. */
  image?: HTMLElement | null;
  scale?: number;
  duration?: number;
  /** A finger or pen held on the control shows the hover until it lifts. */
  touch?: boolean;
};

export function imageZoom(card: HTMLElement, { image, scale = ZOOM.scale, duration = ZOOM.duration, touch = false }: ImageZoomOptions = {}): Teardown {
  if (prefersReducedMotion()) return () => {};
  return own((dispose, after) => {
    const media = image ?? card.querySelector<HTMLElement>("[data-zoom-image]") ?? card.querySelector<HTMLElement>("img, video");
    if (!media) return;
    const frame = media.parentElement;
    after(snapshotStyles([media]));
    if (frame && getComputedStyle(frame).overflow.includes("visible")) {
      after(snapshotStyles([frame], ["overflow"]));
      frame.style.overflow = "clip";
    }
    dispose(() => gsap.killTweensOf(media));
    hotState(dispose, card, {
      on: () => gsap.to(media, { scale, duration, ease: ZOOM.ease, overwrite: "auto" }),
      off: () => gsap.to(media, { scale: 1, duration, ease: ZOOM.ease, overwrite: "auto" }),
    }, touch);
  });
}

/** Where a pointer event crossed the element, in its own pixels; its middle for focus. */
function crossing(element: Element, event: PointerEvent | null) {
  const box = element.getBoundingClientRect();
  return { box, x: event ? event.clientX - box.left : box.width / 2, y: event ? event.clientY - box.top : box.height / 2 };
}

type LiquidHandlers = { on: (event: PointerEvent | null) => void; off: (event: PointerEvent | null) => void; move?: (event: PointerEvent) => void };

/** Like hotState, with the event that turned it on or off, so a liquid can enter where the pointer did. */
function liquidState(dispose: Register, control: HTMLElement, { on, off, move }: LiquidHandlers, touch = false): void {
  let hot = false;
  let finger = -1;
  const set = (next: boolean, event: PointerEvent | null) => {
    if (next === hot) return;
    hot = next;
    (hot ? on : off)(event);
  };
  listen(dispose, control, "pointerenter", (event) => event.pointerType === "mouse" && set(true, event));
  listen(dispose, control, "pointerleave", (event) => event.pointerType === "mouse" && set(false, event));
  if (move) listen(dispose, control, "pointermove", (event) => (event.pointerType === "mouse" || event.pointerId === finger) && move(event));
  if (touch) {
    listen(dispose, control, "pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      finger = event.pointerId;
      set(true, event);
    });
    const lift = (event: PointerEvent) => {
      if (event.pointerId !== finger) return;
      finger = -1;
      set(false, event);
    };
    listen(dispose, control, "pointerup", lift);
    listen(dispose, control, "pointercancel", lift);
  }
  listen(dispose, control, "focusin", (event) => (event.target as Element).matches(":focus-visible") && set(true, null));
  listen(dispose, control, "focusout", (event) => !control.contains(event.relatedTarget as Node | null) && set(false, null));
}

export type BeadUnderlineOptions = {
  /** Bead diameter, in pixels. */
  bead?: number;
  /** Resting underline thickness, in pixels. */
  thickness?: number;
  touch?: boolean;
};

export function beadUnderline(link: HTMLElement, { bead = 6, thickness = 1, touch = false }: BeadUnderlineOptions = {}): Teardown {
  const reduced = prefersReducedMotion();
  return own((dispose, after) => {
    const line = document.createElement("span");
    line.setAttribute("aria-hidden", "true");
    line.style.cssText =
      `position:absolute;left:0;bottom:calc(var(--underline-offset,0px) - ${bead / 2}px);width:100%;height:${bead}px;border-radius:${bead}px;` +
      "background:var(--underline-color,currentColor);pointer-events:none;transform-origin:0 50%";
    after(snapshotStyles([link], ["position"]));
    if (getComputedStyle(link).position === "static") link.style.position = "relative";
    link.append(line);
    after(() => line.remove());
    dispose(() => gsap.killTweensOf(line));
    gsap.set(line, { x: 0, scaleX: 0, scaleY: 0 });
    const rest = thickness / bead;
    const dot = (width: number) => bead / Math.max(width, bead);
    liquidState(dispose, link, {
      on(event) {
        const { box, x } = crossing(link, event);
        if (reduced) return void gsap.set(line, { x: 0, scaleX: 1, scaleY: rest });
        gsap.killTweensOf(line);
        gsap.timeline()
          .set(line, { x: x - bead / 2, scaleX: dot(box.width), scaleY: 0 })
          .to(line, { scaleY: 1, duration: 0.12, ease: "back.out(3)" })
          .to(line, { x: 0, scaleX: 1, duration: 0.6, ease: "expo.out" }, 0.08)
          .to(line, { scaleY: rest, duration: 0.4, ease: "power2.out" }, 0.1);
      },
      off(event) {
        const { box, x } = crossing(link, event);
        if (reduced) return void gsap.set(line, { scaleX: 0, scaleY: 0 });
        const at = gsap.utils.clamp(bead / 2, box.width - bead / 2, x);
        gsap.killTweensOf(line);
        gsap.timeline()
          .to(line, { x: at - bead / 2, scaleX: dot(box.width), scaleY: 0.85, duration: 0.28, ease: "power3.in" })
          .to(line, { x: at, scaleX: 0, scaleY: 0, duration: 0.12, ease: "power2.in" });
      },
    }, touch);
  });
}

export type PourFillOptions = { touch?: boolean };

export function pourFill(control: HTMLElement, fill: HTMLElement, { touch = false }: PourFillOptions = {}): Teardown {
  const reduced = prefersReducedMotion();
  return own((dispose, after) => {
    after(snapshotStyles([fill]));
    after(() => control.removeAttribute("data-poured"));
    dispose(() => gsap.killTweensOf(fill));
    gsap.set(fill, { scale: 0 });
    /** Where the pointer crossed, as a percent offset from the middle, so the liquid enters and leaves there. */
    const side = (event: PointerEvent | null) => {
      const { box, x, y } = crossing(control, event);
      return { xPercent: gsap.utils.clamp(-70, 70, ((x - box.width / 2) / (box.width / 2)) * 70), yPercent: gsap.utils.clamp(-70, 70, ((y - box.height / 2) / (box.height / 2)) * 70) };
    };
    liquidState(dispose, control, {
      on(event) {
        control.setAttribute("data-poured", "");
        if (reduced) return void gsap.set(fill, { xPercent: 0, yPercent: 0, scale: 1 });
        gsap.killTweensOf(fill);
        gsap.timeline()
          .fromTo(fill, { ...side(event), scale: 0.2 }, { xPercent: 0, yPercent: 0, scale: 1, duration: 0.5, ease: "power3.out" })
          // The settling wobble: a squash one way, then the other, smaller each time.
          .to(fill, { keyframes: { scaleX: [1.12, 0.95, 1.03, 1], scaleY: [0.9, 1.06, 0.98, 1] }, duration: 0.7, ease: "sine.out" }, 0.3);
      },
      off(event) {
        control.removeAttribute("data-poured");
        if (reduced) return void gsap.set(fill, { scale: 0 });
        gsap.killTweensOf(fill);
        gsap.timeline()
          .to(fill, { scaleX: 1.1, scaleY: 0.9, duration: 0.12, ease: "power2.in" })
          .to(fill, { ...side(event), scale: 0, duration: 0.35, ease: "power3.in" }, 0.05);
      },
    }, touch);
  });
}

export type JellyOptions = {
  /** The highlight's color; a light tint of the button reads best. */
  highlight?: string;
  touch?: boolean;
};

export function jelly(button: HTMLElement, { highlight = "rgb(255 255 255 / 0.35)", touch = false }: JellyOptions = {}): Teardown {
  if (prefersReducedMotion()) return () => {};
  return own((dispose, after) => {
    const glow = document.createElement("span");
    glow.setAttribute("aria-hidden", "true");
    const size = Math.max(button.offsetHeight * 1.6, 48);
    glow.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;border-radius:50%;pointer-events:none;background:radial-gradient(closest-side, ${highlight}, transparent);opacity:0`;
    after(snapshotStyles([button], [...MOTION_PROPS, "position", "overflow", "isolation"]));
    if (getComputedStyle(button).position === "static") button.style.position = "relative";
    button.style.overflow = "hidden";
    button.style.isolation = "isolate";
    button.prepend(glow);
    after(() => glow.remove());
    dispose(() => gsap.killTweensOf([button, glow]));
    const aim = (event: PointerEvent | null) => {
      const { x, y } = crossing(button, event);
      gsap.to(glow, { x: x - size / 2, y: y - size / 2, duration: 0.25, ease: "power3.out", overwrite: "auto" });
    };
    liquidState(dispose, button, {
      on(event) {
        aim(event);
        gsap.to(glow, { opacity: 1, duration: 0.3 });
        gsap.timeline()
          .to(button, { scaleX: 1.05, scaleY: 0.9, duration: 0.14, ease: "power2.out", overwrite: "auto" })
          .to(button, { scaleX: 1, scaleY: 1, duration: 1, ease: "elastic.out(1, 0.32)" });
      },
      off() {
        gsap.to(glow, { opacity: 0, duration: 0.3 });
        gsap.timeline()
          .to(button, { scaleX: 0.97, scaleY: 1.05, duration: 0.12, ease: "power2.out", overwrite: "auto" })
          .to(button, { scaleX: 1, scaleY: 1, duration: 0.8, ease: "elastic.out(1, 0.35)" });
      },
      move: aim,
    }, touch);
  });
}

