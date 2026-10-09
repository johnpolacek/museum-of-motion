// About page builders. The label rises, then the statement rises line by line behind masks with the
// signature bounce. The outro drops the lines behind their masks again, quickly.
// Builders only build: the AboutMotion controller decides when.
import { gsap, SplitText, prefersReducedMotion } from "./gsap";
import { stageOut, type Run } from "./exhibit";

const ENTER = "signature";
const EXIT = "signature-exit";
const CLEAR = "opacity,visibility,transform";

function parts(root: HTMLElement) {
  return {
    label: root.querySelector<HTMLElement>("h1")!,
    paras: Array.from(root.querySelectorAll<HTMLElement>(".about p")),
  };
}

/** The intro's visible targets, for the controller's initial hide. */
export const aboutTargets = (root: HTMLElement) => {
  const p = parts(root);
  return [p.label, ...p.paras];
};

/** The intro, plus its lines while they are still split, so an outro can take them from where they are. */
export type AboutRun = Run & { lines: HTMLElement[] };

/**
 * The page intro, paused, start values applied. Wrapping text never changes width or weight, so the
 * paragraphs split into their resting lines and each line rises. Call after fonts load: lines are measured.
 */
export function aboutIntro(root: HTMLElement): AboutRun {
  const p = parts(root);
  const tl = gsap.timeline({ paused: true, defaults: { overwrite: "auto" } });
  const splits: SplitText[] = [];
  const run: AboutRun = {
    timeline: tl,
    lines: [],
    finish: () => {
      splits.splice(0).forEach((split) => split.revert());
      run.lines = [];
      gsap.set([p.label, ...p.paras], { clearProps: CLEAR });
    },
  };
  if (prefersReducedMotion()) {
    tl.set([p.label, ...p.paras], { autoAlpha: 1 });
    return run;
  }
  try {
    for (const para of p.paras) {
      const split = SplitText.create(para, { type: "lines", mask: "lines", aria: "auto" });
      splits.push(split);
      run.lines.push(...(split.lines as HTMLElement[]));
    }
    // The masks hide each line, so the paragraphs can show at once.
    tl.set(p.paras, { autoAlpha: 1 }, 0)
      .fromTo(p.label, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: ENTER }, 0)
      .fromTo(run.lines, { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: ENTER, stagger: 0.06 }, 0.12);
  } catch (error) {
    tl.kill();
    run.finish();
    throw error;
  }
  return run;
}

/**
 * The outro, from current values. The label lifts away and the lines drop behind their masks.
 * `held` is an interrupted intro's split lines: they leave from where they are, not from rest.
 */
export function aboutOutro(root: HTMLElement, held: HTMLElement[] | null): Run {
  const p = parts(root);
  const tl = gsap.timeline({ defaults: { overwrite: "auto" } });
  if (prefersReducedMotion()) return { timeline: tl.set([p.label, ...p.paras], { autoAlpha: 0 }), finish: () => {} };
  tl.to(p.label, { autoAlpha: 0, y: -8, duration: 0.25, ease: EXIT }, 0);
  if (held?.length) {
    tl.to(held, { yPercent: 110, duration: 0.3, ease: EXIT, stagger: 0.03 }, 0.04).set(p.paras, { autoAlpha: 0 });
    return { timeline: tl, finish: () => {} };
  }
  // At rest, each paragraph leaves the way an exhibit's sample text does.
  const runs = p.paras.map(stageOut);
  runs.forEach((run, i) => tl.add(run.timeline.play(), 0.04 + i * 0.06));
  return { timeline: tl, finish: () => runs.forEach((run) => run.finish()) };
}
