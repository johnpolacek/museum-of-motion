// The stage registry: every exhibit with a live stage, by slug.
import { prefersReducedMotion } from "./gsap";
import type { Loop, LoopParams, Play, StageDef } from "./stage-core";
import { TEXT_STAGES } from "./stages/text";
import { TIME_STAGES } from "./stages/time";
import { POINTER_STAGES } from "./stages/pointer";

export type { Knob, KnobSpec, Loop, LoopParams, Play, StageDef } from "./stage-core";

/** Exhibits with a live stage. The rest show the sample text at rest. */
export const STAGES: Record<string, StageDef> = { ...TEXT_STAGES, ...TIME_STAGES, ...POINTER_STAGES };

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
