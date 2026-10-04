// Copied from the animaxxing skill: references/recipes/section-pager.md. Edit in place; see the recipe for the contract.
import gsap from "gsap";
import { Observer } from "gsap/Observer";

gsap.registerPlugin(Observer);

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
      gsap.set(element, { clearProps: props.join(",") });
      props.forEach((prop, j) => {
        const [value, priority] = saved[i]?.[j] ?? ["", ""];
        if (value) element.style.setProperty(prop, value, priority);
        else element.style.removeProperty(prop);
      });
    });
}

export type SectionPagerOptions = {
  /** Index shown at build, such as from the URL hash. */
  start?: number;
  duration?: number;
  /** Percent the outgoing section drifts while the next covers it; 0 for a straight cover. */
  drift?: number;
  /** Wheels, swipes, and keys inside these never page. */
  ignore?: string;
  /** Wraps from the last section to the first and back. */
  loop?: boolean;
  /**
   * Local edit for the Museum of Motion: a pager embedded in a page rather than owning it.
   * The page keeps its scroll, and keys page only while focus is inside the container.
   */
  embedded?: boolean;
  /**
   * Called as a move starts. Update navigation state here, or nest a section
   * entrance on `timeline`; revert that builder yourself on teardown.
   */
  onChange?: (index: number, previous: number, timeline: gsap.core.Timeline) => void;
};

export type SectionPager = {
  /** Moves to a section, finishing any move in flight first. Undefined when already there. */
  goTo(index: number): gsap.core.Timeline | undefined;
  next(): gsap.core.Timeline | undefined;
  previous(): gsap.core.Timeline | undefined;
  index(): number;
  /** Stops gestures and keys paging, such as while a dialog is open. */
  disable(): void;
  enable(): void;
  revert: Teardown;
};

const SECTION_PROPS = ["transform", "translate", "z-index"];
/** Arrow keys belong to these; paging would steal them. */
const COMPOSITE =
  "input, textarea, select, [contenteditable], audio, video, [role=tablist], [role=radiogroup], [role=slider], [role=listbox], " +
  "[role=menu], [role=menubar], [role=grid], [role=combobox], [role=spinbutton], [role=tree], [role=treegrid], [role=scrollbar]";
/** Space activates or toggles these. */
const ACTIVATES =
  "a[href], button, summary, [role=button], [role=link], [role=checkbox], [role=switch], [role=menuitem], " +
  "[role=menuitemcheckbox], [role=menuitemradio], [role=option], [role=tab], [role=treeitem]";
const STEP: Record<string, number> = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 };

export function sectionPager(
  container: HTMLElement,
  {
    start = 0,
    duration = 0.9,
    drift = 30,
    ignore = "input, textarea, select, [contenteditable], [data-pager-ignore]",
    loop = false,
    embedded = false,
    onChange,
  }: SectionPagerOptions = {},
): SectionPager {
  const sections = Array.from(container.children).filter((el): el is HTMLElement => el instanceof HTMLElement);
  const last = sections.length - 1;
  let current = Math.min(Math.max(0, start), Math.max(0, last));
  let moving: gsap.core.Timeline | undefined;
  let observer: Observer | undefined;
  let enabled = true;
  /** A wheel or swipe already moved a section; the next move waits for that gesture to rest. */
  let spent = false;

  const park = () =>
    sections.forEach((section, i) => gsap.set(section, i === current ? { yPercent: 0, zIndex: 1 } : { yPercent: 100, zIndex: 0 }));

  const goTo = (target: number): gsap.core.Timeline | undefined => {
    const index = loop ? gsap.utils.wrap(0, last + 1, target) : gsap.utils.clamp(0, last, target);
    if (index === current || last < 0) return undefined;
    // Finish the move in flight so exactly two sections are ever moving.
    moving?.progress(1);
    const direction = target > current ? 1 : -1;
    const previous = current;
    const from = sections[previous]!;
    const to = sections[index]!;
    current = index;
    const tl = gsap.timeline({ defaults: { overwrite: "auto" } });
    moving = tl;
    gsap.set(sections, { zIndex: 0 });
    gsap.set(from, { zIndex: 1 });
    gsap.set(to, { zIndex: 2 });
    if (prefersReducedMotion()) tl.set(to, { yPercent: 0 });
    else {
      tl.fromTo(to, { yPercent: 100 * direction }, { yPercent: 0, duration, ease: "power3.inOut" }).to(
        from,
        { yPercent: -drift * direction, duration, ease: "power3.inOut" },
        0,
      );
    }
    // A call, not onComplete, so the app can set its own callbacks on the returned timeline.
    tl.call(() => {
      if (moving === tl) moving = undefined;
      park();
    });
    onChange?.(index, previous, tl);
    return tl;
  };

  const intent = (step: number) => {
    if (!enabled || spent || moving) return;
    spent = true;
    goTo(current + step);
  };

  const revert = own((dispose, after) => {
    const root = document.documentElement;
    after(snapshotStyles([root], ["overflow", "overscroll-behavior"]));
    after(snapshotStyles(sections, SECTION_PROPS));
    const hadAttribute = container.hasAttribute("data-pager");
    after(() => {
      if (!hadAttribute) container.removeAttribute("data-pager");
    });
    dispose(() => moving?.kill());

    container.setAttribute("data-pager", "");
    if (!embedded) {
      root.style.overflow = "hidden";
      root.style.overscrollBehavior = "none";
    }
    park();

    observer = Observer.create({
      target: container,
      type: "wheel,touch",
      // With wheelSpeed -1, scrolling down and swiping up both report "up".
      wheelSpeed: -1,
      tolerance: 10,
      preventDefault: true,
      // Checked per event, so fields and scrollers rendered after build are ignored too.
      ignoreCheck: (event) => event.target instanceof Element && !!event.target.closest(ignore),
      // Each touch starts a new gesture; a tap never restarts the rest timer.
      onPress: () => {
        spent = false;
      },
      onUp: () => intent(1),
      onDown: () => intent(-1),
      onStop: () => {
        spent = false;
      },
      onStopDelay: 0.2,
    });
    dispose(() => observer?.kill());

    const onKey = (event: KeyboardEvent) => {
      if (!enabled || event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target && target !== document.body && !container.contains(target)) return;
      if (embedded && !(target && container.contains(target))) return;
      if (target?.closest(ignore) || target?.closest(COMPOSITE)) return;
      let index: number | undefined;
      if (event.key === "Home") index = 0;
      else if (event.key === "End") index = last;
      else if (event.key === " ") {
        if (target?.closest(ACTIVATES)) return;
        index = current + (event.shiftKey ? -1 : 1);
      } else if (event.key in STEP) index = current + STEP[event.key]!;
      if (index === undefined) return;
      event.preventDefault();
      if (!moving) goTo(index);
    };
    window.addEventListener("keydown", onKey);
    dispose(() => window.removeEventListener("keydown", onKey));

    // Focus landing in a parked section, from Tab or find-in-page, shows it at once.
    const onFocus = (event: FocusEvent) => {
      const index = sections.findIndex((section) => section.contains(event.target as Node));
      if (index >= 0 && index !== current) goTo(index)?.progress(1);
    };
    container.addEventListener("focusin", onFocus);
    dispose(() => container.removeEventListener("focusin", onFocus));
  });

  return {
    goTo,
    next: () => goTo(current + 1),
    previous: () => goTo(current - 1),
    index: () => current,
    disable() {
      enabled = false;
      observer?.disable();
    },
    enable() {
      enabled = true;
      spent = false;
      observer?.enable();
    },
    revert,
  };
}
