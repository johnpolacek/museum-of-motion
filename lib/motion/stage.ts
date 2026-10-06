// The stage registry: every exhibit with a live stage, by slug.
import { prefersReducedMotion } from "./gsap";
import type { Loop, LoopParams, Play, StageDef } from "./stage-core";
import { TEXT_STAGES } from "./stages/text";
import { TIME_STAGES } from "./stages/time";
import { POINTER_STAGES } from "./stages/pointer";
import { SCROLL_STAGES } from "./stages/scroll";
import { WEBGL_STAGES } from "./stages/webgl";
import { VIBE_STAGES } from "./stages/vibes";

export type { Knob, KnobSpec, Loop, LoopParams, Play, StageDef } from "./stage-core";

/** Exhibits with a live stage. The rest show the sample text at rest. */
export const STAGES: Record<string, StageDef> = { ...TEXT_STAGES, ...TIME_STAGES, ...SCROLL_STAGES, ...POINTER_STAGES, ...WEBGL_STAGES, ...VIBE_STAGES };

/** A loop has a timeline; an interactive stage does not. */
export const isLoop = (run: Loop | Play): run is Loop => "timeline" in run;

/**
 * Builds a stage, paused if it loops. Loops are null under reduced motion: the text simply rests.
 * Interactive stages still build: their recipes each handle reduced motion, and the controls must work.
 */
export function createLoop(slug: string, text: HTMLElement, p: LoopParams): Loop | Play | null {
  const stage = STAGES[slug];
  if (!stage || (prefersReducedMotion() && !stage.hint)) return null;
  return stage.build(text, p);
}
