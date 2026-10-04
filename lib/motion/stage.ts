// The stage registry: every exhibit with a live stage, by slug.
import { prefersReducedMotion } from "./gsap";
import type { Loop, LoopParams, StageDef } from "./stage-core";
import { TEXT_STAGES } from "./stages/text";
import { TIME_STAGES } from "./stages/time";

export type { Knob, KnobSpec, Loop, LoopParams, StageDef } from "./stage-core";

/** Exhibits with a live stage. The rest show the sample text at rest. */
export const STAGES: Record<string, StageDef> = { ...TEXT_STAGES, ...TIME_STAGES };

/** Builds a stage's loop, paused. Null under reduced motion: the text simply rests. */
export function createLoop(slug: string, text: HTMLElement, p: LoopParams): Loop | null {
  const stage = STAGES[slug];
  if (!stage || prefersReducedMotion()) return null;
  return stage.build(text, p);
}
