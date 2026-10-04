"use client";

// Home hero controller: initial state → intro → settled (ambient wave) → outro → end state.
import { useEffect, useRef, useState } from "react";
import { finished, fontsReady, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion/gsap";
import { armRecovery, claimVisit, disarm, handOff } from "@/lib/motion/boot";
import { heroIntro, heroLeaves, heroOutro, type HeroIntro } from "@/lib/motion/hero";
import { startWave, type WaveStop } from "@/lib/motion/wave";
import { cueWordmark } from "@/lib/motion/events";
import { useTransitionController } from "./motion/TransitionProvider";

const OWNER = "hero";
const PAUSE_KEY = "mom:wave-paused";

function readPaused(): boolean {
  try {
    return localStorage.getItem(PAUSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const visit = useRef<"animate" | "settle">(null);
  const wave = useRef<WaveStop | null>(null);
  const userPaused = useRef(false);
  const offscreen = useRef(false);
  const [waveOn, setWaveOn] = useState(false);
  const [paused, setPaused] = useState(false);
  const { registerOutro } = useTransitionController();

  const applyPause = () => {
    if (userPaused.current || offscreen.current) wave.current?.pause();
    else wave.current?.resume();
  };

  useGSAP(
    (_, contextSafe) => {
      const el = root.current!;
      visit.current ??= claimVisit(OWNER);
      const reduced = prefersReducedMotion();
      const animate = visit.current === "animate" && !reduced;
      let alive = true;
      let intro: HeroIntro | null = null;
      let io: IntersectionObserver | null = null;
      let lastWidth = window.innerWidth;
      let resizeTimer: ReturnType<typeof setTimeout> | undefined;

      // The wave control exists only when the wave can run. Rendered before the first paint.
      userPaused.current = readPaused();
      setPaused(userPaused.current);
      setWaveOn(animate);

      const targets = Array.from(el.querySelectorAll<HTMLElement>("[data-intro]"));

      const runWave = contextSafe!(() => {
        wave.current?.();
        wave.current = startWave(heroLeaves(el));
        applyPause();
      });

      const settled = contextSafe!(() => {
        intro?.finish();
        gsap.set(targets, { clearProps: "opacity,visibility" });
        el.dataset.phase = "settled";
        cueWordmark();
        if (!animate) return;
        // The wave's split waits until the wordmark tour is done, so the two never share a frame's work.
        gsap.delayedCall(2.4, () => {
          if (alive && el.dataset.phase === "settled") runWave();
        });
        io = new IntersectionObserver(([entry]) => {
          offscreen.current = !entry.isIntersecting;
          applyPause();
        });
        io.observe(el.querySelector("h1")!);
      });

      // Width changes invalidate the wave's pinned letter widths: rebuild it at rest.
      const onResize = () => {
        if (window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (alive && wave.current && el.dataset.phase === "settled") runWave();
        }, 200);
      };
      window.addEventListener("resize", onResize);

      // Outro: only when the hero is on screen. Starts from current values, even mid-intro.
      const outro = contextSafe!(() => {
        const box = el.querySelector("h1")!.getBoundingClientRect();
        if (box.bottom <= 0 || box.top >= window.innerHeight) return null;
        alive = false;
        wave.current?.();
        wave.current = null;
        io?.disconnect();
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
        unregister();
        disarm(OWNER);
        window.removeEventListener("resize", onResize);
        clearTimeout(resizeTimer);
        io?.disconnect();
        wave.current?.();
        wave.current = null;
        intro?.finish();
      };

      if (!animate) {
        handOff(OWNER);
        settled();
        return cleanup;
      }

      // Initial state: hide every entering target inline, then let the boot gate go.
      armRecovery(OWNER, () => {
        alive = false;
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
          if (!alive) return;
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

  // The user's pause control. Remembered across visits.
  useEffect(() => {
    userPaused.current = paused;
    applyPause();
  });

  const toggle = () => {
    const next = !paused;
    setPaused(next);
    try {
      localStorage.setItem(PAUSE_KEY, next ? "1" : "0");
    } catch {}
  };

  return (
    <section ref={root} className="hero wrap blue" aria-labelledby="h" data-motion-owner={OWNER} data-phase="initial">
      {/* Each word performs its numbered exhibit, then rests frozen mid-effect, as on the poster. Poses live in globals.css. */}
      <h1 id="h" aria-label="Every way a page can move." data-intro>
        <span className="w" data-word="every" aria-hidden="true">
          <span className="t">
            <span className="ch">E</span>
            <span className="ch">v</span>
            <span className="ch">e</span>
            <span className="ch">r</span>
            <span className="ch">y</span>
          </span>
          <sup>02</sup>
        </span>{" "}
        <span className="w us" data-word="way" aria-hidden="true">
          <span className="t">way</span>
          <i data-ul></i>
          <sup>39</sup>
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
          <sup>06</sup>
        </span>{" "}
        <span className="w" data-word="can" aria-hidden="true">
          <span className="t">can</span>
          <sup>29</sup>
        </span>{" "}
        <span className="w" data-word="move" aria-hidden="true">
          <span className="mk">
            <span className="t">move.</span>
          </span>
          <sup>01</sup>
        </span>
      </h1>
      <div className="under">
        <i className="rule" data-rule data-intro aria-hidden="true"></i>
        <p data-sub data-intro>
          Sixty-three web animation effects, each shown on its own: what it does, what drives it, and how it handles
          touch, keyboard, and reduced motion.
        </p>
        <div className="side">
          <ol className="lab" aria-label="In this headline" data-list data-intro>
            <li>01 Line mask</li>
            <li>02 Characters</li>
            <li>06 Weight wave</li>
            <li>29 Velocity skew</li>
            <li>39 Underline sweep</li>
          </ol>
          <button type="button" className="lab wave-toggle" data-wave-toggle data-intro hidden={!waveOn} onClick={toggle}>
            {paused ? "Play wave" : "Pause wave"}
          </button>
        </div>
      </div>
    </section>
  );
}
