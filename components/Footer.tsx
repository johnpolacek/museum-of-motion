"use client";

// The footer persists across pages, so it enters once per document, when it first scrolls into view.
// No outro. Its big wordmark stretches from condensed to its wide rest.
import { useRef } from "react";
import { ExternalLink } from "lucide-react";
import { fontsReady, gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from "@/lib/motion/gsap";
import { armRecovery, claimVisit, disarm, handOff } from "@/lib/motion/boot";

const OWNER = "foot";

export function Footer() {
  const root = useRef<HTMLElement>(null);
  const visit = useRef<"animate" | "settle">(null);

  useGSAP(
    () => {
      const el = root.current!;
      visit.current ??= claimVisit(OWNER);
      const big = el.querySelector<HTMLElement>(".big")!;
      const links = Array.from(el.querySelectorAll<HTMLElement>("nav > *"));
      const settle = () => {
        gsap.set(big, { clearProps: "opacity,fontStretch,minHeight" });
        gsap.set(links, { clearProps: "opacity,transform" });
        el.dataset.phase = "settled";
      };
      if (visit.current === "settle" || prefersReducedMotion()) {
        settle();
        handOff(OWNER);
        return;
      }
      armRecovery(OWNER, settle);

      // Hold the wordmark's resting height: at phone widths it wraps, and condensed it would wrap less.
      // Measured at rest width, and again once fonts load, since the fallback face wraps differently.
      const holdHeight = () => {
        const stretch = big.style.fontStretch;
        big.style.fontStretch = "";
        big.style.minHeight = "";
        const height = big.getBoundingClientRect().height;
        big.style.fontStretch = stretch;
        big.style.minHeight = `${height}px`;
      };
      holdHeight();
      fontsReady(1500).then(() => {
        if (el.dataset.phase === "intro" && !tl.isActive() && tl.progress() === 0) holdHeight();
      });
      const tl = gsap
        .timeline({ paused: true, defaults: { overwrite: "auto" }, onComplete: settle })
        .from(big, { fontStretch: "62%", opacity: 0, duration: 1.0, ease: "signature", immediateRender: true }, 0)
        .from(links, { opacity: 0, y: 10, duration: 0.4, ease: "signature", stagger: 0.04, immediateRender: true }, 0.3);
      ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: () => tl.play() });
      el.dataset.phase = "intro";
      handOff(OWNER);
      return () => disarm(OWNER);
    },
    { scope: root },
  );

  return (
    <footer ref={root} className="foot wrap blue" data-motion-owner={OWNER} data-phase="initial">
      <div className="big" data-intro>
        Museum of Motion
      </div>
      <nav className="lab" aria-label="Credits" data-intro>
        <Out href="https://github.com/johnpolacek/animaxxing-skills">Animaxxing skills</Out>
        <Out href="https://github.com/greensock/gsap-skills">Official GSAP skills</Out>
        <Out href="https://gsap.com">GSAP</Out>
        <span>
          Created by <Out href="https://johnpolacek.com">John Polacek</Out>
        </span>
      </nav>
    </footer>
  );
}

/** A link off the site, marked with Lucide's external-link icon. */
function Out({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="out">
      {children}
      <ExternalLink aria-hidden="true" focusable="false" strokeWidth={2.25} />
    </a>
  );
}
