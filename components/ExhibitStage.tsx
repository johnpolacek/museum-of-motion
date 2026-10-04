"use client";

// The exhibit stage, live: the sample text performs on a loop once the page settles, with
// pause, a scrub rail, the recipe's variations, and the knobs that shape it.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { prefersReducedMotion } from "@/lib/motion/gsap";
import { createLoop, DEFAULTS, type Loop, type LoopParams, type Variation } from "@/lib/motion/stage";
import { useExhibitPhase } from "./ExhibitMotion";

const VARIATIONS: Variation[] = ["mask", "ellipse", "highlight"];
const EASES = ["signature", "power3.out", "expo.out", "back.out(1.8)", "elastic.out(1, 0.5)", "none"];

type Props = { desc: string; labels: string[] };

const secs = (n: number) => n.toFixed(2);

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function ExhibitStage({ desc, labels }: Props) {
  const { settled, registerStop } = useExhibitPhase();
  const text = useRef<HTMLParagraphElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLInputElement>(null);
  const now = useRef<HTMLSpanElement>(null);
  const loop = useRef<Loop | null>(null);
  const [params, setParams] = useState<LoopParams>(DEFAULTS);
  const [playing, setPlaying] = useState(true);
  const [live, setLive] = useState(false);
  // Under reduced motion there is no loop, so no controls. Follows the setting live.
  const reduced = useSyncExternalStore(subscribeReduced, prefersReducedMotion, () => false);
  const [total, setTotal] = useState(0);
  const playingRef = useRef(true);
  const scrubbing = useRef(false);
  const offscreen = useRef(false);
  const first = useRef(true);

  const sync = () => {
    const l = loop.current;
    if (!l) return;
    if (playingRef.current && !scrubbing.current && !offscreen.current) l.timeline.play();
    else l.timeline.pause();
  };

  // Build the loop once the page intro has settled, and rebuild it whenever a knob changes.
  useEffect(() => {
    if (!settled || !text.current || reduced) return;
    const l = createLoop(text.current, params);
    if (!l) return;
    loop.current = l;
    setLive(true);
    setTotal(l.cycle);
    l.timeline.eventCallback("onUpdate", () => {
      const t = l.timeline.time();
      if (now.current) now.current.textContent = secs(t);
      if (rail.current && !scrubbing.current) rail.current.value = String(t / l.cycle);
    });
    // The page intro already played the first entrance: the first loop picks up at rest.
    l.timeline.time(first.current ? l.restAt : 0);
    first.current = false;
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
  }, [settled, params, registerStop, reduced]);

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

  return (
    <>
      <div className="stage" data-intro ref={stage}>
        <p ref={text}>
          Every way a page
          <br />
          can move.
        </p>
      </div>
      <div className="controls lab" data-intro hidden={reduced}>
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
        <div className="knobs">
          <Knob label="Duration" value={params.duration} min={0.2} max={2} step={0.05} unit="s" onChange={(v) => set("duration", v)} />
          <Knob label="Stagger" value={params.stagger} min={0} max={0.4} step={0.01} unit="s" onChange={(v) => set("stagger", v)} />
          <Knob label="Hold" value={params.hold} min={0} max={5} step={0.1} unit="s" onChange={(v) => set("hold", v)} />
          <label className="knob">
            <span>Ease</span>
            <select value={params.ease} onChange={(e) => set("ease", e.currentTarget.value)}>
              {EASES.map((ease) => (
                <option key={ease} value={ease}>
                  {ease}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="ctl" onClick={() => setParams((p) => ({ ...DEFAULTS, variation: p.variation }))}>
            Reset
          </button>
        </div>
      </div>
      <div className="row" data-intro>
        <p>{desc}</p>
        <div className="tabs" role="group" aria-label="Variations">
          {labels.map((label, i) => {
            const variation = VARIATIONS[i];
            const on = params.variation === variation;
            return (
              <button
                key={label}
                type="button"
                className={on ? "on" : undefined}
                aria-pressed={on}
                disabled={!live}
                onClick={() => set("variation", variation)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Knob(props: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  const { label, value, min, max, step, unit, onChange } = props;
  return (
    <label className="knob">
      <span>
        {label} <span className="num">{value.toFixed(2)} {unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.currentTarget.value))} />
    </label>
  );
}
