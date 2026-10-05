"use client";

// The exhibit stage, live: the sample text performs its exhibit on a loop, cued by the page intro,
// with pause, a scrub rail, the recipe's variations, and the knobs that apply to it.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { prefersReducedMotion } from "@/lib/motion/gsap";
import { createLoop, isLoop, STAGES, type Knob, type KnobSpec, type Loop, type LoopParams } from "@/lib/motion/stage";
import { useExhibitPhase } from "./ExhibitMotion";

const EASES = ["signature", "power3.out", "expo.out", "back.out(1.8)", "elastic.out(1, 0.5)", "none"];

type Props = { slug: string; desc: string };

const secs = (n: number) => n.toFixed(2);

const KNOB_DEFAULTS: Record<"duration" | "stagger" | "hold", KnobSpec> = {
  duration: { label: "Duration", min: 0.1, max: 2, step: 0.05, unit: "s" },
  stagger: { label: "Stagger", min: 0, max: 0.4, step: 0.01, unit: "s" },
  hold: { label: "Hold", min: 0, max: 5, step: 0.1, unit: "s" },
};

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function ExhibitStage({ slug, desc }: Props) {
  const def = STAGES[slug];
  // Interactive stages wait for the visitor: no loop, so no pause or scrub, and they work under reduced motion.
  const interactive = !!def.hint;
  const { cued, registerStop } = useExhibitPhase();
  const text = useRef<HTMLParagraphElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLInputElement>(null);
  const now = useRef<HTMLSpanElement>(null);
  const loop = useRef<Loop | null>(null);
  const [params, setParams] = useState<LoopParams>(() => def.defaults(def.variations[0]));
  const [playing, setPlaying] = useState(true);
  const [live, setLive] = useState(false);
  // Under reduced motion there is no loop, so no controls. Follows the setting live.
  const reduced = useSyncExternalStore(subscribeReduced, prefersReducedMotion, () => false);
  const [total, setTotal] = useState(0);
  const playingRef = useRef(true);
  const scrubbing = useRef(false);
  const offscreen = useRef(false);

  const sync = () => {
    const l = loop.current;
    if (!l) return;
    if (playingRef.current && !scrubbing.current && !offscreen.current) l.timeline.play();
    else l.timeline.pause();
  };

  // An address naming a tab, such as #underline, opens on it. Read after hydration, so the server's
  // first tab and the client's agree; the stage builds later, on cue, with the chosen tab.
  useEffect(() => {
    const named = decodeURIComponent(location.hash.slice(1));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the hash exists only in the browser
    if (named && def.variations.includes(named)) setParams(def.defaults(named));
  }, [def]);

  // Build the loop when the page intro cues the stage, and rebuild it whenever a knob changes.
  useEffect(() => {
    if (!cued || !text.current || (reduced && !interactive)) return;
    const built = createLoop(slug, text.current, params);
    if (!built) return;
    if (!isLoop(built)) {
      setLive(true);
      const unregister = registerStop(built.destroy);
      return () => {
        unregister();
        built.destroy();
      };
    }
    const l = built;
    loop.current = l;
    setLive(true);
    setTotal(l.cycle);
    l.timeline.eventCallback("onUpdate", () => {
      const t = l.timeline.time();
      if (now.current) now.current.textContent = secs(t);
      if (rail.current && !scrubbing.current) rail.current.value = String(t / l.cycle);
    });
    sync();
    const stop = () => {
      l.destroy();
      if (loop.current === l) loop.current = null;
    };
    const unregister = registerStop(stop);
    return () => {
      unregister();
      stop();
    };
  }, [cued, params, registerStop, reduced, slug, interactive]);

  // Off screen, the loop holds still. Width changes re-measure the lines by rebuilding.
  useEffect(() => {
    if (!live || !stage.current) return;
    const io = new IntersectionObserver(([entry]) => {
      offscreen.current = !entry.isIntersecting;
      sync();
    });
    io.observe(stage.current);
    let width = window.innerWidth;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(() => setParams((p) => ({ ...p })), 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      io.disconnect();
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, [live]);

  const toggle = () => {
    playingRef.current = !playingRef.current;
    setPlaying(playingRef.current);
    sync();
  };

  const scrub = (value: number) => {
    const l = loop.current;
    if (!l) return;
    scrubbing.current = true;
    l.timeline.pause();
    l.timeline.time(value * l.cycle);
  };
  const release = () => {
    if (!scrubbing.current) return;
    scrubbing.current = false;
    sync();
  };

  const set = <K extends keyof LoopParams>(key: K, value: LoopParams[K]) => setParams((p) => ({ ...p, [key]: value }));
  const has = (knob: Knob) => def.knobs.includes(knob);
  const spec = (key: "duration" | "stagger" | "hold"): KnobSpec => ({ ...KNOB_DEFAULTS[key], ...def.specs?.[key] });

  return (
    <>
      <div className="stage" data-intro ref={stage}>
        <p ref={text}>
          Every way a page
          <br />
          can move.
        </p>
      </div>
      <div className="controls lab" data-intro hidden={reduced && !interactive}>
        {interactive ? (
          <p className="hint">{def.hints?.[params.variation] ?? def.hint}</p>
        ) : (
          <>
        <button type="button" className="ctl" onClick={toggle} aria-pressed={!playing}>
          {playing ? "Pause" : "Play"}
        </button>
        <label className="scrub">
          <span className="num" ref={now}>
            0.00
          </span>
          <input
            ref={rail}
            type="range"
            min={0}
            max={1}
            step={0.01}
            defaultValue={0}
            aria-label="Scrub the loop"
            onInput={(e) => scrub(Number(e.currentTarget.value))}
            onPointerUp={release}
            onKeyUp={release}
            onBlur={release}
          />
          <span className="num">{secs(total)} s</span>
        </label>
          </>
        )}
        <div className="knobs">
          {(["duration", "stagger", "hold"] as const).map(
            (key) =>
              has(key) && <Knob key={key} {...spec(key)} value={params[key]} onChange={(v) => set(key, v)} />,
          )}
          {has("ease") && (
            <label className="knob">
              <span>Ease</span>
              <select value={params.ease} onChange={(e) => set("ease", e.currentTarget.value)}>
                {[...new Set([params.ease, ...EASES])].map((ease) => (
                  <option key={ease} value={ease}>
                    {ease}
                  </option>
                ))}
              </select>
            </label>
          )}
          {def.knobs.length > 0 && (
            <button type="button" className="ctl" onClick={() => setParams((p) => def.defaults(p.variation))}>
              Reset
            </button>
          )}
        </div>
      </div>
      <div className="row" data-intro>
        <p>{desc}</p>
        {def.labels.length > 1 && (
          <div className="tabs" role="group" aria-label="Variations">
            {def.labels.map((label, i) => {
              const variation = def.variations[i];
              const on = params.variation === variation;
              return (
                <button
                  key={label}
                  type="button"
                  className={on ? "on" : undefined}
                  aria-pressed={on}
                  disabled={!live}
                  onClick={() => {
                    setParams(def.defaults(variation));
                    // The address names the tab, so it can be shared, and old exhibit addresses can land on it.
                    history.replaceState(history.state, "", i === 0 ? location.pathname : `#${variation}`);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Knob(props: KnobSpec & { value: number; onChange: (v: number) => void }) {
  const { label, value, min, max, step, unit, onChange } = props;
  return (
    <label className="knob">
      <span>
        {label} <span className="num">{unit === "s" ? value.toFixed(2) : Math.round(value)} {unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.currentTarget.value))} />
    </label>
  );
}
