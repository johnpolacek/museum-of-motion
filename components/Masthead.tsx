"use client";

// The masthead persists across pages: one intro on first load, no outro.
import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/motion/gsap";
import { armRecovery, claimVisit, disarm, handOff } from "@/lib/motion/boot";
import { TransitionLink } from "./motion/TransitionLink";

const OWNER = "mast";

export function Masthead() {
  const root = useRef<HTMLElement>(null);
  const visit = useRef<"animate" | "settle">(null);

  useGSAP(
    () => {
      const el = root.current!;
      visit.current ??= claimVisit(OWNER);
      const word = el.querySelector<HTMLElement>(".word")!;
      const links = Array.from(el.querySelectorAll<HTMLElement>("nav a"));
      const targets = [word, ...links];
      const settle = () => {
        gsap.set(targets, { clearProps: "opacity,visibility,transform,fontStretch,fontWeight" });
        el.dataset.phase = "settled";
      };
      if (visit.current === "settle" || prefersReducedMotion()) {
        settle();
        handOff(OWNER);
        return;
      }
      armRecovery(OWNER, settle);

      // Wordmark arrives condensed and light, then widens and gains weight to rest.
      const tl = gsap.timeline({ defaults: { overwrite: "auto" }, onComplete: settle });
      tl.fromTo(
        word,
        { autoAlpha: 0, fontStretch: "62%", fontWeight: 200 },
        { autoAlpha: 1, fontStretch: "75%", fontWeight: 800, duration: 0.8, ease: "signature" },
        0,
      ).fromTo(
        links,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.4, ease: "signature", stagger: 0.04 },
        0.2,
      );
      el.dataset.phase = "intro";
      handOff(OWNER);
      return () => disarm(OWNER);
    },
    { scope: root },
  );

  return (
    <header ref={root} className="mast wrap blue" data-motion-owner={OWNER} data-phase="initial">
      <TransitionLink className="word" href="/" data-intro>
        Museum of Motion
      </TransitionLink>
      <nav className="lab" aria-label="Main">
        <TransitionLink href="/#collection" data-intro>
          Collection
        </TransitionLink>
        <TransitionLink href="/about" data-intro>
          About
        </TransitionLink>
      </nav>
    </header>
  );
}
