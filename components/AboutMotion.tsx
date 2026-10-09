"use client";

// About page controller: initial state → intro → settled → outro → end state.
import { useRef } from "react";
import { finished, fontsReady, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion/gsap";
import { armRecovery, claimVisit, disarm, handOff } from "@/lib/motion/boot";
import { aboutIntro, aboutOutro, aboutTargets, type AboutRun } from "@/lib/motion/about";
import { useTransitionController } from "./motion/TransitionProvider";

const OWNER = "about";

export function AboutMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const visit = useRef<"animate" | "settle">(null);
  const { registerOutro } = useTransitionController();

  useGSAP(
    (_, contextSafe) => {
      const el = root.current!;
      visit.current ??= claimVisit(OWNER);
      const animate = visit.current === "animate" && !prefersReducedMotion();
      let alive = true;
      let intro: AboutRun | null = null;

      const settled = contextSafe!(() => {
        intro?.finish();
        el.dataset.phase = "settled";
      });

      const outro = contextSafe!(() => {
        alive = false;
        // Mid-intro, the split lines leave from where they are.
        const held = el.dataset.phase === "intro" ? (intro?.lines ?? null) : null;
        intro?.timeline.kill();
        el.dataset.phase = "outro";
        const run = aboutOutro(el, held);
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

      const targets = aboutTargets(el);
      armRecovery(OWNER, () => {
        alive = false;
        intro?.timeline.kill();
        intro?.finish();
        gsap.set(targets, { clearProps: "opacity,visibility" });
        el.dataset.phase = "settled";
      });
      gsap.set(targets, { autoAlpha: 0 });
      el.dataset.phase = "intro";

      // Lines are measured, so build once the faces load. Still before paint on a warm cache.
      const build = contextSafe!(() => {
        if (!alive) return;
        try {
          intro = aboutIntro(el);
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
    <main ref={root} data-motion-owner={OWNER} data-phase="initial">
      {children}
    </main>
  );
}
