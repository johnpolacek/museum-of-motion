"use client";

// Collection controller. Each group reveals once as it scrolls in, names widen on hover and
// keyboard focus, and on navigation the chosen name holds while the rest leave.
import { useRef } from "react";
import { finished, fontsReady, prefersReducedMotion, ScrollTrigger, useGSAP } from "@/lib/motion/gsap";
import { armRecovery, claimVisit, disarm, handOff } from "@/lib/motion/boot";
import { collectionOutro, groupReveal, headerReveal, nameWiden, type Reveal } from "@/lib/motion/collection";
import { useTransitionController } from "./motion/TransitionProvider";

const OWNER = "coll";
/** A group plays when its top crosses this line of the viewport. */
const START = "top 85%";

export function CollectionMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const visit = useRef<"animate" | "settle">(null);
  const { registerOutro } = useTransitionController();

  useGSAP(
    (_, contextSafe) => {
      const el = root.current!;
      visit.current ??= claimVisit(OWNER);
      const animate = visit.current === "animate" && !prefersReducedMotion();
      let leaving = false;
      const reveals: Reveal[] = [];
      const hovers: Array<() => void> = [];
      const listeners: Array<() => void> = [];

      const widen = (scope: ParentNode) => {
        for (const link of scope.querySelectorAll<HTMLElement>(".names a")) hovers.push(nameWiden(link, () => leaving));
      };

      const outro = contextSafe!(({ source }: { source: Element | null }) => {
        const tl = collectionOutro(el, source);
        if (!tl) return null;
        leaving = true;
        // Finish any reveal still running so the outro starts from settled names.
        for (const r of reveals) if (r.timeline.isActive()) r.timeline.progress(1);
        return finished(tl).then(() => {
          el.inert = true;
        });
      });
      const unregister = registerOutro(outro);

      const cleanup = () => {
        disarm(OWNER);
        unregister();
        listeners.forEach((off) => off());
        hovers.forEach((off) => off());
        reveals.forEach((r) => r.finish());
      };

      if (!animate) {
        handOff(OWNER);
        el.dataset.phase = "settled";
        widen(el);
        return cleanup;
      }

      armRecovery(OWNER, () => {
        reveals.forEach((r) => {
          r.timeline.kill();
          r.finish();
        });
        el.dataset.phase = "settled";
      });

      const header = el.querySelector<HTMLElement>(".coll-head")!;
      const groups = Array.from(el.querySelectorAll<HTMLElement>(".grp"));
      let alive = true;
      const play = (reveal: Reveal, scope: HTMLElement) => {
        reveal.timeline.eventCallback("onComplete", () => {
          reveal.finish();
          widen(scope);
        });
        reveal.timeline.play();
      };

      // Initial state: every group waits at its start values. Names are pinned to measured widths,
      // so this needs final font metrics. On a first load the boot gate hides the section meanwhile.
      const build = contextSafe!(() => {
        if (!alive) return;
        try {
          const head = headerReveal(header);
          reveals.push(head);
          ScrollTrigger.create({ trigger: header, start: START, once: true, onEnter: () => play(head, header) });
          for (const group of groups) {
            const reveal = groupReveal(group);
            reveals.push(reveal);
            ScrollTrigger.create({ trigger: group, start: START, once: true, onEnter: () => play(reveal, group) });
            // Keyboard focus can reach a name before its group scrolls in: never focus an invisible name.
            const onFocus = () => {
              if (reveal.timeline.progress() < 1) reveal.timeline.progress(1);
            };
            group.addEventListener("focusin", onFocus);
            listeners.push(() => group.removeEventListener("focusin", onFocus));
          }
        } catch (error) {
          console.error(error);
          reveals.forEach((r) => r.finish());
        }
        el.dataset.phase = "intro";
        handOff(OWNER);
      });
      if (document.fonts.status === "loaded") build();
      else fontsReady(600).then(build);

      // Pinned widths follow the font size, which follows the viewport. On a width change,
      // groups still waiting simply appear at rest rather than reveal with stale widths.
      let lastWidth = window.innerWidth;
      const onResize = () => {
        if (window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;
        for (const r of reveals) if (r.timeline.progress() === 0) r.timeline.progress(1);
      };
      window.addEventListener("resize", onResize);
      listeners.push(() => window.removeEventListener("resize", onResize));
      listeners.push(() => {
        alive = false;
      });
      return cleanup;
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="coll wrap"
      id="collection"
      aria-labelledby="coll-h"
      data-motion-owner={OWNER}
      data-phase="initial"
    >
      {children}
    </section>
  );
}
