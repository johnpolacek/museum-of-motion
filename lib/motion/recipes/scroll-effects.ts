// Copied from the animaxxing skill: references/recipes/scroll-effects.md. Edit in place; see the recipe for the contract.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(ScrollTrigger, SplitText, Flip);

/* Swap for the project's helper if it has one. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Seconds the scrubbed playhead takes to catch up with the scrollbar. `true` locks it. */
const SCRUB = 0.6;
/** Where a reveal fires: the item's top crosses this line of the viewport. */
const REVEAL_START = "top 85%";
/** Opacity of unread words in a scrubbed statement. */
const UNREAD = 0.15;
/** Largest velocity skew, degrees. */
const MAX_SKEW = 8;
/** Scroll velocity (px/s) per degree of skew. */
const SKEW_PER = 300;

export type Teardown = () => void;
export type Scroller = Element | string | undefined;

type Register = (fn: () => void) => void;

/**
 * Runs setup in its own GSAP context, which reverts its tweens, triggers, pins, and splits (SplitText 3.13+).
 * Returns a once-only teardown that also rolls back a throw. `dispose` stops writers before the revert; `after` restores after it.
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

/** Inline properties a scrubbed scene may leave behind. */
const SCENE_PROPS = ["transform", "translate", "rotate", "scale", "opacity", "visibility", "filter", "clip-path"];

/**
 * Records these inline properties and returns a restore. Reverting a scrubbed, pinned
 * timeline can leave start values inline; `clearProps` also resets GSAP's cached transform.
 */
function snapshotStyles(elements: HTMLElement[], props = SCENE_PROPS): () => void {
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

export type RevealOptions = {
  start?: string;
  /** Rise distance in px. */
  y?: number;
  /** Starting scale, such as 0 for a pop; omitted leaves scale alone. */
  scale?: number;
  /** Starting rotation in degrees; omitted leaves rotation alone. */
  rotation?: number;
  duration?: number;
  stagger?: number;
  /** Accepts a registered CustomEase name. */
  ease?: string;
  scroller?: Scroller;
};

export function revealOnScroll(
  targets: gsap.DOMTarget,
  { start = REVEAL_START, y = 16, scale, rotation, duration = 0.42, stagger = 0.09, ease = "power3.out", scroller }: RevealOptions = {},
): Teardown {
  const items = gsap.utils.toArray<HTMLElement>(targets);
  if (!items.length || prefersReducedMotion()) return () => {};
  return own((dispose) => {
    // Reveal tweens start later, outside the context, so they are tracked here.
    const live = new Set<gsap.core.Tween>();
    dispose(() => live.forEach((tween) => tween.kill()));
    // Opacity only: visibility would drop waiting items from the accessibility tree and the tab order.
    const from: gsap.TweenVars = { opacity: 0, y };
    const to: gsap.TweenVars = { opacity: 1, y: 0 };
    if (scale !== undefined) {
      from.scale = scale;
      to.scale = 1;
    }
    if (rotation !== undefined) {
      from.rotation = rotation;
      to.rotation = 0;
    }
    gsap.set(items, from);
    ScrollTrigger.batch(items, {
      start,
      once: true,
      scroller,
      onEnter: (batch) => {
        const tween = gsap.to(batch, {
          ...to,
          duration,
          stagger,
          ease,
          overwrite: "auto",
          onComplete: () => {
            live.delete(tween);
            gsap.set(batch, { clearProps: "transform,opacity" });
          },
        });
        live.add(tween);
      },
    });
    // Focus can reach an item before it crosses the line; a focused item is never invisible.
    const onFocus = (event: FocusEvent) => {
      const item = event.currentTarget as HTMLElement;
      // Only the reveal's own properties; other effects on the item keep running.
      gsap.killTweensOf(item, "opacity,y,scale,rotation");
      gsap.set(item, { clearProps: "transform,opacity" });
    };
    items.forEach((item) => item.addEventListener("focusin", onFocus));
    dispose(() => items.forEach((item) => item.removeEventListener("focusin", onFocus)));
  });
}

export type StatementOptions = { by?: "words" | "chars"; scrub?: number | boolean; scroller?: Scroller };

export function scrubStatement(
  element: HTMLElement,
  { by = "words", scrub = SCRUB, scroller }: StatementOptions = {},
): Teardown {
  if (prefersReducedMotion()) return () => {};
  return own(() => {
    const split = SplitText.create(element, { type: by === "chars" ? "words,chars" : "words", aria: "auto" });
    const pieces = (by === "chars" ? split.chars : split.words) as HTMLElement[];
    gsap.fromTo(
      pieces,
      { opacity: UNREAD },
      {
        opacity: 1,
        ease: "none",
        stagger: 0.1,
        scrollTrigger: { trigger: element, start: "top 80%", end: "bottom 45%", scrub, scroller },
      },
    );
  });
}

export type ParallaxOptions = {
  scrub?: number | boolean;
  /** Trigger bounds; the default spans the section's whole pass through the viewport. */
  start?: string;
  end?: string;
  scroller?: Scroller;
};

export function parallax(
  section: HTMLElement,
  { scrub = true, start = "top bottom", end = "bottom top", scroller }: ParallaxOptions = {},
): Teardown {
  const layers = gsap.utils.toArray<HTMLElement>("[data-parallax]", section);
  if (!layers.length || prefersReducedMotion()) return () => {};
  return own(() => {
    layers.forEach((layer) => {
      const travel = Number(layer.dataset.parallax) || 0;
      gsap.fromTo(
        layer,
        { y: -travel },
        {
          y: travel,
          ease: "none",
          scrollTrigger: { trigger: section, start, end, scrub, scroller },
        },
      );
    });
  });
}

export type SceneOptions = { length?: number; scrub?: number | boolean; scroller?: Scroller };

export function pinnedScene(
  section: HTMLElement,
  build: (timeline: gsap.core.Timeline, section: HTMLElement) => void,
  { length = 1, scrub = SCRUB, scroller }: SceneOptions = {},
): Teardown {
  if (prefersReducedMotion()) return () => {};
  return own((_dispose, after) => {
    const saved = new Map(gsap.utils.toArray<HTMLElement>("*", section).map((element) => [element, snapshotStyles([element])]));
    // A closure below reads it before it is assigned, so it must stay `let`.
    // eslint-disable-next-line prefer-const
    let animated: Set<unknown> | undefined;
    // Restore only what the scene animates; other effects inside it keep their inline values. A failed build restores all.
    after(() => saved.forEach((restore, element) => (!animated || animated.has(element)) && restore()));
    const timeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${section.offsetHeight * length}`,
        pin: true,
        scrub,
        scroller,
        anticipatePin: 1,
      },
    });
    build(timeline, section);
    animated = new Set(timeline.getChildren(true, true, false).flatMap((tween) => (tween as gsap.core.Tween).targets()));
  });
}

export type RunOptions = { scrub?: number | boolean; scroller?: Scroller };
export type Run = { revert: Teardown; animation: gsap.core.Tween | undefined };

export function horizontalRun(
  section: HTMLElement,
  track: HTMLElement,
  { scrub = SCRUB, scroller }: RunOptions = {},
): Run {
  if (prefersReducedMotion()) return { revert: () => {}, animation: undefined };
  let animation: gsap.core.Tween | undefined;
  const revert = own((dispose, after) => {
    after(snapshotStyles([track]));
    /** The section's content box, so padding stays visible at both ends of the run. */
    const viewport = () => {
      const style = getComputedStyle(section);
      return section.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    };
    const distance = () => Math.max(0, track.scrollWidth - viewport());
    section.scrollLeft = 0;
    gsap.set(section, { overflow: "hidden" });
    animation = gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${distance()}`,
        pin: true,
        scrub,
        scroller,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
    const trigger = animation.scrollTrigger;
    const onFocus = (event: FocusEvent) => {
      const item = event.target as HTMLElement;
      const travel = distance();
      section.scrollLeft = 0;
      // Pressing a card focuses it too; only keyboard focus should scroll the page.
      if (!trigger || !travel || !item.matches(":focus-visible")) return;
      const left = item.getBoundingClientRect().left - track.getBoundingClientRect().left;
      const x = gsap.utils.clamp(0, travel, left - (viewport() - item.offsetWidth) / 2);
      trigger.scroll(trigger.start + (x / travel) * (trigger.end - trigger.start));
    };
    section.addEventListener("focusin", onFocus);
    dispose(() => section.removeEventListener("focusin", onFocus));
  });
  return { revert, animation };
}

export function runDrift(track: HTMLElement, run: Run, { scrub = true }: { scrub?: number | boolean } = {}): Teardown {
  const items = gsap.utils.toArray<HTMLElement>("[data-run-drift]", track);
  const containerAnimation = run.animation;
  if (!items.length || !containerAnimation || prefersReducedMotion()) return () => {};
  return own((_dispose, after) => {
    after(snapshotStyles(items));
    items.forEach((item) => {
      const travel = Number(item.dataset.runDrift) || 0;
      gsap.fromTo(
        item,
        { x: -travel },
        {
          x: travel,
          ease: "none",
          scrollTrigger: { trigger: item, containerAnimation, start: "left right", end: "right left", scrub },
        },
      );
    });
  });
}

export type WaypointOptions = {
  scrub?: number | boolean;
  /** Ease of each leg between stops. */
  ease?: string;
  scroller?: Scroller;
};

export function scrollWaypoints(
  traveller: HTMLElement,
  stops: HTMLElement[],
  { scrub = SCRUB, ease = "power1.inOut", scroller }: WaypointOptions = {},
): Teardown {
  if (prefersReducedMotion() || !stops.length) return () => {};
  return own((dispose, after) => {
    after(snapshotStyles([traveller]));
    const view = () => {
      const box = typeof scroller === "string" ? document.querySelector(scroller) : scroller;
      if (!box) {
        const height = window.innerHeight;
        return { top: 0, scroll: window.scrollY, height, max: document.documentElement.scrollHeight - height };
      }
      return { top: box.getBoundingClientRect().top, scroll: box.scrollTop, height: box.clientHeight, max: box.scrollHeight - box.clientHeight };
    };
    let legs: gsap.Context | undefined;
    const build = () => {
      // Back to its place first: every fit and distance is measured from rest.
      legs?.revert();
      legs = gsap.context(() => {
        const v = view();
        /** Scroll position where an element's middle meets the viewport's, clamped to the scrollable range. */
        const arrival = (element: Element) => {
          const rect = element.getBoundingClientRect();
          return gsap.utils.clamp(0, v.max, rect.top - v.top + v.scroll + rect.height / 2 - v.height / 2);
        };
        const at = [traveller, ...stops].map(arrival);
        const timeline = gsap.timeline({ scrollTrigger: { start: at[0], end: at[at.length - 1], scrub, scroller } });
        stops.forEach((stop, i) => {
          // getVars measures from rest, so each leg ends exactly on its marker whatever came before.
          const fit = Flip.fit(traveller, stop, { getVars: true, scale: true }) as gsap.TweenVars;
          // A leg lasts the scroll between its stops, so the traveller lands as its marker reaches the middle.
          timeline.to(traveller, { ...fit, ease, duration: Math.max(at[i + 1]! - at[i]!, 0.001) });
        });
      });
    };
    build();
    ScrollTrigger.addEventListener("refreshInit", build);
    dispose(() => ScrollTrigger.removeEventListener("refreshInit", build));
    dispose(() => legs?.revert());
  });
}

export type ProgressOptions = { section?: HTMLElement; scroller?: Scroller };

export function scrollProgress(bar: HTMLElement, { section, scroller }: ProgressOptions = {}): Teardown {
  const reduced = prefersReducedMotion();
  return own(() => {
    gsap.fromTo(
      bar,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: "none",
        transformOrigin: "0% 50%",
        scrollTrigger: section
          ? { trigger: section, start: "top top", end: "bottom bottom", scrub: reduced ? true : 0.3, scroller }
          : { start: 0, end: "max", scrub: reduced ? true : 0.3, scroller },
      },
    );
  });
}

export type SkewOptions = { max?: number; scroller?: Scroller };

export function velocitySkew(targets: gsap.DOMTarget, { max = MAX_SKEW, scroller }: SkewOptions = {}): Teardown {
  const items = gsap.utils.toArray<HTMLElement>(targets);
  if (!items.length || prefersReducedMotion()) return () => {};
  return own((dispose) => {
    const clamp = gsap.utils.clamp(-max, max);
    const lean = { skew: 0 };
    // Recorded so the context restores each target's original transform.
    gsap.set(items, { skewY: 0, transformOrigin: "50% 50%" });
    const setSkew = gsap.quickSetter(items, "skewY", "deg");
    let settle: gsap.core.Tween | undefined;
    dispose(() => settle?.kill());
    ScrollTrigger.create({
      scroller,
      onUpdate: (self) => {
        const skew = clamp(self.getVelocity() / -SKEW_PER);
        if (Math.abs(skew) <= Math.abs(lean.skew)) return;
        lean.skew = skew;
        settle?.kill();
        settle = gsap.to(lean, {
          skew: 0,
          duration: 0.8,
          ease: "power3.out",
          onUpdate: () => setSkew(lean.skew),
        });
      },
    });
  });
}

export type NavThemeOptions = { sections?: string; scroller?: Scroller };

export function navTheme(header: HTMLElement, { sections = "[data-nav-theme]", scroller }: NavThemeOptions = {}): Teardown {
  return own((_dispose, after) => {
    const original = header.getAttribute("data-nav-theme");
    after(() => {
      if (original === null) header.removeAttribute("data-nav-theme");
      else header.setAttribute("data-nav-theme", original);
    });
    // The header's own `data-nav-theme` is output, never a section.
    const owners = gsap.utils.toArray<HTMLElement>(sections).filter((section) => section !== header && !header.contains(section));
    // Function values re-measure the header on every refresh.
    const line = () => header.offsetHeight / 2;
    owners.forEach((section) => {
      ScrollTrigger.create({
        trigger: section,
        start: () => `top ${line()}`,
        end: () => `bottom ${line()}`,
        scroller,
        onToggle: (self) => {
          if (self.isActive) header.setAttribute("data-nav-theme", section.dataset.navTheme ?? "");
        },
      });
    });
  });
}

export type ScrollDirectionOptions = {
  /** Scroll distance in px before the page counts as started. */
  top?: number;
  /** Px of travel in the new direction before it flips, so a jittery trackpad does not flicker the header. */
  threshold?: number;
  scroller?: Scroller;
};

export function scrollDirection(
  target: HTMLElement = document.documentElement,
  { top = 50, threshold = 8, scroller }: ScrollDirectionOptions = {},
): Teardown {
  return own((_dispose, after) => {
    const attributes = ["data-scroll-direction", "data-scroll-started"];
    const original = attributes.map((name) => target.getAttribute(name));
    after(() =>
      attributes.forEach((name, i) => {
        const value = original[i];
        if (value === null || value === undefined) target.removeAttribute(name);
        else target.setAttribute(name, value);
      }),
    );
    let direction = "up";
    let turn = 0;
    const write = (y: number) => {
      target.setAttribute("data-scroll-direction", direction);
      target.setAttribute("data-scroll-started", String(y > top));
    };
    const trigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      scroller,
      onUpdate: (self) => {
        const y = self.scroll();
        const next = self.direction === 1 ? "down" : "up";
        // `turn` is the furthest point reached in the current direction.
        if (next === direction) turn = y;
        else if (Math.abs(y - turn) >= threshold) {
          direction = next;
          turn = y;
        }
        write(y);
      },
    });
    turn = trigger.scroll();
    write(turn);
  });
}

export type StackOptions = {
  /** Px from the viewport top where the first card pins. */
  top?: number;
  /** Px each later card pins below the one before, so the edges of the deck show. */
  offset?: number;
  /** Scale lost per card stacked on top. */
  shrink?: number;
  scrub?: number | boolean;
  scroller?: Scroller;
};

export function stackCards(
  cards: HTMLElement[],
  { top = 80, offset = 16, shrink = 0.05, scrub = SCRUB, scroller }: StackOptions = {},
): Teardown {
  if (prefersReducedMotion() || cards.length < 2) return () => {};
  return own((_dispose, after) => {
    after(snapshotStyles(cards));
    const last = cards[cards.length - 1]!;
    const pinAt = (i: number) => `top top+=${top + i * offset}`;
    cards.slice(0, -1).forEach((card, i) => {
      // Every card holds until the last one lands on the deck, then all of them leave together.
      ScrollTrigger.create({ trigger: card, scroller, start: pinAt(i), endTrigger: last, end: pinAt(cards.length - 1), pin: true, pinSpacing: false });
      const buried = cards.length - 1 - i;
      gsap.to(card, {
        scale: 1 - shrink * buried,
        transformOrigin: "50% 0%",
        ease: "none",
        scrollTrigger: { trigger: cards[i + 1]!, scroller, start: "top bottom", endTrigger: last, end: pinAt(cards.length - 1), scrub },
      });
    });
  });
}

export type ZoomOptions = {
  mode?: "scale" | "clip";
  /** `scale` mode: the part of `target` to fly into, HTML or SVG. Defaults to its center. */
  focus?: Element;
  /** `scale` mode: the final scale. */
  scale?: number;
  /** `clip` mode: the starting window, as `inset()` arguments. Give all four sides and a radius, so each value tweens to its pair. */
  inset?: string;
  /** Pinned distance, in section heights. */
  length?: number;
  scrub?: number | boolean;
  scroller?: Scroller;
};

export function zoomThrough(
  section: HTMLElement,
  target: HTMLElement,
  { mode = "scale", focus, scale = 30, inset = "30% 34% 30% 34% round 12px", length = 1.5, scrub = SCRUB, scroller }: ZoomOptions = {},
): Teardown {
  if (prefersReducedMotion()) return () => {};
  return own((_dispose, after) => {
    after(snapshotStyles([...new Set([target, ...gsap.utils.toArray<HTMLElement>(section.children)])]));
    const behind = Array.from(section.children).filter((child): child is HTMLElement => child !== target && child instanceof HTMLElement);
    const timeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: section, start: "top top", end: () => `+=${section.offsetHeight * length}`, pin: true, scrub, scroller, anticipatePin: 1, invalidateOnRefresh: true },
    });
    if (mode === "clip") {
      timeline.fromTo(target, { clipPath: `inset(${inset})` }, { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "power2.inOut" }, 0);
      return;
    }
    // The origin is the focus's center within the target, measured at scale 1. It is measured again at
    // each refresh, so a font or layout change after the build still flies into the right spot.
    const origin = () => {
      const current = gsap.getProperty(target, "scale");
      gsap.set(target, { scale: 1 });
      const box = target.getBoundingClientRect();
      const spot = (focus ?? target).getBoundingClientRect();
      gsap.set(target, { scale: current });
      return `${spot.left + spot.width / 2 - box.left}px ${spot.top + spot.height / 2 - box.top}px`;
    };
    // force3D off keeps scaled text crisp: a cached layer would blur at this size.
    timeline
      .fromTo(target, { scale: 1, transformOrigin: origin }, { scale, ease: "power2.in", force3D: false }, 0)
      .to(target, { autoAlpha: 0, duration: 0.15 }, 0.85)
      .fromTo(behind, { scale: 1.15 }, { scale: 1, ease: "power2.out" }, 0);
  });
}
