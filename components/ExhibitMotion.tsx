"use client";

// Exhibit page controller: initial state → intro (with the title handoff) → settled → outro → end state.
// Only exhibits in MOTION_EXHIBITS animate; the rest render the same markup, static.
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { finished, fontsReady, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion/gsap";
import { armRecovery, claimVisit, disarm, handOff } from "@/lib/motion/boot";
import { exhibitIntro, exhibitOutro, exhibitTargets, stageIn, stageOut, type Run } from "@/lib/motion/exhibit";
import { MOTION_EXHIBITS } from "@/lib/motion/ready";
import { useTransitionController } from "./motion/TransitionProvider";

const OWNER = "ex";

export function ExhibitMotion({ slug, children }: { slug: string; children: React.ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const visit = useRef<"animate" | "settle">(null);
  const pathname = usePathname();
  const { registerOutro, peekShared, clearShared } = useTransitionController();
  const enabled = MOTION_EXHIBITS.has(slug);

  useGSAP(
    (_, contextSafe) => {
      if (!enabled) return;
      const el = root.current!;
      visit.current ??= claimVisit(OWNER);
      const animate = visit.current === "animate" && !prefersReducedMotion();
      const replay = el.querySelector<HTMLButtonElement>("[data-replay]");
      const text = el.querySelector<HTMLElement>(".stage p")!;
      let alive = true;
      let intro: Run | null = null;
      let stage: Run | null = null;

      // Replay: the stage text drops out, then performs again.
      const onReplay = contextSafe!(() => {
        if (el.dataset.phase !== "settled") return;
        stage?.timeline.kill();
        stage?.finish();
        const out = stageOut(text);
        stage = out;
        out.timeline.eventCallback(
          "onComplete",
          contextSafe!(() => {
            out.finish();
            const inn = stageIn(text);
            stage = inn;
            inn.timeline.eventCallback("onComplete", () => {
              inn.finish();
              stage = null;
            });
            inn.timeline.play();
          }),
        );
        out.timeline.play();
      });

      const settled = contextSafe!(() => {
        intro?.finish();
        el.dataset.phase = "settled";
        clearShared();
      });

      const outro = contextSafe!(() => {
        alive = false;
        intro?.timeline.kill();
        stage?.timeline.kill();
        el.dataset.phase = "outro";
        const run = exhibitOutro(el);
        return finished(run.timeline).then(() => {
          el.dataset.phase = "end";
          el.inert = true;
        });
      });
      const unregister = registerOutro(outro);

      if (replay && animate) {
        replay.hidden = false;
        replay.addEventListener("click", onReplay);
      }
      const cleanup = () => {
        alive = false;
        unregister();
        disarm(OWNER);
        replay?.removeEventListener("click", onReplay);
        stage?.finish();
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
      {children}
    </main>
  );
}
