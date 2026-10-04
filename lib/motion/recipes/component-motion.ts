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
  duration?: number;
};

export type DialogMotion = {
  /** Calls `showModal()` unless already open, then animates the backdrop and panel in. */
  open(): gsap.core.Timeline;
  /** Animates out, then calls `dialog.close(returnValue)`. */
  close(returnValue?: string): gsap.core.Timeline;
  revert: Teardown;
};

const DIALOG_PROPS = ["opacity", "transform", "translate", "--dialog-backdrop"];
const ONSTAGE = { opacity: 1, x: 0, y: 0, xPercent: 0, yPercent: 0, scale: 1, "--dialog-backdrop": 1 };
const OFFSTAGE: Record<DialogPlacement, gsap.TweenVars> = {
  center: { scale: 0.96, y: 8 },
  top: { yPercent: -100 },
  bottom: { yPercent: 100 },
  left: { xPercent: -100 },
  right: { xPercent: 100 },
};

export function dialogMotion(dialog: HTMLDialogElement, { placement = "center", duration = 0.3 }: DialogMotionOptions = {}): DialogMotion {
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
        gsap.set(dialog, { ...hidden, ...OFFSTAGE[placement] });
        dialog.showModal();
      }
      if (prefersReducedMotion()) return tl.set(dialog, ONSTAGE);
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

export type TabIndicatorOptions = { duration?: number; ease?: string };

export type TabIndicator = {
  /** Slides and resizes the indicator onto `tab`. Call it when the selected tab changes. */
  moveTo(tab: HTMLElement): gsap.core.Timeline;
  revert: Teardown;
};

export function tabIndicator(
  indicator: HTMLElement,
  tablist: HTMLElement,
  { duration = 0.3, ease = "power3.out" }: TabIndicatorOptions = {},
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
    return tl.to(indicator, { ...fit(tab), duration, ease, onComplete: () => void (sliding = false) });
  }
  return {
    moveTo: slide,
    revert,
  };
}
