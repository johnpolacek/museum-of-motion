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
    rest: all(".controls:not([hidden]), .row > *, .specs > div"),
  };
}

/** The intro's visible targets, for the controller's initial hide. */
export const exhibitTargets = (root: HTMLElement) => {
  const p = parts(root);
  return [...p.bar, p.num, p.name, p.stage, ...p.rest];
};

export type Run = { timeline: gsap.core.Timeline; finish: () => void };

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
  const finish = () => {
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
      // explicit; the width stretch is a from(), resting at whatever the stylesheet sets.
      tl.fromTo(p.name, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: "power1.out" }, 0).from(
        p.name,
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
  if (prefersReducedMotion()) return { timeline: tl.set([...ui, p.h1, p.stage], { autoAlpha: 0 }), finish: () => {} };
  const stage = stageOut(p.stage);
  tl.to(ui, { autoAlpha: 0, y: -8, duration: 0.25, ease: EXIT, stagger: 0.012 }, 0)
    .add(stage.timeline.play(), 0)
    // Clip just under the title's baseline so the drop disappears behind it.
    .set(p.h1, { clipPath: "inset(-20% -5% -0.08em -5%)" }, 0)
    .to([p.num, p.name], { fontStretch: "62%", yPercent: 115, duration: 0.32, ease: EXIT, stagger: 0.03 }, 0.06)
    .set(p.h1, { autoAlpha: 0 });
  return { timeline: tl, finish: stage.finish };
}
