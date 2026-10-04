// Collection builders: a group reveal on scroll, the hover and focus widen, and the outro
// where the chosen name holds while the rest leave. The CollectionMotion controller decides when.
import { gsap, prefersReducedMotion } from "./gsap";

const ENTER = "signature";
const EXIT = "signature-exit";
/** Hover widens a name from its resting 82% (globals.css). Centered, 88% stays inside the gap to each separator. */
const WIDE = "88%";

const all = (root: ParentNode, sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));

/**
 * Holds each element's layout box at its resting width, as an inline-block, so a weight or
 * width change inside it never rewraps the paragraph. Reads first, then writes.
 */
function pin(els: HTMLElement[], align = "left") {
  const widths = els.map((el) => el.getBoundingClientRect().width);
  els.forEach((el, i) => gsap.set(el, { display: "inline-block", width: widths[i], textAlign: align }));
}
const UNPIN = "display,width,textAlign";

export type Reveal = { timeline: gsap.core.Timeline; finish: () => void };

/** The collection heading widens into place and its count rises. Paused, start values applied. */
export function headerReveal(header: HTMLElement): Reveal {
  const tl = gsap.timeline({ paused: true, defaults: { overwrite: "auto" } });
  const title = header.querySelector<HTMLElement>("h2")!;
  const count = header.querySelector<HTMLElement>(".lab")!;
  const finish = () => gsap.set([title, count], { clearProps: "opacity,transform,fontStretch" });
  if (prefersReducedMotion()) return { timeline: tl, finish };
  tl.from(title, { fontStretch: "62%", opacity: 0, duration: 0.8, ease: ENTER, immediateRender: true }, 0).from(
    count,
    { opacity: 0, y: 10, duration: 0.4, ease: ENTER, immediateRender: true },
    0.25,
  );
  return { timeline: tl, finish };
}

/**
 * A group arrives: its rule draws across, the side label and note rise, then the names arrive
 * light and gain weight one after another. Opacity only, never visibility, so waiting names stay
 * in the tab order. Paused, start values applied.
 */
export function groupReveal(group: HTMLElement): Reveal {
  const tl = gsap.timeline({ paused: true, defaults: { overwrite: "auto" } });
  const rule = group.querySelector<HTMLElement>(".grp-rule")!;
  const side = all(group, ".side > *");
  const names = all(group, ".names a");
  const seps = all(group, ".names .sep");
  const finish = () => {
    gsap.set(rule, { clearProps: "transform,transformOrigin" });
    gsap.set([...side, ...seps], { clearProps: "opacity,transform" });
    gsap.set(names, { clearProps: `opacity,fontWeight,${UNPIN}` });
  };
  if (prefersReducedMotion()) return { timeline: tl, finish };
  try {
    pin(names);
    // Rules draw on a plain curve: an overshoot would push them past the page edge.
    tl.from(rule, { scaleX: 0, transformOrigin: "0% 50%", duration: 0.7, ease: "power3.out", immediateRender: true }, 0)
      .from(side, { opacity: 0, y: 10, duration: 0.4, ease: ENTER, stagger: 0.04, immediateRender: true }, 0.1)
      .from(names, { opacity: 0, fontWeight: 200, duration: 0.6, ease: ENTER, stagger: 0.03, immediateRender: true }, 0.15)
      .from(seps, { opacity: 0, duration: 0.3, ease: "power1.out", stagger: 0.03, immediateRender: true }, 0.25);
  } catch (error) {
    tl.kill();
    finish();
    throw error;
  }
  return { timeline: tl, finish };
}

/**
 * Hover and keyboard focus widen a name. Mouse hover and :focus-visible share one hot state;
 * touch and click-derived focus never enter it, so nothing sticks. Returns a teardown.
 */
export function nameWiden(link: HTMLElement, isLocked: () => boolean): () => void {
  if (prefersReducedMotion()) return () => {};
  let hot = 0;
  const on = () => {
    if (isLocked()) return;
    hot++;
    if (hot > 1) return;
    gsap.killTweensOf(link, "fontStretch");
    if (link.style.display !== "inline-block") pin([link], "center");
    gsap.to(link, { fontStretch: WIDE, duration: 0.25, ease: ENTER, overwrite: "auto" });
  };
  const off = () => {
    if (isLocked() || hot === 0) return;
    hot = Math.max(0, hot - 1);
    if (hot > 0) return;
    gsap.to(link, {
      fontStretch: "82%",
      duration: 0.35,
      ease: "power3.out",
      overwrite: "auto",
      onComplete: () => gsap.set(link, { clearProps: `fontStretch,${UNPIN}` }),
    });
  };
  let mouse = false;
  const enter = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    mouse = true;
    on();
  };
  const leave = (e: PointerEvent) => {
    if (!mouse || e.pointerType !== "mouse") return;
    mouse = false;
    off();
  };
  let keyed = false;
  const focus = () => {
    if (!link.matches(":focus-visible")) return;
    keyed = true;
    on();
  };
  const blur = () => {
    if (!keyed) return;
    keyed = false;
    off();
  };
  link.addEventListener("pointerenter", enter);
  link.addEventListener("pointerleave", leave);
  link.addEventListener("focus", focus);
  link.addEventListener("blur", blur);
  return () => {
    link.removeEventListener("pointerenter", enter);
    link.removeEventListener("pointerleave", leave);
    link.removeEventListener("focus", focus);
    link.removeEventListener("blur", blur);
    gsap.killTweensOf(link, "fontStretch");
    gsap.set(link, { clearProps: `fontStretch,${UNPIN}` });
  };
}

const onScreen = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

/**
 * The outro. The chosen name widens and holds; every other name on screen drops away, and the
 * rules retract. Only what is on screen moves. Returns null when none of the collection is visible.
 */
export function collectionOutro(root: HTMLElement, source: Element | null): gsap.core.Timeline | null {
  const names = all(root, ".names a").filter(onScreen);
  const header = all(root, ".coll-head > *").filter(onScreen);
  if (!names.length && !header.length) return null;
  const held = source && root.contains(source) ? (source.closest("a") as HTMLElement | null) : null;
  const leaving = names.filter((n) => n !== held);
  const seps = all(root, ".names .sep").filter(onScreen);
  const side = all(root, ".grp .side > *").filter(onScreen);
  const rules = all(root, ".grp-rule").filter(onScreen);

  const tl = gsap.timeline({ defaults: { overwrite: "auto" } });
  if (prefersReducedMotion()) return tl.set([...leaving, ...seps, ...side, ...rules, ...header], { opacity: 0 });

  tl.to([...side, ...header], { opacity: 0, y: -8, duration: 0.25, ease: EXIT, stagger: 0.012 }, 0)
    .to(rules, { scaleX: 0, transformOrigin: "100% 50%", duration: 0.3, ease: EXIT }, 0)
    .to(seps, { opacity: 0, duration: 0.2, ease: EXIT }, 0)
    // The whole screen of names clears in about a third of a second, rippling out from the chosen one.
    .to(leaving, {
      opacity: 0,
      yPercent: 30,
      duration: 0.22,
      ease: EXIT,
      stagger: { amount: 0.1, from: held ? Math.max(0, names.indexOf(held)) : "start" },
    }, 0);
  if (held) {
    if (held.style.display !== "inline-block") pin([held], "center");
    // It widens once its neighbours are mostly gone, so it never collides with them.
    tl.to(held, { fontStretch: "100%", duration: 0.4, ease: ENTER }, 0.12);
  }
  return tl;
}
