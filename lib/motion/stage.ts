// The Line mask stage as a loop: lines enter, hold, leave, and enter again. Three variations from the
// split-entrances recipe (line mask, ellipse, highlight), with the knobs a visitor can turn.
import { gsap, SplitText, prefersReducedMotion } from "./gsap";

export type Variation = "mask" | "ellipse" | "highlight";

export type LoopParams = {
  variation: Variation;
  /** Seconds each line takes to enter. */
  duration: number;
  /** Seconds between lines. */
  stagger: number;
  /** Seconds the text rests before leaving. */
  hold: number;
  /** Entrance ease, any GSAP ease name. */
  ease: string;
};

export const DEFAULTS: LoopParams = { variation: "mask", duration: 0.8, stagger: 0.06, hold: 2, ease: "signature" };

/** A beat of empty stage between the exit and the next entrance. */
const GAP = 0.35;
const EXIT = "signature-exit";

const ELLIPSE = {
  closedBottom: "ellipse(20% 0% at 50% 100%)",
  openBottom: "ellipse(100% 120% at 50% 100%)",
  openTop: "ellipse(100% 120% at 50% 0%)",
  closedTop: "ellipse(20% 0% at 50% 0%)",
} as const;

export type Loop = {
  timeline: gsap.core.Timeline;
  /** Where the entrance ends and the hold begins, in seconds. */
  restAt: number;
  /** One full cycle, in seconds. */
  cycle: number;
  destroy: () => void;
};

/** Lays a bar over each line's words, for the highlight. SplitText's revert removes the bars with the split. */
function addBars(split: SplitText) {
  return split.lines.map((line) => {
    const words = split.words.filter((word) => line.contains(word));
    const lineBox = line.getBoundingClientRect();
    const boxes = words.map((word) => word.getBoundingClientRect());
    const left = boxes.length ? Math.min(...boxes.map((b) => b.left)) : lineBox.left;
    const right = boxes.length ? Math.max(...boxes.map((b) => b.right)) : lineBox.right;
    const bar = document.createElement("span");
    bar.setAttribute("aria-hidden", "true");
    Object.assign(bar.style, {
      position: "absolute",
      top: "0",
      bottom: "0",
      left: `${left - lineBox.left}px`,
      width: `${right - left}px`,
      background: "var(--line-highlight, currentColor)",
      pointerEvents: "none",
    });
    (line as HTMLElement).style.position = "relative";
    line.appendChild(bar);
    return { bar, words };
  });
}

/**
 * Builds the repeating cycle, paused. Every tween is a fromTo, so each repeat and every scrub
 * position renders the same frame. Returns null under reduced motion: the text simply rests.
 */
export function createLoop(text: HTMLElement, p: LoopParams): Loop | null {
  if (prefersReducedMotion()) return null;
  const highlight = p.variation === "highlight";
  const split = SplitText.create(text, {
    type: highlight ? "lines,words" : "lines",
    ...(highlight ? {} : { mask: "lines" as const }),
    aria: "auto",
  });
  const tl = gsap.timeline({ paused: true, repeat: -1, defaults: { overwrite: "auto" } });
  const destroy = () => {
    tl.kill();
    split.revert();
  };
  try {
    const lines = split.lines as HTMLElement[];
    const n = lines.length;
    const enter = p.duration + p.stagger * (n - 1);
    const out = Math.max(0.2, p.duration * 0.4);
    const outStagger = p.stagger * 0.5;
    const restAt = enter;
    const leaveAt = enter + p.hold;

    if (p.variation === "mask") {
      tl.fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: p.duration, ease: p.ease, stagger: p.stagger }, 0)
        .to(lines, { yPercent: -110, duration: out, ease: EXIT, stagger: outStagger }, leaveAt);
    } else if (p.variation === "ellipse") {
      const masks = split.masks as HTMLElement[];
      tl.fromTo(masks, { clipPath: ELLIPSE.closedBottom }, { clipPath: ELLIPSE.openBottom, duration: p.duration, ease: p.ease, stagger: p.stagger }, 0)
        .fromTo(lines, { yPercent: 40 }, { yPercent: 0, duration: p.duration, ease: p.ease, stagger: p.stagger }, 0)
        .fromTo(masks, { clipPath: ELLIPSE.openTop }, { clipPath: ELLIPSE.closedTop, duration: out, ease: EXIT, stagger: outStagger, immediateRender: false }, leaveAt)
        .to(lines, { yPercent: -40, duration: out, ease: EXIT, stagger: outStagger }, leaveAt);
    } else {
      // A bar sweeps across each line, the words appear beneath it, the bar retracts. Out runs the same way.
      const sweep = Math.max(0.15, p.duration * 0.45);
      addBars(split).forEach(({ bar, words }, i) => {
        const at = i * p.stagger * 2;
        const leave = leaveAt + i * outStagger * 2;
        tl.set(words, { autoAlpha: 0 }, 0)
          .fromTo(bar, { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: sweep, ease: "power3.in" }, at)
          .set(words, { autoAlpha: 1 }, at + sweep)
          .to(bar, { scaleX: 0, transformOrigin: "100% 50%", duration: sweep, ease: p.ease }, at + sweep)
          .fromTo(bar, { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: out, ease: "power3.in", immediateRender: false }, leave)
          .set(words, { autoAlpha: 0 }, leave + out)
          .to(bar, { scaleX: 0, transformOrigin: "100% 50%", duration: out, ease: EXIT }, leave + out);
      });
    }
    // An empty beat before the next entrance.
    tl.to({}, { duration: GAP });
    return { timeline: tl, restAt, cycle: tl.duration(), destroy };
  } catch (error) {
    destroy();
    throw error;
  }
}
