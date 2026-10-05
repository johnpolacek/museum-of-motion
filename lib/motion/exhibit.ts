// Exhibit page builders. The title flies in from the collection (or widens into place), the stage
// performs its exhibit, specs and labels rise. The outro squeezes the title and drops it behind a mask.
// Builders only build: the ExhibitMotion controller decides when.
import { gsap, SplitText, prefersReducedMotion } from "./gsap";
import { playShared, type SharedState } from "./shared";

const ENTER = "signature";
const EXIT = "signature-exit";
const CLEAR = "opacity,visibility,transform,fontStretch,clipPath,willChange";

function parts(root: HTMLElement) {
  const one = (sel: string) => root.querySelector<HTMLElement>(sel)!;
  const all = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
  return {
    bar: all(".bar > span, .bar nav a"),
    h1: one("h1"),
    num: one("h1 .n"),
    name: one("h1 .t"),
    stage: one(".stage p"),
    art: root.querySelector<HTMLElement>(".stage[data-art] > .stage-art"),
    rest: all(".controls:not([hidden]), .row > *, .specs > div"),
  };
}

/** The intro's visible targets, for the controller's initial hide. */
export const exhibitTargets = (root: HTMLElement) => {
  const p = parts(root);
  return [...p.bar, p.num, p.name, p.stage, ...p.rest];
};

export type Run = { timeline: gsap.core.Timeline; finish: () => void };

/**
 * Holds each piece of a title at its resting width, so a width move never changes where the lines
 * break: on a phone the condensed title fits fewer lines, and pieces would jump lines mid-move.
 * A piece is a word, or the part of a hyphenated word up to its hyphen, since a line may break there:
 * "Zoom-through" is "Zoom-" and "through", side by side, still free to break between them.
 * Reads every width first, then writes. Exact widths: GSAP rounds pixels by default, and half a
 * pixel can tip a line. Returns the pieces and the undo, which puts the plain text back.
 */
function pinWords(title: HTMLElement): { words: HTMLElement[]; unpin: () => void } {
  const text = title.textContent ?? "";
  const label = title.getAttribute("aria-label");
  const words: HTMLElement[] = [];
  title.replaceChildren(
    ...(text.match(/[^\s-]+-?|-|\s+/g) ?? []).map((part) => {
      if (/^\s+$/.test(part)) return document.createTextNode(part);
      const span = document.createElement("span");
      span.textContent = part;
      span.setAttribute("aria-hidden", "true");
      words.push(span);
      return span;
    }),
  );
  title.setAttribute("aria-label", text);
  const widths = words.map((w) => w.getBoundingClientRect().width);
  words.forEach((w, i) => gsap.set(w, { display: "inline-block", width: `${widths[i]}px`, autoRound: false }));
  return {
    words,
    unpin: () => {
      title.textContent = text;
      if (label === null) title.removeAttribute("aria-label");
      else title.setAttribute("aria-label", label);
    },
  };
}

/* ---------- Stage exit, shared by every exhibit ---------- */

/** And down behind them again, quickly. */
export function stageOut(text: HTMLElement): Run {
  const tl = gsap.timeline({ paused: true, defaults: { overwrite: "auto" } });
  if (prefersReducedMotion()) return { timeline: tl.set(text, { autoAlpha: 0 }), finish: () => {} };
  const split = SplitText.create(text, { type: "lines", mask: "lines", aria: "auto" });
  const finish = () => split.revert();
  tl.to(split.lines, { yPercent: 110, duration: 0.3, ease: EXIT, stagger: 0.03 }, 0).set(text, { autoAlpha: 0 });
  return { timeline: tl, finish };
}

/* ---------- Page ---------- */

/**
 * The page intro, paused, start values applied. With a handoff the title flies in from the
 * collection name; without one (first load, back and forward) it widens into place.
 */
export function exhibitIntro(root: HTMLElement, shared: SharedState | null, cueStage: (() => void) | null): Run {
  const p = parts(root);
  const tl = gsap.timeline({ paused: true, defaults: { overwrite: "auto" } });
  const visible = [...p.bar, p.num, p.name, ...p.rest];
  let unpin = () => {};
  const finish = () => {
    unpin();
    gsap.set([...visible, p.stage], { clearProps: CLEAR });
  };
  if (prefersReducedMotion()) {
    tl.set([...visible, p.stage], { autoAlpha: 1 });
    return { timeline: tl, finish };
  }
  try {
    if (shared) {
      // Visible before Flip reads it: Flip carries opacity too, and would fade the title to its hidden start.
      gsap.set(p.name, { autoAlpha: 1 });
      tl.add(playShared(shared, p.name, { duration: 0.85 }), 0);
    } else {
      // The controller has already hidden the name, so a from() would fade it from 0 to 0. The fade is
      // explicit; the width stretch is a from() on each pinned word, resting at what the stylesheet sets.
      const pinned = pinWords(p.name);
      unpin = pinned.unpin;
      tl.fromTo(p.name, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: "power1.out" }, 0).from(
        pinned.words,
        { fontStretch: "62%", duration: 0.9, ease: ENTER, immediateRender: true },
        0,
      );
    }
    tl.fromTo(p.bar, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: ENTER, stagger: 0.04 }, 0.15)
      .fromTo(p.num, { autoAlpha: 0, yPercent: 40 }, { autoAlpha: 1, yPercent: 0, duration: 0.45, ease: ENTER }, 0.55);
    // A live stage performs its own exhibit from here; a static one simply rises.
    if (cueStage) tl.call(cueStage, undefined, 0.6);
    else tl.fromTo(p.stage, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: ENTER }, 0.6);
    tl.fromTo(p.rest, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: ENTER, stagger: 0.04 }, 0.8);
  } catch (error) {
    tl.kill();
    finish();
    throw error;
  }
  return { timeline: tl, finish };
}

/** The outro, from current values. The title squeezes and drops behind a mask; everything else leaves first. */
export function exhibitOutro(root: HTMLElement): Run {
  const p = parts(root);
  const tl = gsap.timeline({ defaults: { overwrite: "auto" } });
  const ui = [...p.bar, ...p.rest];
  const leaving = p.art ?? p.stage;
  if (prefersReducedMotion()) return { timeline: tl.set([...ui, p.h1, leaving], { autoAlpha: 0 }), finish: () => {} };
  // Art drops and fades, quick and straight; sample text drops behind its line masks.
  const stage: Run = p.art
    ? { timeline: gsap.timeline({ paused: true }).to(p.art, { autoAlpha: 0, y: 24, duration: 0.3, ease: EXIT }), finish: () => {} }
    : stageOut(p.stage);
  // The number and each word keep their boxes while they condense, so the title keeps its lines.
  const numWidth = p.num.getBoundingClientRect().width;
  const pinned = pinWords(p.name);
  gsap.set(p.num, { display: "inline-block", width: `${numWidth}px`, autoRound: false });
  tl.to(ui, { autoAlpha: 0, y: -8, duration: 0.25, ease: EXIT, stagger: 0.012 }, 0)
    .add(stage.timeline.play(), 0)
    // Clip just under the title's baseline so the drop disappears behind it.
    .set(p.h1, { clipPath: "inset(-20% -5% -0.08em -5%)" }, 0)
    .to([p.num, p.name], { yPercent: 115, duration: 0.32, ease: EXIT, stagger: 0.03 }, 0.06)
    .to([p.num, ...pinned.words], { fontStretch: "62%", duration: 0.32, ease: EXIT }, 0.06)
    .set(p.h1, { autoAlpha: 0 });
  return {
    timeline: tl,
    finish: () => {
      stage.finish();
      pinned.unpin();
    },
  };
}
