"use client";

// Exhibit page controller: initial state → intro (with the title handoff) → settled → outro → end state.
// Only exhibits in MOTION_EXHIBITS animate; the rest render the same markup, static.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { finished, fontsReady, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion/gsap";
import { armRecovery, claimVisit, disarm, handOff } from "@/lib/motion/boot";
import { exhibitIntro, exhibitOutro, exhibitTargets, type Run } from "@/lib/motion/exhibit";
import { MOTION_EXHIBITS } from "@/lib/motion/ready";
import { useTransitionController } from "./motion/TransitionProvider";

const OWNER = "ex";

/** What the stage needs from the page: when the intro has settled, and a way to be stopped before the outro. */
type Phase = { settled: boolean; registerStop: (stop: () => void) => () => void };
const PhaseContext = createContext<Phase>({ settled: false, registerStop: () => () => {} });
export const useExhibitPhase = () => useContext(PhaseContext);

export function ExhibitMotion({ slug, children }: { slug: string; children: React.ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const visit = useRef<"animate" | "settle">(null);
  const pathname = usePathname();
  const { registerOutro, peekShared, clearShared } = useTransitionController();
  const enabled = MOTION_EXHIBITS.has(slug);
  const [settledState, setSettledState] = useState(false);
  const stops = useRef(new Set<() => void>());
  const registerStop = useCallback((stop: () => void) => {
    stops.current.add(stop);
    return () => {
      stops.current.delete(stop);
    };
  }, []);
  const phase = useMemo(() => ({ settled: settledState, registerStop }), [settledState, registerStop]);

  useGSAP(
    (_, contextSafe) => {
      if (!enabled) return;
      const el = root.current!;
      visit.current ??= claimVisit(OWNER);
      const animate = visit.current === "animate" && !prefersReducedMotion();
      let alive = true;
      let intro: Run | null = null;

      const settled = contextSafe!(() => {
        intro?.finish();
        el.dataset.phase = "settled";
        clearShared();
        setSettledState(true);
      });

      const outro = contextSafe!(() => {
        alive = false;
        intro?.timeline.kill();
        // The stage's loop owns the sample text: stop it and put the text back before the outro takes it.
        stops.current.forEach((stop) => stop());
        el.dataset.phase = "outro";
        const run = exhibitOutro(el);
        return finished(run.timeline).then(() => {
          el.dataset.phase = "end";
          el.inert = true;
        });
      });
      const unregister = registerOutro(outro);

      const cleanup = () => {
        alive = false;
        unregister();
        disarm(OWNER);
        intro?.finish();
      };

      if (!animate) {
        handOff(OWNER);
        settled();
        return cleanup;
      }

      const targets = exhibitTargets(el);
      armRecovery(OWNER, () => {
        alive = false;
        intro?.timeline.kill();
        intro?.finish();
        gsap.set(targets, { clearProps: "opacity,visibility" });
        el.dataset.phase = "settled";
      });
      gsap.set(targets, { autoAlpha: 0 });
      el.dataset.phase = "intro";

      // Build after the router's scroll lands: the microtask after this layout effect, still before paint.
      const build = contextSafe!(() => {
        if (!alive) return;
        try {
          intro = exhibitIntro(el, peekShared(pathname));
        } catch (error) {
          console.error(error);
          settled();
          handOff(OWNER);
          return;
        }
        intro.timeline.eventCallback("onComplete", settled);
        handOff(OWNER);
        intro.timeline.play();
      });
      if (document.fonts.status === "loaded") queueMicrotask(build);
      else fontsReady(600).then(build);

      return cleanup;
    },
    { scope: root },
  );

  return (
    <main
      ref={root}
      className="ex wrap blue"
      aria-labelledby="ex-h"
      {...(enabled ? { "data-motion-owner": OWNER, "data-phase": "initial" } : {})}
    >
      <PhaseContext.Provider value={phase}>{children}</PhaseContext.Provider>
    </main>
  );
}
