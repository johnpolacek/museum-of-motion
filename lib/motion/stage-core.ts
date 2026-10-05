// Stage engine. Each exhibit performs on a loop: enter, hold, leave, a beat of empty stage, and again.
// Ambient effects play a pass, hold, and play again. Every tween is a fromTo or a to from a fromTo'd
// start, so each repeat and each scrub position renders the same frame.
import { gsap, SplitText } from "./gsap";

export type Knob = "duration" | "stagger" | "hold" | "ease";

export type LoopParams = {
  variation: string;
  /** Seconds each item takes to enter. */
  duration: number;
  /** Seconds between items. */
  stagger: number;
  /** Seconds the text rests before leaving, or between passes. */
  hold: number;
  /** Entrance ease, any GSAP ease name. */
  ease: string;
};

export type Loop = {
  timeline: gsap.core.Timeline;
  /** One full cycle, in seconds. */
  cycle: number;
  destroy: () => void;
  /** Settles once the stage can draw its first frame. Until then the loop holds at its start. */
  ready?: Promise<unknown>;
};

export type KnobSpec = { label: string; min: number; max: number; step: number; unit: string };

/** An interactive stage: it waits for the visitor instead of looping. Only teardown. */
export type Play = { destroy: () => void };

export type StageDef = {
  /** Interactive stages have no loop, so no pause or scrub. They show a hint instead. */
  hint?: string;
  /** Per-variation hints, knobs, and knob specs, for a stage merged from several. */
  hints?: Record<string, string>;
  knobsBy?: Record<string, Knob[]>;
  specsBy?: Record<string, StageDef["specs"]>;
  /** Tab labels, one per variation, in order. */
  labels: string[];
  /** Variation keys, matching labels. */
  variations: string[];
  /** Which knobs apply to this exhibit. */
  knobs: Knob[];
  /** Per-exhibit names and ranges, where the defaults do not fit (a marquee's lap, say). */
  specs?: Partial<Record<Exclude<Knob, "ease">, Partial<KnobSpec>>>;
  /** Starting settings for a variation. Reset returns here. */
  defaults: (variation: string) => LoopParams;
  build: (text: HTMLElement, p: LoopParams) => Loop | Play;
};

/** A beat of empty stage between the exit and the next entrance. */
export const GAP = 0.35;
export const EXIT = "signature-exit";
export const rnd = gsap.utils.random;

export type Act = {
  /** Adds the entrance at 0. Returns when it ends. */
  enter: (tl: gsap.core.Timeline) => number;
  /** Adds the exit at `at`. Omitted for ambient effects, which rest in place. */
  exit?: (tl: gsap.core.Timeline, at: number) => void;
};

/** Splits, assembles the cycle, and rolls back on a throw. `cleanup` undoes anything else the stage built. */
export function assemble(text: HTMLElement, p: LoopParams, splits: SplitText[], act: Act, cleanup?: () => void): Loop {
  const tl = gsap.timeline({ paused: true, repeat: -1, defaults: { overwrite: "auto" } });
  const destroy = () => {
    tl.kill();
    while (splits.length) splits.pop()!.revert();
    cleanup?.();
    gsap.set(text, { clearProps: "opacity,visibility" });
  };
  try {
    // Art stages leave the sample text to CSS, which hides it under [data-art]; text stages show it.
    if (cleanup) gsap.set(text, { clearProps: "opacity,visibility" });
    else tl.set(text, { autoAlpha: 1 }, 0);
    const end = act.enter(tl);
    if (act.exit) {
      act.exit(tl, end + p.hold);
      tl.to({}, { duration: GAP });
    } else {
      tl.to({}, { duration: p.hold }, end);
    }
    return { timeline: tl, cycle: tl.duration(), destroy };
  } catch (error) {
    destroy();
    throw error;
  }
}

export const split = (text: HTMLElement, vars: SplitText.Vars, splits: SplitText[]) => {
  const s = SplitText.create(text, { aria: "auto", ...vars });
  splits.push(s);
  return s;
};
export const end = (n: number, p: LoopParams, each = p.stagger) => p.duration + each * Math.max(0, n - 1);

/** Pins each element to its width at `weight`, so a weight move never reflows the line. */
export function pinWidths(els: HTMLElement[], weight?: number) {
  const widths = els.map((el) => {
    if (weight === undefined) return parseFloat(getComputedStyle(el).width);
    const prev = el.style.fontWeight;
    el.style.fontWeight = String(weight);
    const w = parseFloat(getComputedStyle(el).width);
    el.style.fontWeight = prev;
    return w;
  });
  els.forEach((el, i) => Object.assign(el.style, { display: "inline-block", width: `${widths[i]}px`, textAlign: "center" }));
}

export const def = (
  labels: string[],
  variations: string[],
  knobs: Knob[],
  base: Omit<LoopParams, "variation">,
  build: StageDef["build"],
  perVariation: Record<string, Partial<LoopParams>> = {},
  specs?: StageDef["specs"],
): StageDef => ({
  labels,
  variations,
  knobs,
  specs,
  defaults: (variation) => ({ ...base, ...perVariation[variation], variation }),
  build,
});

/** An interactive stage: art with live controls, a recipe wired to them, one teardown. */
export const play = (
  labels: string[],
  variations: string[],
  hint: string,
  build: (text: HTMLElement, p: LoopParams) => Play,
  knobs: Knob[] = [],
  base: Partial<LoopParams> = {},
): StageDef => ({
  labels,
  variations,
  knobs,
  hint,
  defaults: (variation) => ({ duration: 0.3, stagger: 0, hold: 0, ease: "power3.out", ...base, variation }),
  build: (text, p) => {
    gsap.set(text, { clearProps: "opacity,visibility" });
    return build(text, p);
  },
});

/**
 * One exhibit from several stages, one tab each. Each tab builds its stage as it was, with that stage's
 * own variation, hint, and knobs. `all` brings every tab of a stage that has several.
 */
type MergePart = { def: StageDef; label?: string; key?: string; variation?: string; all?: boolean };
export function merge(parts: MergePart[]): StageDef {
  const tabs = parts.flatMap(({ def, label, key, variation, all }) =>
    all
      ? def.variations.map((v, i) => ({ def, label: def.labels[i]!, key: v, variation: v }))
      : [{ def, label: label ?? def.labels[0]!, key: key ?? def.variations[0]!, variation: variation ?? def.variations[0]! }],
  );
  const by = new Map(tabs.map((tab) => [tab.key, tab]));
  const tab = (key: string) => by.get(key) ?? tabs[0]!;
  const each = <T,>(read: (t: (typeof tabs)[number]) => T) => Object.fromEntries(tabs.map((t) => [t.key, read(t)]));
  return {
    labels: tabs.map((t) => t.label),
    variations: tabs.map((t) => t.key),
    knobs: tabs[0]!.def.knobs,
    hint: tabs[0]!.def.hint,
    hints: tabs.some((t) => t.def.hint) ? each((t) => t.def.hint ?? "") : undefined,
    knobsBy: each((t) => t.def.knobs),
    specsBy: each((t) => t.def.specs),
    defaults: (key) => ({ ...tab(key).def.defaults(tab(key).variation), variation: key }),
    build: (text, p) => tab(p.variation).def.build(text, { ...p, variation: tab(p.variation).variation }),
  };
}

/** Mounts interactive art, then wires recipes to it. Each wiring returns its teardown; all run in reverse. */
export function live(text: HTMLElement, html: string, wire: (layer: HTMLElement) => Array<() => void>, className = ""): Play {
  const { layer, remove } = art(text, html, `live ${className}`.trim(), true);
  let teardowns: Array<() => void> = [];
  try {
    teardowns = wire(layer);
  } catch (error) {
    remove();
    throw error;
  }
  return {
    destroy: () => {
      for (const t of teardowns.reverse()) {
        try {
          t();
        } catch (error) {
          console.error(error);
        }
      }
      remove();
    },
  };
}

/**
 * Art for a stage that shows something other than the sample text: a layer filling the stage,
 * aria-hidden since the page already describes the exhibit. Returns the layer and its removal.
 */
export function art(text: HTMLElement, html: string, className = "", interactive = false): { layer: HTMLElement; remove: () => void } {
  const stage = text.closest<HTMLElement>(".stage") ?? text.parentElement!;
  const layer = document.createElement("div");
  layer.className = `stage-art ${className}`.trim();
  // Decorative art is hidden from assistive tech; an interactive stage holds real controls, so it is not.
  if (!interactive) layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = html;
  stage.appendChild(layer);
  // The sample text stays in place, hidden by CSS, so it keeps the stage's height and its accessible text.
  stage.dataset.art = "";
  return {
    layer,
    remove: () => {
      layer.remove();
      delete stage.dataset.art;
    },
  };
}

