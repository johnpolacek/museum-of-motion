"use client";

// The masthead persists across pages: one intro on first load, no outro.
// Its wordmark performs last, a letter-by-letter tour of the collection.
import { useRef } from "react";
import { fontsReady, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion/gsap";
import { wordmarkCue } from "@/lib/motion/events";
import { wordmarkTour, type WordmarkTour } from "@/lib/motion/wordmark";
import { armRecovery, claimVisit, disarm, handOff } from "@/lib/motion/boot";
import { collectionTargets, glideTo } from "@/lib/motion/home-nav";
import { TransitionLink } from "./motion/TransitionLink";

const OWNER = "mast";

/**
 * On the home page these links move the page instead of navigating: every click glides, even when
 * the address would not change. Elsewhere they navigate as links, with the page transition.
 */
function onHome(e: React.MouseEvent<HTMLAnchorElement>, to: "top" | "collection") {
  if (window.location.pathname !== "/" || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  const { section, heading } = collectionTargets();
  if (to === "collection" && !section) return;
  e.preventDefault();
  glideTo(to === "top" ? "top" : section!, to === "top" ? null : heading);
}

export function Masthead() {
  const root = useRef<HTMLElement>(null);
  const visit = useRef<"animate" | "settle">(null);

  useGSAP(
    (_, contextSafe) => {
      const el = root.current!;
      visit.current ??= claimVisit(OWNER);
      const leaf = el.querySelector<HTMLElement>(".word .wm")!;
      const links = Array.from(el.querySelectorAll<HTMLElement>("nav a"));
      let alive = true;
      let tour: WordmarkTour | null = null;
      const settle = () => {
        tour?.finish();
        gsap.set([leaf, ...links], { clearProps: "opacity,visibility,transform" });
        el.dataset.phase = "settled";
      };
      if (visit.current === "settle" || prefersReducedMotion()) {
        settle();
        handOff(OWNER);
        return;
      }
      armRecovery(OWNER, () => {
        alive = false;
        tour?.timeline.kill();
        settle();
      });

      // Nav labels rise in with the page. The wordmark waits its turn: it performs last.
      gsap.set(leaf, { autoAlpha: 0 });
      gsap.fromTo(
        links,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.4, ease: "signature", stagger: 0.04, delay: 0.2, clearProps: "transform" },
      );
      el.dataset.phase = "intro";
      handOff(OWNER);

      // On the home page, once the headline has landed. Elsewhere, a beat after the page appears.
      const cue = window.location.pathname === "/" ? wordmarkCue(4000) : new Promise((r) => setTimeout(r, 400));
      Promise.all([cue, fontsReady(600)]).then(
        contextSafe!(() => {
          if (!alive) return;
          try {
            tour = wordmarkTour(leaf);
          } catch (error) {
            console.error(error);
            settle();
            return;
          }
          tour.timeline.eventCallback("onComplete", settle).play();
        }),
      );
      return () => {
        alive = false;
        disarm(OWNER);
        tour?.finish();
      };
    },
    { scope: root },
  );

  return (
    <header ref={root} className="mast wrap blue" data-motion-owner={OWNER} data-phase="initial">
      <TransitionLink className="word" href="/" onClick={(e) => onHome(e, "top")}>
        <span className="wm" data-intro>
          Museum of Motion
        </span>
      </TransitionLink>
      <nav className="lab" aria-label="Main">
        <TransitionLink href="/#collection" data-intro onClick={(e) => onHome(e, "collection")}>
          Collection
        </TransitionLink>
        <TransitionLink href="/about" data-intro>
          About
        </TransitionLink>
      </nav>
    </header>
  );
}
