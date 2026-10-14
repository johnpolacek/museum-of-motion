"use client";

// Home hero controller: initial state → intro → settled (ambient wave) → outro → end state.
// Replay sends settled back through the intro, for the headline alone.
import { useEffect, useRef, useState } from "react";
import { finished, fontsReady, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion/gsap";
import { armRecovery, claimVisit, disarm, handOff } from "@/lib/motion/boot";
import { heroIntro, heroLeaves, heroOutro, waveNamer, type HeroIntro } from "@/lib/motion/hero";
import { MOVE_NAMES, startWave, type WaveStop } from "@/lib/motion/wave";
import { cueWordmark } from "@/lib/motion/events";
import { useTransitionController } from "./motion/TransitionProvider";
import { COUNT_WORDS, numberOf } from "@/lib/exhibits";

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
  const replay = useRef<() => void>(() => {});
  const [canReplay, setCanReplay] = useState(false);
  const [waveOn, setWaveOn] = useState(false);
  const [paused, setPaused] = useState(false);
  // The wave move in play, or the last one played. Null until the first.
  const [move, setMove] = useState<string | null>(null);
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
      // The wave follows any intro that ran: the first one, or a replay.
      let ambient = animate;
      let alive = true;
      // The boot deadline passed before the intro could start.
      let rolledBack = false;
      let intro: HeroIntro | null = null;
      let io: IntersectionObserver | null = null;
      let waveCall: gsap.core.Tween | null = null;
      let lastWidth = window.innerWidth;
      let resizeTimer: ReturnType<typeof setTimeout> | undefined;

      // Each control exists only when it can do something. Rendered before the first paint.
      userPaused.current = readPaused();
      setPaused(userPaused.current);
      setWaveOn(animate);
      setCanReplay(!reduced);

      const targets = Array.from(el.querySelectorAll<HTMLElement>("[data-intro]"));

      // The label names each move as it starts. Null clears it.
      const namer = waveNamer(el);
      const showMove = contextSafe!((name: string | null) => {
        setMove(name);
        namer(name);
      });

      const runWave = contextSafe!(() => {
        wave.current?.();
        wave.current = startWave(heroLeaves(el), { onMove: showMove });
        applyPause();
      });

      const settled = contextSafe!(() => {
        intro?.finish();
        gsap.set(targets, { clearProps: "opacity,visibility" });
        el.dataset.phase = "settled";
        cueWordmark();
        if (!ambient) return;
        // The wave's split waits until the wordmark tour is done, so the two never share a frame's work.
        waveCall?.kill();
        waveCall = gsap.delayedCall(2.4, () => {
          if (alive && el.dataset.phase === "settled") runWave();
        });
        if (io) return;
        io = new IntersectionObserver(([entry]) => {
          offscreen.current = !entry.isIntersecting;
          applyPause();
        });
        io.observe(el.querySelector("h1")!);
      });

      // Replay: the wave steps aside and the headline performs again from the top.
      replay.current = contextSafe!(() => {
        const phase = el.dataset.phase;
        if (!alive || reduced || !(phase === "settled" || (phase === "intro" && intro))) return;
        waveCall?.kill();
        wave.current?.();
        wave.current = null;
        showMove(null);
        intro?.timeline.kill();
        intro?.finish();
        try {
          intro = heroIntro(el, { replay: true });
        } catch (error) {
          console.error(error);
          settled();
          return;
        }
        ambient = true;
        setWaveOn(true);
        el.dataset.phase = "intro";
        intro.timeline.eventCallback("onComplete", settled);
        intro.timeline.play();
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
        replay.current = () => {};
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
        rolledBack = true;
        ambient = false;
        setWaveOn(false);
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
      {/* The ambient wave's exhibit, its move in play, and its pause, just above the rule. Hidden, the row keeps its space, so the headline never shifts. */}
      <div className="over" hidden={!waveOn}>
        <span className="lab" data-hero-item data-intro>
          {numberOf("wave")} Wave{" "}
          {/* Every name, stacked in one cell sized to the longest. Only the move in play shows. */}
          <span className="mvw" aria-hidden="true">
            <i data-move-bar>|</i>{" "}
            <span className="mvs">
              {MOVE_NAMES.map((name) => (
                <span key={name} data-move={name}>
                  {[...name].map((c, i) => (
                    <span key={i}>{c}</span>
                  ))}
                </span>
              ))}
            </span>
          </span>
          <span className="sr">{move}</span>
        </span>
        {/* Both words stacked, so the button keeps one width and the label beside it holds still. */}
        <button type="button" className="lab hero-ctl swap" data-hero-item data-intro aria-label={paused ? "Play the wave" : "Pause the wave"} onClick={toggle}>
          <span hidden={paused}>Pause</span>
          <span hidden={!paused}>Play</span>
        </button>
      </div>
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
          <button type="button" className="lab hero-ctl" data-hero-item data-intro hidden={!canReplay} aria-label="Replay the headline animation" onClick={() => replay.current()}>
            Replay
          </button>
        </div>
      </div>
    </section>
  );
}
