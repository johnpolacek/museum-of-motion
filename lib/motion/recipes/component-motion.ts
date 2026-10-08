// Copied from the animaxxing skill: references/recipes/component-motion.md. Edit in place; see the recipe for the contract.
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
 * Runs setup in its own GSAP context. `dispose` registers stops that run before
 * the context reverts; `after` registers restores that run after it. Teardown
 * runs once, attempts every step, and rolls back a setup that threw.
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

/** Records inline properties and returns a restore that also resets GSAP's cached transform. */
function snapshotStyles(elements: HTMLElement[], props: string[]): () => void {
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

/** One timeline in flight per component: the next kills the running one and tweens from current values. */
function relay() {
  let current: gsap.core.Timeline | undefined;
  return {
    next(): gsap.core.Timeline {
      current?.kill();
      current = gsap.timeline({ defaults: { overwrite: "auto" } });
      return current;
    },
    kill(): void {
      current?.kill();
    },
  };
}

type Edge = "top" | "bottom" | "left" | "right";

export type MenuOverlayOptions = {
  /** Selector, within the panel, for the items that stagger in. */
  links?: string;
  /** The edge the panel wipes in from. */
  from?: Edge;
  duration?: number;
  stagger?: number;
};

export type MenuOverlay = {
  /** Wipes the panel in, then staggers the links. Move focus inside when it completes. */
  open(): gsap.core.Timeline;
  /** Links out, then the wipe back, from wherever the open is. Return focus to the trigger when it completes. */
  close(): gsap.core.Timeline;
  revert: Teardown;
};

/** Pixels the links rise from and return to. */
const LINK_Y = 16;

export function menuOverlay(
  panel: HTMLElement,
  { links = "a", from = "top", duration = 0.5, stagger = 0.05 }: MenuOverlayOptions = {},
): MenuOverlay {
  const run = relay();
  /** Percent of the panel still clipped, on the edge opposite `from`. Tweened as a number so a computed clip never has to be parsed. */
  const clip = { inset: 100 };
  const insets: Record<Edge, () => string> = {
    top: () => `inset(0% 0% ${clip.inset}% 0%)`,
    bottom: () => `inset(${clip.inset}% 0% 0% 0%)`,
    left: () => `inset(0% ${clip.inset}% 0% 0%)`,
    right: () => `inset(0% 0% 0% ${clip.inset}%)`,
  };
  const paint = () => {
    panel.style.clipPath = insets[from]();
  };
  let items: HTMLElement[] = [];
  const revert = own((dispose, after) => {
    after(snapshotStyles([panel], ["visibility", "clip-path"]));
    dispose(run.kill);
    gsap.set(panel, { visibility: "hidden" });
    paint();
    items = Array.from(panel.querySelectorAll<HTMLElement>(links));
    after(snapshotStyles(items, ["opacity", "visibility", "transform", "translate"]));
    gsap.set(items, { autoAlpha: 0, y: LINK_Y });
  });
  return {
    open() {
      const tl = run.next().set(panel, { visibility: "visible" });
      if (prefersReducedMotion()) return tl.set(clip, { inset: 0, onUpdate: paint }).set(items, { autoAlpha: 1, y: 0 });
      return tl
        .to(clip, { inset: 0, duration, ease: "power3.inOut", onUpdate: paint })
        .to(items, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out", stagger }, "-=0.2");
    },
    close() {
      const tl = run.next();
      if (prefersReducedMotion()) {
        return tl.set(items, { autoAlpha: 0, y: LINK_Y }).set(clip, { inset: 100, onUpdate: paint }).set(panel, { visibility: "hidden" });
      }
      return tl
        .to(items, { autoAlpha: 0, y: LINK_Y, duration: 0.2, ease: "power2.in", stagger: { each: stagger / 2, from: "end" } })
        .to(clip, { inset: 100, duration: duration * 0.8, ease: "power3.inOut", onUpdate: paint }, "-=0.1")
        .set(panel, { visibility: "hidden" });
    },
    revert,
  };
}

export type EnterExitOptions = {
  /** Reverse ease for every tween in both halves; GSAP 3.15+. Leave unset on older GSAP. */
  easeReverse?: string | boolean;
  /** Speed of a reversed entrance. Above 1 gets out of the way faster. */
  reverseSpeed?: number;
  /** Called at the open rest, including a reopen that reversed out of the exit. */
  onOpen?: () => void;
  /** Called at the closed rest, from a reversed entrance or a finished exit. */
  onClose?: () => void;
};

export type EnterExitPhase = "closed" | "opening" | "open" | "closing";

export type EnterExit = {
  /** Plays the entrance, or turns an exit in flight back to the open rest. */
  open(): void;
  /** Plays the exit from the open rest, or reverses an entrance in flight. */
  close(): void;
  phase(): EnterExitPhase;
  revert: Teardown;
};

export function enterExit(
  enter: (tl: gsap.core.Timeline) => void,
  exit: (tl: gsap.core.Timeline) => void,
  { easeReverse, reverseSpeed = 1.5, onOpen, onClose }: EnterExitOptions = {},
): EnterExit {
  let tl: gsap.core.Timeline | undefined;
  let openAt = 0;
  let phase: EnterExitPhase = "closed";
  const opened = () => {
    phase = "open";
    tl?.timeScale(1);
    onOpen?.();
  };
  const closed = () => {
    phase = "closed";
    tl?.timeScale(1);
    onClose?.();
  };
  // Reverting the context reverts the timeline, restoring every target's inline styles.
  const revert = own(() => {
    const timeline = gsap.timeline({
      paused: true,
      defaults: easeReverse === undefined ? {} : { easeReverse },
      // A finished exit rewinds to the entrance's closed start, without firing callbacks.
      onComplete: () => {
        timeline.pause(0);
        closed();
      },
      onReverseComplete: closed,
    });
    tl = timeline;
    enter(timeline);
    openAt = timeline.duration();
    // Fires in both directions: forward at the end of the entrance, backward when a reopen reverses the exit.
    timeline.addPause(openAt, () => void (phase === "open" || opened()));
    exit(timeline);
    // Paint the closed state now: before GSAP's first tick, a context defers the entrance's immediate render a frame.
    timeline.render(0, true, true);
  });
  const reduced = (to: number, done: () => void) => {
    tl?.pause(to);
    done();
  };
  return {
    open() {
      if (!tl || phase === "open" || phase === "opening") return;
      if (prefersReducedMotion()) return reduced(openAt, opened);
      if (phase === "closed") tl.timeScale(1).play(0);
      // Closing: an entrance being reversed plays forward again; an exit reverses to the pause.
      else if (tl.time() < openAt) tl.timeScale(1).play();
      else tl.timeScale(1).reverse();
      phase = "opening";
    },
    close() {
      if (!tl || phase === "closed" || phase === "closing") return;
      if (prefersReducedMotion()) return reduced(0, closed);
      if (phase === "open") tl.timeScale(1).play();
      // Opening: an entrance reverses at `reverseSpeed`; a reopen from the exit plays on into it.
      else if (tl.time() < openAt) tl.timeScale(reverseSpeed).reverse();
      else tl.timeScale(1).play();
      phase = "closing";
    },
    phase: () => phase,
    revert,
  };
}

export type DialogPlacement = "center" | Edge;
export type DialogMotionOptions = {
  /** `center` scales in; an edge slides the dialog in from that side. */
  placement?: DialogPlacement;
  /** Opens out of this element and closes back into it, in place of `placement`'s move. */
  from?: Element;
  duration?: number;
};

export type DialogMotion = {
  /** Calls `showModal()` unless already open, then animates the backdrop and panel in. */
  open(): gsap.core.Timeline;
  /** Animates out, then calls `dialog.close(returnValue)`. */
  close(returnValue?: string): gsap.core.Timeline;
  revert: Teardown;
};

const DIALOG_PROPS = ["opacity", "transform", "translate", "clip-path", "--dialog-backdrop"];
const ONSTAGE = { opacity: 1, x: 0, y: 0, xPercent: 0, yPercent: 0, scale: 1, "--dialog-backdrop": 1 };
const OFFSTAGE: Record<DialogPlacement, gsap.TweenVars> = {
  center: { scale: 0.96, y: 8 },
  top: { yPercent: -100 },
  bottom: { yPercent: 100 },
  left: { xPercent: -100 },
  right: { xPercent: 100 },
};

/**
 * Circles in the dialog's own coordinates: a dot at the element's center, and one from the same
 * center large enough to reach the dialog's farthest corner. Measured at each call, so a moved
 * trigger still lines up.
 */
function iris(dialog: HTMLElement, from: Element) {
  const d = dialog.getBoundingClientRect();
  const b = from.getBoundingClientRect();
  const x = b.left + b.width / 2 - d.left;
  const y = b.top + b.height / 2 - d.top;
  const reach = Math.max(...[[0, 0], [d.width, 0], [0, d.height], [d.width, d.height]].map(([cx, cy]) => Math.hypot(cx! - x, cy! - y)));
  const circle = (r: number) => `circle(${r}px at ${x}px ${y}px)`;
  return { closed: circle(Math.min(b.width, b.height) / 2), open: circle(reach) };
}

export function dialogMotion(dialog: HTMLDialogElement, { placement = "center", from, duration = 0.3 }: DialogMotionOptions = {}): DialogMotion {
  const run = relay();
  const hidden = { opacity: 0, "--dialog-backdrop": 0 };
  const exit = placement === "center" ? { scale: 0.98 } : OFFSTAGE[placement];
  let rest = () => {};
  const close = (returnValue?: string) => {
    const tl = run.next();
    if (!dialog.open) return tl;
    const finish = () => {
      if (dialog.open) dialog.close(returnValue);
    };
    if (prefersReducedMotion()) return tl.call(finish);
    if (from) {
      // Back into the element it came from, then gone. At rest the clip is cleared; start from the full circle.
      const shape = iris(dialog, from);
      if (!dialog.style.clipPath) gsap.set(dialog, { clipPath: shape.open });
      return tl
        .to(dialog, { clipPath: shape.closed, "--dialog-backdrop": 0, duration: duration * 1.2, ease: "power3.in" })
        .set(dialog, { opacity: 0 })
        .call(finish);
    }
    return tl.to(dialog, { ...hidden, ...exit, duration: duration * 0.7, ease: "power2.in" }).call(finish);
  };
  const revert = own((dispose, after) => {
    rest = snapshotStyles([dialog], DIALOG_PROPS);
    after(rest);
    dispose(run.kill);
    // Browsers let a page cancel Escape once per user activation; an uncancelable
    // cancel closes at once and the close listener below still tidies up.
    listen(dispose, dialog, "cancel", (event) => {
      if (!event.cancelable) return;
      event.preventDefault();
      close();
    });
    // Every close, animated or not, ends at the dialog's own styles. The event is a
    // task after close(); a reopen already in flight by then keeps its start state.
    listen(dispose, dialog, "close", () => {
      if (dialog.open) return;
      run.kill();
      rest();
    });
  });
  return {
    open() {
      const tl = run.next();
      if (!dialog.open) {
        // Hidden before its first paint; focus still lands inside because opacity keeps the contents focusable.
        gsap.set(dialog, from ? hidden : { ...hidden, ...OFFSTAGE[placement] });
        dialog.showModal();
        // Measured once it is laid out: the clip starts as a dot on the element.
        if (from && !prefersReducedMotion()) gsap.set(dialog, { opacity: 1, clipPath: iris(dialog, from).closed });
      }
      if (prefersReducedMotion()) return tl.set(dialog, ONSTAGE);
      if (from) {
        // The circle opens past the farthest corner, then the clip clears, so nothing clips at rest.
        return tl
          .to(dialog, { opacity: 1, clipPath: iris(dialog, from).open, "--dialog-backdrop": 1, duration: duration * 2, ease: "power3.inOut" })
          .set(dialog, { clearProps: "clipPath" });
      }
      return tl.to(dialog, { ...ONSTAGE, duration, ease: "power3.out" });
    },
    close,
    revert,
  };
}

export type DisclosureOptions = { duration?: number; ease?: string };

export type Disclosure = {
  /** After the app shows the panel: grows from the current height to the content height, then clears the inline height. */
  open(): gsap.core.Timeline;
  /** Collapses to 0 and leaves `height: 0; overflow: hidden` inline. Apply `hidden` when it completes. */
  close(): gsap.core.Timeline;
  revert: Teardown;
};

const COLLAPSED = { height: 0, overflow: "hidden" };

export function disclosure(panel: HTMLElement, { duration = 0.3, ease = "power2.inOut" }: DisclosureOptions = {}): Disclosure {
  const run = relay();
  const saved = { height: panel.style.height, overflow: panel.style.overflow };
  /** Open rest: content-sized. The app's own values come back, except a pre-collapsed pair from the server. */
  const settleOpen = () => {
    const collapsed = saved.height !== "" && parseFloat(saved.height) === 0;
    gsap.set(panel, { clearProps: "height,overflow" });
    if (saved.height && !collapsed) panel.style.height = saved.height;
    if (saved.overflow && !collapsed) panel.style.overflow = saved.overflow;
  };
  const revert = own((dispose, after) => {
    after(snapshotStyles([panel], ["height", "overflow"]));
    dispose(run.kill);
    // Hidden, or inside a closed <details>: collapse now so showing it reveals nothing early.
    const rendered = panel.checkVisibility ? panel.checkVisibility() : panel.getClientRects().length > 0;
    if (!rendered) gsap.set(panel, COLLAPSED);
  });
  return {
    open() {
      const tl = run.next();
      if (prefersReducedMotion()) return tl.call(settleOpen);
      // The sanctioned layout tween: "auto" measures the content when the tween starts.
      return tl.set(panel, { overflow: "hidden" }).to(panel, { height: "auto", duration, ease }).call(settleOpen);
    },
    close() {
      const tl = run.next();
      if (prefersReducedMotion()) return tl.set(panel, COLLAPSED);
      return tl.set(panel, { overflow: "hidden" }).to(panel, { height: 0, duration, ease });
    },
    revert,
  };
}

export type TabIndicatorOptions = {
  duration?: number;
  ease?: string;
  /** The leading edge reaches the new tab first and the trailing edge catches up, so the indicator stretches as it travels. */
  stretch?: boolean;
};

export type TabIndicator = {
  /** Slides and resizes the indicator onto `tab`. Call it when the selected tab changes. */
  moveTo(tab: HTMLElement): gsap.core.Timeline;
  revert: Teardown;
};

export function tabIndicator(
  indicator: HTMLElement,
  tablist: HTMLElement,
  { duration = 0.3, ease = "power3.out", stretch = false }: TabIndicatorOptions = {},
): TabIndicator {
  const run = relay();
  let active: HTMLElement | undefined;
  let sliding = false;
  /** Transforms from the indicator's resting box onto the tab's, in viewport coordinates. */
  const fit = (tab: HTMLElement) => {
    const box = indicator.getBoundingClientRect();
    const target = tab.getBoundingClientRect();
    // With the origin at the left edge, only x moves that edge and only scaleX changes the width.
    const left = box.left - Number(gsap.getProperty(indicator, "x"));
    const width = box.width / Number(gsap.getProperty(indicator, "scaleX"));
    return { x: target.left - left, scaleX: target.width / width };
  };
  const revert = own((dispose, after) => {
    after(snapshotStyles([indicator], ["transform", "translate", "transform-origin"]));
    dispose(run.kill);
    gsap.set(indicator, { transformOrigin: "0% 50%" });
    active = tablist.querySelector<HTMLElement>('[aria-selected="true"]') ?? undefined;
    if (active) gsap.set(indicator, fit(active));
    let primed = false;
    const resize = new ResizeObserver(() => {
      // The first delivery only reports initial sizes; the indicator is already placed.
      if (!primed) {
        primed = true;
        return;
      }
      if (!active) return;
      // A tab that changes size as it becomes selected, such as a bolder label, must not cut the slide short: retarget it.
      if (sliding) slide(active);
      else run.next().set(indicator, fit(active));
    });
    resize.observe(tablist);
    tablist.querySelectorAll<HTMLElement>('[role="tab"]').forEach((tab) => resize.observe(tab));
    dispose(() => resize.disconnect());
  });
  /** Tweens from wherever the indicator is onto `tab`. */
  function slide(tab: HTMLElement): gsap.core.Timeline {
    active = tab;
    const tl = run.next();
    if (prefersReducedMotion()) return tl.set(indicator, fit(tab));
    sliding = true;
    const done = () => void (sliding = false);
    if (!stretch) return tl.to(indicator, { ...fit(tab), duration, ease, onComplete: done });
    // Stretch: span from the edge it leaves to the far edge of the new tab, then let the tail catch up.
    const from = indicator.getBoundingClientRect();
    const to = tab.getBoundingClientRect();
    const end = fit(tab);
    const width = to.width / end.scaleX;
    const left = to.left - end.x;
    const span = { x: Math.min(from.left, to.left) - left, scaleX: (Math.max(from.right, to.right) - Math.min(from.left, to.left)) / width };
    return tl
      .to(indicator, { ...span, duration: duration * 0.55, ease: "power2.in" })
      .to(indicator, { ...end, duration: duration * 0.75, ease: "back.out(1.6)", onComplete: done });
  }
  return {
    moveTo: slide,
    revert,
  };
}

export type PanelSwapOptions = { distance?: number; duration?: number };

/**
 * Tab panels swap with the direction of travel: the old panel slides away and the new one comes in from
 * the side the indicator moved toward. Stack the panels in one grid cell so the area keeps the tallest's
 * height. Pass `direction` 1 for a tab to the right, -1 for one to the left. Hidden panels stay hidden
 * through `autoAlpha`, so only the shown one is in the accessibility tree.
 */
export function panelSwap(
  outgoing: HTMLElement | null,
  incoming: HTMLElement,
  direction: 1 | -1,
  { distance = 36, duration = 0.4 }: PanelSwapOptions = {},
): gsap.core.Timeline {
  const tl = gsap.timeline();
  if (outgoing === incoming) return tl;
  if (prefersReducedMotion()) {
    if (outgoing) tl.set(outgoing, { autoAlpha: 0 });
    return tl.set(incoming, { autoAlpha: 1 });
  }
  if (outgoing) tl.to(outgoing, { x: -direction * distance, autoAlpha: 0, duration: duration * 0.5, ease: "power2.in", overwrite: true });
  return tl
    // The new panel waits until the old one has mostly gone, so the two texts never overlap to read.
    .fromTo(incoming, { x: direction * distance, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration, ease: "back.out(1.4)", overwrite: true }, outgoing ? duration * 0.45 : 0)
    .set(outgoing ? [incoming, outgoing] : [incoming], { clearProps: "x,transform" });
}

export type StateButtonOptions = {
  /** The text that lifts away. Defaults to `[data-state-label]` inside the button. */
  label?: HTMLElement;
  /** Seconds the check or the error holds before the label returns. */
  hold?: number;
  /** Seconds per spinner turn. */
  turn?: number;
  /** Sparks that burst from the button on success; 0 for none. */
  sparks?: number;
};
export type StateButton = {
  loading(): gsap.core.Timeline;
  /** Finishes the spin, draws the check as the button pops and sparks burst, announces `message`, then returns to the label. */
  success(message?: string): gsap.core.Timeline;
  /** Stops the spin, draws a cross, shakes, announces `message`, and returns to the label. */
  error(message?: string): gsap.core.Timeline;
  /** Straight back to the label. */
  reset(): gsap.core.Timeline;
  revert: Teardown;
};

const SPINNER = `<svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-dasharray="42 100"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12.5 10 17.5 19 7"/></svg>`;
const CROSS = `<svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M7 7 17 17"/><path d="M17 7 7 17"/></svg>`;
/** Swings for the error shake, narrowing to rest. */
const SWINGS = [1, -0.8, 0.55, -0.3, 0.12, 0];

export function stateButton(
  button: HTMLElement,
  { label = button.querySelector<HTMLElement>("[data-state-label]") ?? undefined, hold = 1.4, turn = 0.8, sparks = 8 }: StateButtonOptions = {},
): StateButton {
  if (!label) throw new Error("stateButton needs a [data-state-label] element inside the button");
  const target = label;
  const reduced = prefersReducedMotion();
  const runs = relay();
  let spin: gsap.core.Tween | undefined;
  let spinner!: HTMLElement;
  let check!: HTMLElement;
  let cross!: HTMLElement;
  let status!: HTMLElement;
  let mark!: SVGPolylineElement;

  const revert = own((dispose, after) => {
    // The label's style attribute comes back exactly, including none at all. Registered first, so it runs last.
    const labelStyle = target.getAttribute("style");
    after(() => {
      gsap.set(target, { clearProps: "opacity,visibility,transform,translate" });
      // Read the attribute first: Chrome can write a just-cleared inline style back as style="" after a removal.
      void target.getAttribute("style");
      if (labelStyle === null) target.removeAttribute("style");
      else target.setAttribute("style", labelStyle);
    });
    after(snapshotStyles([button], ["position", "transform", "translate"]));
    const busy = button.getAttribute("aria-busy");
    after(() => (busy === null ? button.removeAttribute("aria-busy") : button.setAttribute("aria-busy", busy)));
    if (getComputedStyle(button).position === "static") button.style.position = "relative";
    const icon = (html: string) => {
      const holder = document.createElement("span");
      holder.setAttribute("aria-hidden", "true");
      Object.assign(holder.style, { position: "absolute", inset: "0", display: "grid", placeItems: "center", pointerEvents: "none", visibility: "hidden", opacity: "0" });
      holder.innerHTML = html;
      button.append(holder);
      after(() => holder.remove());
      return holder;
    };
    spinner = icon(SPINNER);
    check = icon(CHECK);
    mark = check.querySelector("polyline")!;
    cross = icon(CROSS);
    status = document.createElement("span");
    status.setAttribute("role", "status");
    Object.assign(status.style, { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" });
    button.after(status);
    after(() => status.remove());
    dispose(() => {
      runs.kill();
      spin?.kill();
      gsap.killTweensOf([button, target, spinner, check, mark, cross, ...cross.querySelectorAll("path")]);
      button.querySelectorAll("[data-state-spark]").forEach((spark) => spark.remove());
    });
  });

  const length = 20;
  /** The label returns and every icon goes. */
  const settle = (tl: gsap.core.Timeline, at: number | string) =>
    tl
      .to([spinner, check, cross], { autoAlpha: 0, duration: reduced ? 0 : 0.2 }, at)
      .fromTo(target, { autoAlpha: 0, y: reduced ? 0 : 10 }, { autoAlpha: 1, y: 0, duration: reduced ? 0 : 0.35, ease: "back.out(1.8)" }, "<0.05")
      .call(() => button.removeAttribute("aria-busy"));

  return {
    loading() {
      const tl = runs.next();
      button.setAttribute("aria-busy", "true");
      status.textContent = "";
      tl.to(target, { autoAlpha: 0, y: reduced ? 0 : -10, duration: reduced ? 0 : 0.2, ease: "power2.in" }).to(spinner, { autoAlpha: 1, duration: reduced ? 0 : 0.2 }, "<0.1");
      spin?.kill();
      if (!reduced) spin = gsap.fromTo(spinner, { rotation: 0 }, { rotation: 360, duration: turn, ease: "none", repeat: -1 });
      return tl;
    },
    success(message = "Done") {
      const tl = runs.next();
      status.textContent = message;
      // Finish the turn in progress at the same speed, so the spinner never jumps.
      const left = spin ? (1 - spin.progress()) * turn : 0;
      spin?.kill();
      if (!reduced) tl.to(spinner, { rotation: 360, duration: left, ease: "none" });
      tl.to(spinner, { autoAlpha: 0, duration: reduced ? 0 : 0.15 })
        .set(mark, { attr: { "stroke-dasharray": length, "stroke-dashoffset": reduced ? 0 : length } })
        .set(check, { autoAlpha: 1 })
        .to(mark, { attr: { "stroke-dashoffset": 0 }, duration: reduced ? 0 : 0.4, ease: "power2.out" });
      if (!reduced) {
        // The button pops as the check lands, and sparks burst from its edge.
        const at = tl.duration() - 0.4;
        tl.to(button, { keyframes: { scale: [1, 1.08, 0.98, 1] }, duration: 0.5, ease: "power1.out" }, at);
        const box = button.getBoundingClientRect();
        const reach = Math.max(box.width, box.height) / 2;
        for (let i = 0; i < sparks; i++) {
          const spark = document.createElement("i");
          spark.setAttribute("aria-hidden", "true");
          spark.dataset.stateSpark = "";
          const angle = (i / sparks) * 360;
          Object.assign(spark.style, {
            position: "absolute", left: "50%", top: "50%", width: "14px", height: "2px", marginLeft: "-7px", marginTop: "-1px",
            borderRadius: "2px", background: "currentColor", pointerEvents: "none", opacity: "0",
          });
          button.append(spark);
          const [dx, dy] = [Math.cos((angle * Math.PI) / 180), Math.sin((angle * Math.PI) / 180)];
          tl.fromTo(
            spark,
            { rotation: angle, x: dx * reach * 0.6, y: dy * reach * 0.35, scaleX: 0.4, opacity: 1 },
            { x: dx * (reach + 26), y: dy * (box.height / 2 + 26), scaleX: 1.4, opacity: 0, duration: 0.55, ease: "power3.out", onComplete: () => spark.remove() },
            at + 0.05,
          );
        }
      }
      return settle(tl, `+=${hold}`);
    },
    error(message = "That didn't work. Try again.") {
      const tl = runs.next();
      status.textContent = message;
      spin?.kill();
      // The spinner snaps into a cross: each stroke draws in turn, then the button shakes its head.
      const strokes = Array.from(cross.querySelectorAll("path"));
      tl.to(spinner, { autoAlpha: 0, duration: reduced ? 0 : 0.15 })
        .set(strokes, { attr: { "stroke-dasharray": 15, "stroke-dashoffset": reduced ? 0 : 15 } })
        .set(cross, { autoAlpha: 1 });
      if (!reduced) {
        tl.to(strokes, { attr: { "stroke-dashoffset": 0 }, duration: 0.18, ease: "power2.out", stagger: 0.1 });
        const width = 9;
        for (const swing of SWINGS) tl.to(button, { x: swing * width, rotation: swing * 2.5, duration: 0.5 / SWINGS.length, ease: "sine.inOut" }, ">");
      }
      return settle(tl, `+=${hold * 0.6}`);
    },
    reset() {
      const tl = runs.next();
      spin?.kill();
      status.textContent = "";
      return settle(tl, 0);
    },
    revert,
  };
}

