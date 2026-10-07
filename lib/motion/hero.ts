// Home hero builders. Each headline word performs the exhibit it is numbered with, then rests as plain type.
// Builders only build: the Hero controller decides when they run and owns phase state.
import { gsap, SplitText, prefersReducedMotion } from "./gsap";

const ENTER = "signature";
const EXIT = "signature-exit";

/** Properties these builders write inline. Cleared at settled so CSS owns the hero again. */
const CLEAR = "transform,transformOrigin,opacity,visibility,fontStretch,fontWeight,width,clipPath,willChange";

function parts(root: HTMLElement) {
  const one = (sel: string) => root.querySelector<HTMLElement>(sel)!;
  const all = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
  const word = (key: string) => one(`[data-word="${key}"]`);
  const leaf = (key: string) => one(`[data-word="${key}"] .t`);
  return {
    h1: one("h1"),
    words: all("[data-word]"),
    leaves: all("[data-word] .t"),
    chars: (key: string) => all(`[data-word="${key}"] .ch`),
    sups: all("[data-word] sup"),
    word,
    leaf,
    sup: (key: string) => one(`[data-word="${key}"] sup`),
    underline: one("[data-ul]"),
    rule: one("[data-rule]"),
    sub: one("[data-sub]"),
    list: one("[data-list]"),
    items: [...all("[data-list] li"), ...all("[data-wave-toggle]:not([hidden])")],
  };
}

/** The headline's text leaves, for the wave. */
export const heroLeaves = (root: HTMLElement) => parts(root).leaves;

/** Holds a word's layout box at its current width while its type changes width or weight. */
function pinWidth(el: HTMLElement) {
  // Layout width, unaffected by resting transforms such as the skew on "can".
  gsap.set(el, { width: parseFloat(getComputedStyle(el).width) });
}

export type HeroIntro = {
  timeline: gsap.core.Timeline;
  /** Reverts splits and clears every inline value the intro wrote. Safe to call more than once. */
  finish: () => void;
};

/** Builds the paused intro. Start values are applied at build, so call it before the first paint. */
export function heroIntro(root: HTMLElement): HeroIntro {
  const p = parts(root);
  const splits: SplitText[] = [];
  const touched = new Set<Element>();
  const finish = () => {
    while (splits.length) splits.pop()!.revert();
    if (touched.size) gsap.set([...touched], { clearProps: CLEAR });
    touched.clear();
  };
  const tl = gsap.timeline({ paused: true, defaults: { overwrite: "auto" } });
  const tween = (targets: HTMLElement | HTMLElement[], from: gsap.TweenVars, to: gsap.TweenVars, at: number) => {
    for (const t of ([] as HTMLElement[]).concat(targets)) touched.add(t);
    tl.fromTo(targets, from, to, at);
  };
  /** Enters from `vars` to the element's resting CSS values. */
  const land = (targets: HTMLElement | HTMLElement[], vars: gsap.TweenVars, at: number) => {
    for (const t of ([] as HTMLElement[]).concat(targets)) touched.add(t);
    tl.from(targets, { ...vars, immediateRender: true }, at);
  };
  const reveal = [p.h1, p.rule, p.sub, p.list, ...p.items];
  for (const el of reveal) touched.add(el);

  if (prefersReducedMotion()) {
    tl.set(reveal, { autoAlpha: 1 });
    return { timeline: tl, finish };
  }

  try {
    tl.set([p.h1, p.sub, p.list], { autoAlpha: 1 }, 0);
    // Each superscript arrives after its word lands.
    const sup = (key: string, at: number) =>
      tween(p.sup(key), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: ENTER }, at);

    // Headline words land on the poster's frozen poses, which live in globals.css.
    // `from` tweens read those resting values, so CSS stays the one source of the pose.

    // 02 Characters on "Every": letters drop in one after another and land mid-flight, fading as they rise.
    const everyChars = p.chars("every");
    land(everyChars, { yPercent: -70, autoAlpha: 0, duration: 0.8, ease: ENTER, stagger: 0.04 }, 0);
    sup("every", 0.85);

    // 30 Link hover, its Underline tab, on "way": the word widens from condensed while its underline sweeps in from the start.
    pinWidth(p.word("way"));
    touched.add(p.word("way"));
    land(p.leaf("way"), { fontStretch: "62%", autoAlpha: 0, duration: 0.8, ease: ENTER }, 0.22);
    land(p.underline, { scaleX: 0, transformOrigin: "0% 50%", duration: 0.6, ease: "power2.out" }, 0.3);
    sup("way", 1.0);

    // "a" has no exhibit. It simply rises.
    land(p.leaf("a"), { yPercent: 40, autoAlpha: 0, duration: 0.6, ease: ENTER }, 0.42);

    // 08 Wave, its Weight tab, on "page": letters arrive hairline and gain weight, each to its own pose weight.
    const pageChars = p.chars("page");
    // Pinned at resting width so the weight axis moves without reflowing the line.
    for (const c of pageChars) pinWidth(c);
    touched.add(p.word("page"));
    land(pageChars, { fontWeight: 100, autoAlpha: 0, duration: 0.9, ease: ENTER, stagger: 0.08 }, 0.5);
    sup("page", 1.4);

    // 03 Slide on "can": it zips in from the side leaning hard and springs back to its resting lean. The screen's one elastic.
    land(p.leaf("can"), { xPercent: 60, skewX: -40, duration: 1.0, ease: "elastic.out(1, 0.5)" }, 0.72);
    land(p.leaf("can"), { autoAlpha: 0, duration: 0.2, ease: "none" }, 0.72);
    sup("can", 1.45);

    // 01 Line mask on "move.": the line rises from behind its mask and holds partway, as on the poster.
    land(p.leaf("move"), { yPercent: 110, duration: 0.8, ease: ENTER }, 0.95);
    sup("move", 1.7);

    // Rule draws across. power3.out, not the signature: an overshoot would push it past the page edge.
    tween(p.rule, { autoAlpha: 1, scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 0.7, ease: "power3.out" }, 1.55);

    // Subhead lines rise behind masks.
    const sub = SplitText.create(p.sub, { type: "lines", mask: "lines", aria: "auto" });
    splits.push(sub);
    tween(sub.lines as HTMLElement[], { yPercent: 110 }, { yPercent: 0, duration: 0.6, ease: ENTER, stagger: 0.06 }, 1.65);

    // Exhibit list and the wave control rise in quickly.
    tween(p.items, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: ENTER, stagger: 0.04 }, 1.75);
  } catch (error) {
    tl.kill();
    finish();
    throw error;
  }
  return { timeline: tl, finish };
}

/**
 * The outro, from whatever values are on screen now (settled, or mid-intro).
 * Display type squeezes to condensed and drops behind a mask. UI leaves first.
 */
export function heroOutro(root: HTMLElement): gsap.core.Timeline {
  const p = parts(root);
  const tl = gsap.timeline({ defaults: { overwrite: "auto" } });
  const ui = [...p.items, p.sub];
  if (prefersReducedMotion()) return tl.set([p.h1, p.rule, ...ui], { autoAlpha: 0 });

  for (const w of p.words) pinWidth(w);
  // Clip each word just under its baseline so the drop disappears behind it.
  tl.set(p.words, { clipPath: "inset(-50% -15% -0.14em -15%)" }, 0);
  tl.to(ui, { autoAlpha: 0, y: -8, duration: 0.25, ease: EXIT, stagger: 0.012 }, 0)
    .to(p.rule, { scaleX: 0, transformOrigin: "100% 50%", duration: 0.3, ease: EXIT }, 0)
    .to(p.sups, { autoAlpha: 0, duration: 0.15, ease: EXIT }, 0)
    .to(p.underline, { scaleX: 0, transformOrigin: "100% 50%", duration: 0.2, ease: EXIT }, 0)
    .to(p.leaves, { fontStretch: "62%", yPercent: 125, duration: 0.32, ease: EXIT, stagger: 0.03 }, 0.06)
    .set([p.h1, p.rule], { autoAlpha: 0 });
  return tl;
}
