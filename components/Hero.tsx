"use client";

// Home hero controller: initial state → intro → settled → outro → end state.
// Replay sends settled back through the intro, for the headline alone.
import { useRef, useState } from "react";
import { finished, fontsReady, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion/gsap";
import { armRecovery, claimVisit, disarm, handOff } from "@/lib/motion/boot";
import { heroIntro, heroOutro, type HeroIntro } from "@/lib/motion/hero";
import { cueWordmark } from "@/lib/motion/events";
import { useTransitionController } from "./motion/TransitionProvider";
import { COUNT_WORDS, numberOf } from "@/lib/exhibits";

const OWNER = "hero";

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const visit = useRef<"animate" | "settle">(null);
  const replay = useRef<() => void>(() => {});
  const [canReplay, setCanReplay] = useState(false);
  const { registerOutro } = useTransitionController();

  useGSAP(
    (_, contextSafe) => {
      const el = root.current!;
      visit.current ??= claimVisit(OWNER);
      const reduced = prefersReducedMotion();
      const animate = visit.current === "animate" && !reduced;
      let alive = true;
      // The boot deadline passed before the intro could start.
      let rolledBack = false;
      let intro: HeroIntro | null = null;

      // Replay exists only when there is motion to replay. Rendered before the first paint.
      setCanReplay(!reduced);

      const targets = Array.from(el.querySelectorAll<HTMLElement>("[data-intro]"));

      // Settled: the headline rests as plain type until a replay or the outro.
      const settled = contextSafe!(() => {
        intro?.finish();
        gsap.set(targets, { clearProps: "opacity,visibility" });
        el.dataset.phase = "settled";
        cueWordmark();
      });

      // Replay: the headline performs again from the top, even when a slow start skipped the intro.
      replay.current = contextSafe!(() => {
        const phase = el.dataset.phase;
        if (!alive || reduced || !(phase === "settled" || (phase === "intro" && intro))) return;
        intro?.timeline.kill();
        intro?.finish();
        try {
          intro = heroIntro(el, { replay: true });
        } catch (error) {
          console.error(error);
          settled();
          return;
        }
        el.dataset.phase = "intro";
        intro.timeline.eventCallback("onComplete", settled);
        intro.timeline.play();
      });

      // Outro: only when the hero is on screen. Starts from current values, even mid-intro.
      const outro = contextSafe!(() => {
        const box = el.querySelector("h1")!.getBoundingClientRect();
        if (box.bottom <= 0 || box.top >= window.innerHeight) return null;
        alive = false;
        intro?.timeline.kill();
        el.dataset.phase = "outro";
        const tl = heroOutro(el);
        return finished(tl).then(() => {
          // End state: still mounted and visible, no longer interactive.
          el.dataset.phase = "end";
          el.inert = true;
        });
      });
      const unregister = registerOutro(outro);

      const cleanup = () => {
        alive = false;
        replay.current = () => {};
        unregister();
        disarm(OWNER);
        intro?.finish();
      };

      if (!animate) {
        handOff(OWNER);
        settled();
        return cleanup;
      }

      // Initial state: hide every entering target inline, then let the boot gate go.
      armRecovery(OWNER, () => {
        rolledBack = true;
        intro?.timeline.kill();
        intro?.finish();
        gsap.set(targets, { clearProps: "opacity,visibility" });
        el.dataset.phase = "settled";
      });
      gsap.set(targets, { autoAlpha: 0 });
      el.dataset.phase = "intro";

      // Splits need final font metrics. Bounded well inside the boot deadline.
      fontsReady(600).then(
        contextSafe!(() => {
          if (!alive || rolledBack) return;
          try {
            intro = heroIntro(el);
          } catch (error) {
            console.error(error);
            settled();
            handOff(OWNER);
            return;
          }
          intro.timeline.eventCallback("onComplete", settled);
          // The wordmark tour starts as the last superscript lands, overlapping the hero's quiet tail.
          intro.timeline.call(cueWordmark, undefined, 1.75);
          handOff(OWNER);
          intro.timeline.play();
        }),
      );

      return cleanup;
    },
    { scope: root },
  );

  return (
    <section ref={root} className="hero wrap blue" aria-labelledby="h" data-motion-owner={OWNER} data-phase="initial">
      {/* Each word performs its numbered exhibit, then rests as plain type: a straight sentence. */}
      <h1 id="h" aria-label="Every way a page can move." data-intro>
        <span className="w" data-word="every" aria-hidden="true">
          <span className="t">
            <span className="ch">E</span>
            <span className="ch">v</span>
            <span className="ch">e</span>
            <span className="ch">r</span>
            <span className="ch">y</span>
          </span>
          <sup>{numberOf("stagger")}</sup>
        </span>{" "}
        <span className="w us" data-word="way" aria-hidden="true">
          <span className="t">way</span>
          <i data-ul></i>
          <sup>{numberOf("hover")}</sup>
        </span>{" "}
        <span className="w" data-word="a" aria-hidden="true">
          <span className="t">a</span>
        </span>{" "}
        <span className="w" data-word="page" aria-hidden="true">
          <span className="t">
            <span className="ch">p</span>
            <span className="ch">a</span>
            <span className="ch">g</span>
            <span className="ch">e</span>
          </span>
          <sup>{numberOf("wave")}</sup>
        </span>{" "}
        <span className="w" data-word="can" aria-hidden="true">
          <span className="t">can</span>
          <sup>{numberOf("slide")}</sup>
        </span>{" "}
        <span className="w" data-word="move" aria-hidden="true">
          <span className="mk">
            <span className="t">move.</span>
          </span>
          <sup>{numberOf("mask")}</sup>
        </span>
      </h1>
      <div className="under">
        <i className="rule" data-rule data-intro aria-hidden="true"></i>
        <p data-sub data-intro>
          {COUNT_WORDS} web animation effects, each shown on its own: what it does, what drives it, and how it handles
          touch, keyboard, and reduced motion.
        </p>
        <div className="side">
          <ol className="lab" aria-label="In this headline" data-list data-intro>
            {[
              ["mask", "Mask"],
              ["stagger", "Stagger"],
              ["slide", "Slide"],
              ["wave", "Wave"],
              ["hover", "Hover"],
            ].map(([slug, name]) => (
              <li key={slug}>
                {numberOf(slug)} {name}
              </li>
            ))}
          </ol>
          <button type="button" className="lab hero-ctl" data-hero-control data-intro hidden={!canReplay} aria-label="Replay the headline animation" onClick={() => replay.current()}>
            Replay
          </button>
        </div>
      </div>
    </section>
  );
}
