// Live stages for the Time exhibits. Each builds its
// own art inside the stage and plays it on the loop engine, so pause, scrub, and knobs work the same.
// Moves and values come from the animaxxing recipes: media effects, SVG effects, counters and marquees,
// page covers, physics effects, and sound cues.
import { gsap } from "../gsap";
import { art, assemble, def, EXIT, rnd, type StageDef } from "../stage-core";
import { EXHIBITS } from "../../exhibits";

const OPEN = "inset(0% 0% 0% 0%)";

/* ---------- Reveal ---------- */

const CLOSED: Record<string, string> = {
  up: "inset(100% 0% 0% 0%)",
  down: "inset(0% 0% 100% 0%)",
  left: "inset(0% 0% 0% 100%)",
  right: "inset(0% 100% 0% 0%)",
};
/** The wipe keeps travelling the same way to close. */
const GONE: Record<string, string> = {
  up: "inset(0% 0% 100% 0%)",
  down: "inset(100% 0% 0% 0%)",
  left: "inset(0% 100% 0% 0%)",
  right: "inset(0% 0% 0% 100%)",
};

/** A poster in the site's own type and colors, drawn inline so it uses the page font. */
const POSTER = `
<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" data-reveal-inner>
  <rect width="1600" height="900" fill="#0b0b0b"/>
  <g fill="none" stroke="#fff" stroke-width="3" opacity="0.5">
    <circle cx="1180" cy="430" r="320"/><circle cx="1180" cy="430" r="230"/><circle cx="1180" cy="430" r="140"/>
  </g>
  <text x="80" y="760" fill="#2130ff" font-family="var(--font-archivo), sans-serif" font-weight="800" font-size="640" font-stretch="75%" letter-spacing="-20">${String(EXHIBITS.find((e) => e.slug === "reveal")?.no ?? 0).padStart(2, "0")}</text>
  <text x="90" y="140" fill="#fff" font-family="var(--font-archivo), sans-serif" font-weight="700" font-size="54" letter-spacing="6">REVEAL</text>
</svg>`;

const imageReveal = def(
  ["Up", "Down", "Left", "Right"],
  ["up", "down", "left", "right"],
  ["duration", "hold", "ease"],
  { duration: 1, stagger: 0, hold: 1.8, ease: "power3.inOut" },
  (text, p) => {
    const { layer, remove } = art(text, `<figure class="frame">${POSTER}</figure>`);
    const frame = layer.querySelector<HTMLElement>(".frame")!;
    const inner = layer.querySelector<SVGElement>("[data-reveal-inner]")!;
    return assemble(
      text,
      p,
      [],
      {
        enter: (tl) => {
          tl.fromTo(frame, { clipPath: CLOSED[p.variation] }, { clipPath: OPEN, duration: p.duration, ease: p.ease }, 0).fromTo(
            inner,
            { scale: 1.15, transformOrigin: "50% 50%" },
            { scale: 1, duration: p.duration * 1.2, ease: "power2.out" },
            0,
          );
          return p.duration * 1.2;
        },
        exit: (tl, at) => tl.to(frame, { clipPath: GONE[p.variation], duration: p.duration * 0.6, ease: EXIT }, at),
      },
      remove,
    );
  },
);

/* ---------- Line draw ---------- */

const DRAWING = `
<svg viewBox="0 0 800 320" class="drawing">
  <g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 160 C 120 40, 220 280, 320 160 S 520 40, 620 160 S 740 280, 780 160"/>
    <circle cx="400" cy="160" r="120"/>
    <polyline points="60,290 140,230 220,290 300,230 380,290 460,230 540,290 620,230 700,290 780,230"/>
    <path d="M400 160 m -60 0 a 60 60 0 1 0 120 0 a 30 30 0 1 0 -60 0"/>
  </g>
</svg>`;

const lineDraw = def(["Line draw"], ["draw"], ["duration", "stagger", "hold", "ease"], { duration: 0.8, stagger: 0.12, hold: 1.6, ease: "power2.inOut" }, (text, p) => {
  const { layer, remove } = art(text, DRAWING);
  const strokes = Array.from(layer.querySelectorAll<SVGGeometryElement>("path, circle, polyline"));
  return assemble(
    text,
    p,
    [],
    {
      enter: (tl) => (
        tl.fromTo(strokes, { drawSVG: "0%" }, { drawSVG: "100%", duration: p.duration, ease: p.ease, stagger: p.stagger }, 0),
        p.duration + p.stagger * (strokes.length - 1)
      ),
      // Strokes retract toward their end.
      exit: (tl, at) => tl.fromTo(strokes, { drawSVG: "0% 100%" }, { drawSVG: "100% 100%", duration: p.duration * 0.6, ease: "power2.in", stagger: p.stagger * 0.5, immediateRender: false }, at),
    },
    remove,
  );
});

/* ---------- Path follow ---------- */

const ROUTE = "M400 160 C 560 0, 760 80, 640 200 C 540 300, 260 20, 160 120 C 40 240, 240 320, 400 160 Z";
const pathFollow = def(
  ["Dot", "Arrow"],
  ["dot", "arrow"],
  ["duration"],
  { duration: 6, stagger: 0, hold: 0, ease: "none" },
  (text, p) => {
    const mark =
      p.variation === "arrow"
        ? `<polygon class="mark" points="-16,-11 18,0 -16,11 -8,0" fill="#fff"/>`
        : `<circle class="mark" r="13" fill="#fff"/>`;
    const { layer, remove } = art(
      text,
      `<svg viewBox="0 0 800 320" class="drawing"><path class="route" d="${ROUTE}" fill="none" stroke="#fff" stroke-opacity="0.3" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>${mark}</svg>`,
    );
    const path = layer.querySelector<SVGPathElement>(".route")!;
    const dot = layer.querySelector<SVGGraphicsElement>(".mark")!;
    return assemble(
      text,
      p,
      [],
      {
        enter: (tl) => {
          // One lap per cycle, linear, so the loop has no seam.
          tl.fromTo(
            dot,
            { motionPath: { path, align: path, alignOrigin: [0.5, 0.5], autoRotate: p.variation === "arrow", start: 0, end: 0 } },
            { motionPath: { path, align: path, alignOrigin: [0.5, 0.5], autoRotate: p.variation === "arrow", start: 0, end: 1 }, duration: p.duration, ease: "none" },
            0,
          );
          return p.duration;
        },
      },
      remove,
    );
  },
  {},
  { duration: { label: "Lap", min: 2, max: 12, step: 0.5 } },
);

/* ---------- Count-up ---------- */

type Figure = { prefix: string; value: number; decimals: number; suffix: string; label: string };
const FIGURES: Figure[] = [
  { prefix: "", value: 12480, decimals: 0, suffix: "", label: "Visitors" },
  { prefix: "", value: 98.6, decimals: 1, suffix: "%", label: "On time" },
  { prefix: "$", value: 3.2, decimals: 1, suffix: "M", label: "Raised" },
];
const format = (f: Figure, v: number) =>
  f.prefix + new Intl.NumberFormat("en", { minimumFractionDigits: f.decimals, maximumFractionDigits: f.decimals }).format(v) + f.suffix;

const countUp = def(["Count-up"], ["count"], ["duration", "stagger", "hold", "ease"], { duration: 1.6, stagger: 0.15, hold: 1.6, ease: "power3.out" }, (text, p) => {
  const { layer, remove } = art(
    text,
    `<div class="figures">${FIGURES.map((f) => `<div class="fig"><span class="val num">${format(f, f.value)}</span><span class="lab">${f.label}</span></div>`).join("")}</div>`,
  );
  const figs = Array.from(layer.querySelectorAll<HTMLElement>(".fig"));
  const vals = figs.map((fig) => fig.querySelector<HTMLElement>(".val")!);
  // Reserve each figure's final width, so the count never shifts its neighbours.
  vals.forEach((v) => (v.style.minWidth = `${v.getBoundingClientRect().width}px`));
  return assemble(
    text,
    p,
    [],
    {
      enter: (tl) => {
        FIGURES.forEach((f, i) => {
          const proxy = { v: 0 };
          const at = i * p.stagger;
          tl.fromTo(figs[i], { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "signature" }, at).fromTo(
            proxy,
            { v: 0 },
            { v: f.value, duration: p.duration, ease: p.ease, onUpdate: () => (vals[i].textContent = format(f, proxy.v)) },
            at,
          );
        });
        return p.duration + p.stagger * (FIGURES.length - 1);
      },
      exit: (tl, at) => tl.to(figs, { autoAlpha: 0, y: -10, duration: 0.25, ease: EXIT, stagger: 0.05 }, at),
    },
    remove,
  );
});

/* ---------- Odometer ---------- */

// Each figure ticks through three readings. Shapes stay the same, so the columns never rebuild.
const READINGS: Array<{ label: string; values: string[] }> = [
  { label: "Visitors", values: ["12,480", "12,486", "12,503"] },
  { label: "Price", values: ["$49", "$59", "$61"] },
  { label: "On time", values: ["98.6%", "99.1%", "97.4%"] },
];
/** Each column holds 0–9 twice, so a roll can pass 9 to 0 either way, as in the recipe. */
const COLUMN = 20;
const digitsOf = (s: string) => [...s].filter((c) => c >= "0" && c <= "9").map(Number);
const numberOf = (s: string) => Number(s.replace(/[^\d.]/g, ""));
/** The recipe's roll: forward through 9 to 0 when rising, back through the second set when falling. */
const rollSpan = (from: number, to: number, rising: boolean): [number, number] =>
  rising ? [from, to >= from ? to : to + 10] : [from + 10, to <= from ? to + 10 : to];

const odometer = def(["Odometer"], ["roll"], ["duration", "stagger", "hold", "ease"], { duration: 0.9, stagger: 0.04, hold: 1.2, ease: "signature" }, (text, p) => {
  const slot = (d: number) =>
    `<span class="odo-slot"><span class="odo-size">${d}</span><span class="odo-strip">${Array.from({ length: COLUMN }, (_, i) => `<span>${i % 10}</span>`).join("")}</span></span>`;
  const { layer, remove } = art(
    text,
    `<div class="figures odo">${READINGS.map(
      (r) =>
        `<div class="fig"><span class="val num">${[...r.values[0]].map((c) => (c >= "0" && c <= "9" ? slot(Number(c)) : c)).join("")}</span><span class="lab">${r.label}</span></div>`,
    ).join("")}</div>`,
  );
  const figs = Array.from(layer.querySelectorAll<HTMLElement>(".fig"));
  const y = (position: number) => (-100 / COLUMN) * position;
  return assemble(
    text,
    p,
    [],
    {
      enter: (tl) => {
        let last = 0;
        figs.forEach((fig, f) => {
          const strips = Array.from(fig.querySelectorAll<HTMLElement>(".odo-strip"));
          const { values } = READINGS[f];
          const at = f * 0.12;
          tl.fromTo(fig, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "signature" }, at);
          // First reading rolls up from zeros; each later one rolls from the reading before it.
          values.forEach((value, step) => {
            const prev = step ? digitsOf(values[step - 1]) : strips.map(() => 0);
            const next = digitsOf(value);
            const rising = step === 0 || numberOf(value) >= numberOf(values[step - 1]);
            const start = at + step * (p.duration + p.hold);
            next.forEach((digit, i) => {
              const [from, to] = rollSpan(prev[i], digit, rising);
              const delay = (strips.length - 1 - i) * p.stagger;
              if (from !== to) tl.fromTo(strips[i], { yPercent: y(from) }, { yPercent: y(to), duration: p.duration, ease: p.ease, immediateRender: step === 0 }, start + delay);
            });
            last = Math.max(last, start + p.duration + p.stagger * (strips.length - 1));
          });
        });
        return last;
      },
      exit: (tl, at) => tl.to(figs, { autoAlpha: 0, y: -10, duration: 0.25, ease: EXIT, stagger: 0.05 }, at),
    },
    remove,
  );
});

/* ---------- Marquee ---------- */

const MARQUEE_WORDS = ["Line mask", "Characters", "Word slide", "Scramble", "Speak-in", "Weight wave", "Letter wave", "Marquee"];

const marquee = def(
  ["Left", "Right"],
  ["left", "right"],
  ["duration"],
  { duration: 120, stagger: 0, hold: 0, ease: "none" },
  (text, p) => {
    const items = MARQUEE_WORDS.map((w) => `<span>${w}</span><span class="sep">/</span>`).join("");
    const { layer, remove } = art(text, `<div class="mq"><div class="mq-track"><div class="mq-row">${items}</div><div class="mq-row">${items}</div></div></div>`, "live");
    const track = layer.querySelector<HTMLElement>(".mq-track")!;
    const width = layer.querySelector<HTMLElement>(".mq-row")!.getBoundingClientRect().width;
    const lap = width / Math.max(10, p.duration);
    const dir = p.variation === "right" ? 1 : -1;
    let tlRef: gsap.core.Timeline | null = null;
    // The recipe slows on mouse hover. Touch never triggers it.
    const slow = (e: PointerEvent) => e.pointerType === "mouse" && tlRef && gsap.to(tlRef, { timeScale: 0.25, duration: 0.4, overwrite: "auto" });
    const fast = () => tlRef && gsap.to(tlRef, { timeScale: 1, duration: 0.4, overwrite: "auto" });
    layer.addEventListener("pointerenter", slow);
    layer.addEventListener("pointerleave", fast);
    const loop = assemble(
      text,
      p,
      [],
      {
        enter: (tl) => {
          tl.fromTo(track, { x: dir < 0 ? 0 : -width }, { x: dir < 0 ? -width : 0, duration: lap, ease: "none" }, 0);
          return lap;
        },
      },
      () => {
        layer.removeEventListener("pointerenter", slow);
        layer.removeEventListener("pointerleave", fast);
        remove();
      },
    );
    tlRef = loop.timeline;
    return loop;
  },
  {},
  { duration: { label: "Speed", min: 30, max: 400, step: 10, unit: "px/s" } },
);

/* ---------- Cycle ---------- */

const MARKS = ["ACME", "Bolt", "CRANE", "dune", "Echo", "FERN", "gale", "HALO"];
/** Cell i alternates between marks i and i + 4. Swapping cells in this order returns every cell home in eight swaps. */
const SWAP_ORDER = [0, 2, 1, 3];

const logoCycle = def(["Cycle"], ["cycle"], ["duration", "hold", "ease"], { duration: 0.6, stagger: 0, hold: 1.4, ease: "power3.inOut" }, (text, p) => {
  const cells = [0, 1, 2, 3]
    .map((i) => `<div class="cell"><span class="mark m${i}">${MARKS[i]}</span><span class="mark m${i + 4}">${MARKS[i + 4]}</span></div>`)
    .join("");
  const { layer, remove } = art(text, `<div class="logos">${cells}</div>`);
  const pairs = Array.from(layer.querySelectorAll<HTMLElement>(".cell")).map((c) => Array.from(c.querySelectorAll<HTMLElement>(".mark")));
  return assemble(
    text,
    p,
    [],
    {
      enter: (tl) => {
        // Start: every cell shows its first mark, the second waits below.
        pairs.forEach(([a, b]) => tl.set(a, { yPercent: 0 }, 0).set(b, { yPercent: 100 }, 0));
        const showing = [0, 0, 0, 0];
        for (let k = 0; k < 8; k++) {
          const cell = SWAP_ORDER[k % 4];
          const out = pairs[cell][showing[cell]];
          const into = pairs[cell][1 - showing[cell]];
          const at = p.hold + k * (p.duration + p.hold);
          tl.fromTo(out, { yPercent: 0 }, { yPercent: -100, duration: p.duration, ease: p.ease, immediateRender: false }, at).fromTo(
            into,
            { yPercent: 100 },
            { yPercent: 0, duration: p.duration, ease: p.ease, immediateRender: false },
            at,
          );
          showing[cell] = 1 - showing[cell];
        }
        return 8 * (p.duration + p.hold);
      },
    },
    remove,
  );
}, {}, { hold: { label: "Every" } });

/* ---------- Curtain (panels or a curve) and Preloader: a small page swaps behind a cover ---------- */

const MINI = (cover: string) => `
<div class="mini">
  <div class="pg pg-a"><span class="lab">Museum of Motion</span><b>Collection</b><i></i><i></i><i></i></div>
  <div class="pg pg-b"><span class="lab">Time · 01 of ${EXHIBITS.length}</span><b>01 Line mask</b><i></i><i></i></div>
  ${cover}
</div>`;


const curveCover = def(["Curve cover"], ["curve"], ["duration", "hold", "ease"], { duration: 0.8, stagger: 0, hold: 1.2, ease: "power3.inOut" }, (text, p) => {
  const { layer, remove } = art(text, MINI(`<svg class="curve" viewBox="0 0 100 100" preserveAspectRatio="none"><path fill="#0b0b0b"/></svg>`));
  const path = layer.querySelector<SVGPathElement>(".curve path")!;
  const [a, b] = Array.from(layer.querySelectorAll<HTMLElement>(".pg"));
  // The leading edge bows up to 30% ahead in the middle, flattening as it covers.
  const BEND = 30;
  const cover = (q: number) => {
    const y = 100 - 100 * q;
    const bow = BEND * Math.sin(Math.PI * q);
    path.setAttribute("d", `M0 100 L0 ${y} Q50 ${y - bow} 100 ${y} L100 100 Z`);
  };
  const reveal = (q: number) => {
    const y = 100 - 100 * q;
    const bow = BEND * Math.sin(Math.PI * q);
    path.setAttribute("d", `M0 0 L100 0 L100 ${y} Q50 ${y - bow} 0 ${y} Z`);
  };
  const sweep = (tl: gsap.core.Timeline, at: number, show: HTMLElement, hide: HTMLElement) => {
    const c = { q: 0 };
    const r = { q: 0 };
    tl.fromTo(c, { q: 0 }, { q: 1, duration: p.duration, ease: p.ease, onUpdate: () => cover(c.q), immediateRender: false }, at)
      .set(hide, { autoAlpha: 0 }, at + p.duration)
      .set(show, { autoAlpha: 1 }, at + p.duration)
      .fromTo(r, { q: 0 }, { q: 1, duration: p.duration, ease: p.ease, onUpdate: () => reveal(r.q), immediateRender: false }, at + p.duration + 0.1);
    return at + p.duration * 2 + 0.1;
  };
  return assemble(
    text,
    p,
    [],
    {
      enter: (tl) => {
        tl.set(a, { autoAlpha: 1 }, 0).set(b, { autoAlpha: 0 }, 0).call(() => cover(0), undefined, 0);
        const first = sweep(tl, p.hold, b, a);
        return sweep(tl, first + p.hold, a, b);
      },
    },
    remove,
  );
});

const curtain = def(
  ["Panels", "Tilt", "Title", "Curve"],
  ["panels", "tilt", "title", "curve"],
  ["duration", "stagger", "hold", "ease"],
  { duration: 0.7, stagger: 0.04, hold: 1.2, ease: "power4.inOut" },
  (text, p) => {
    // Curve is the same page swap under one bowed shape: the skill's curveCover.
    if (p.variation === "curve") return curveCover.build(text, p);
    const { layer, remove } = art(text, MINI(`<div class="panels">${"<i></i>".repeat(5)}</div><div class="cover-title">Line mask</div>`));
    const panels = Array.from(layer.querySelectorAll<HTMLElement>(".panels i"));
    // Parked below the page by GSAP, never by a CSS transform: GSAP would read that as an extra offset,
    // and every panel would land a full height short of covering.
    gsap.set(panels, { yPercent: 100 });
    const [a, b] = Array.from(layer.querySelectorAll<HTMLElement>(".pg"));
    const title = layer.querySelector<HTMLElement>(".cover-title")!;
    const tilt = p.variation === "tilt" ? 8 : 0;
    const swap = (tl: gsap.core.Timeline, at: number, show: HTMLElement, hide: HTMLElement) => {
      tl.fromTo(panels, { yPercent: 100, rotation: tilt }, { yPercent: 0, rotation: 0, duration: p.duration, ease: p.ease, stagger: p.stagger, immediateRender: false }, at);
      const covered = at + p.duration + p.stagger * (panels.length - 1);
      tl.set(hide, { autoAlpha: 0 }, covered).set(show, { autoAlpha: 1 }, covered);
      if (p.variation === "title") {
        tl.fromTo(title, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "signature", immediateRender: false }, covered - 0.1).to(
          title,
          { autoAlpha: 0, y: -8, duration: 0.2, ease: EXIT },
          covered + 0.45,
        );
      }
      // Hold the cover a beat, so the swap reads as a page change rather than a flicker.
      const lift = covered + (p.variation === "title" ? 0.6 : 0.25);
      tl.to(panels, { yPercent: -100, rotation: -tilt, duration: p.duration, ease: p.ease, stagger: p.stagger }, lift);
      return lift + p.duration + p.stagger * (panels.length - 1);
    };
    return assemble(
      text,
      p,
      [],
      {
        enter: (tl) => {
          tl.set(a, { autoAlpha: 1 }, 0).set(b, { autoAlpha: 0 }, 0).set(panels, { yPercent: 100 }, 0).set(title, { autoAlpha: 0 }, 0);
          const first = swap(tl, p.hold, b, a);
          return swap(tl, first + p.hold, a, b);
        },
      },
      remove,
    );
  },
  { tilt: { duration: 0.7 }, curve: { duration: 0.8, stagger: 0, ease: "power3.inOut" } },
);

const preloader = def(["Preloader"], ["preload"], ["duration", "hold"], { duration: 0.7, stagger: 0, hold: 1.6, ease: "power4.inOut" }, (text, p) => {
  const { layer, remove } = art(text, MINI(`<div class="loader"><span class="count num">0</span><span class="bar"><i></i></span></div>`));
  const loader = layer.querySelector<HTMLElement>(".loader")!;
  const count = layer.querySelector<HTMLElement>(".count")!;
  const bar = layer.querySelector<HTMLElement>(".bar i")!;
  const page = layer.querySelectorAll<HTMLElement>(".pg-b > *");
  const [a, b] = Array.from(layer.querySelectorAll<HTMLElement>(".pg"));
  // Readiness arrives in steps (fonts, the hero image, data); the count eases to each one.
  const STEPS = [
    [0.3, 0.35],
    [0.7, 0.55],
    [1, 0.45],
  ] as const;
  const show = { v: 0 };
  const draw = () => {
    count.textContent = String(Math.round(show.v * 100));
    gsap.set(bar, { scaleX: show.v });
  };
  return assemble(
    text,
    p,
    [],
    {
      enter: (tl) => {
        tl.set(a, { autoAlpha: 0 }, 0).set(b, { autoAlpha: 1 }, 0).fromTo(loader, { yPercent: 0 }, { yPercent: 0, duration: 0.01 }, 0);
        let t = 0.2;
        let from = 0;
        for (const [to, d] of STEPS) {
          tl.fromTo(show, { v: from }, { v: to, duration: d, ease: "power2.out", onUpdate: draw, immediateRender: false }, t);
          t += d + 0.12;
          from = to;
        }
        // Lift into the page's intro.
        tl.to(loader, { yPercent: -100, duration: p.duration, ease: p.ease }, t).fromTo(
          page,
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 0.45, ease: "signature", stagger: 0.06 },
          t + p.duration * 0.6,
        );
        return t + p.duration + 0.3;
      },
      exit: (tl, at) => tl.to(page, { autoAlpha: 0, duration: 0.2, ease: EXIT }, at),
    },
    remove,
  );
});

/* ---------- Rain ---------- */

const RAIN_SETS: Record<string, string[]> = {
  shapes: ["●", "▲", "■", "◆", "✳"],
  letters: ["M", "O", "T", "I", "O", "N"],
  emoji: ["🎉", "✨", "💫", "⭐", "🌀"],
};
const GRAVITY = 900;

const rain = def(
  ["Shapes", "Letters", "Emoji"],
  ["shapes", "letters", "emoji"],
  ["hold"],
  { duration: 1.2, stagger: 0, hold: 0.6, ease: "none" },
  (text, p) => {
    const set = RAIN_SETS[p.variation] ?? RAIN_SETS.shapes;
    const COUNT = window.matchMedia("(pointer: coarse)").matches ? 24 : 40;
    const { layer, remove } = art(text, Array.from({ length: COUNT }, (_, i) => `<span class="drop">${set[i % set.length]}</span>`).join(""), "rain");
    const drops = Array.from(layer.querySelectorAll<HTMLElement>(".drop"));
    const { width: W, height: H } = layer.getBoundingClientRect();
    return assemble(
      text,
      p,
      [],
      {
        enter: (tl) => {
          let last = 0;
          drops.forEach((drop) => {
            // Drops from above the layer at 80 to 240 px/s under 900 px/s², spread over 1.2 s.
            const v = rnd(80, 240);
            const D = H + 120;
            const T = (-v + Math.sqrt(v * v + 2 * GRAVITY * D)) / GRAVITY;
            const at = rnd(0, p.duration);
            const fall = (x: number) => (v * T * x + 0.5 * GRAVITY * T * T * x * x) / D;
            tl.fromTo(
              drop,
              { x: rnd(0, W - 30), y: -60, rotation: rnd(-30, 30), autoAlpha: 1 },
              { y: D - 60, rotation: `+=${rnd(-240, 240)}`, duration: T, ease: fall, immediateRender: true },
              at,
            );
            last = Math.max(last, at + T);
          });
          return last;
        },
      },
      remove,
    );
  },
);

/* ---------- Sound cues ---------- */

/** A short synthesized tick, ±40 cents of variety, so each line sounds a little different. */
function tick(ctx: AudioContext, base: number, volume = 0.18) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = base * Math.pow(2, rnd(-40, 40) / 1200);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.13);
}

const soundCues = def(["Sound cues"], ["sound"], ["duration", "stagger", "hold", "ease"], { duration: 0.8, stagger: 0.12, hold: 1.6, ease: "signature" }, (text, p) => {
  // Off until the visitor opts in. Audio only starts from that click.
  const { layer, remove } = art(
    text,
    `<p class="sample">Every way a page<br>can move.</p><button type="button" class="lab ctl sound" aria-pressed="false">Sound off</button>`,
    "live",
  );
  const sample = layer.querySelector<HTMLElement>(".sample")!;
  const button = layer.querySelector<HTMLButtonElement>(".sound")!;
  let ctx: AudioContext | null = null;
  let tlRef: gsap.core.Timeline | null = null;
  const toggle = () => {
    if (!ctx) ctx = new AudioContext();
    const on = button.getAttribute("aria-pressed") !== "true";
    if (on) ctx.resume();
    else ctx.suspend();
    button.setAttribute("aria-pressed", String(on));
    button.textContent = on ? "Sound on" : "Sound off";
  };
  button.addEventListener("click", toggle);
  // Cues sound only while the loop plays, never while scrubbing.
  const cue = (freq: number) => () => {
    if (ctx && ctx.state === "running" && tlRef && !tlRef.paused()) tick(ctx, freq);
  };
  // The sample's two lines, each its own mask, as in Line mask.
  sample.innerHTML = `<span class="ln"><span>Every way a page</span></span><span class="ln"><span>can move.</span></span>`;
  const lines = Array.from(sample.querySelectorAll<HTMLElement>(".ln > span"));
  const loop = assemble(
    text,
    p,
    [],
    {
      enter: (tl) => {
        tl.fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: p.duration, ease: p.ease, stagger: p.stagger }, 0);
        lines.forEach((_, i) => tl.call(cue(660 + i * 220), undefined, i * p.stagger + 0.05));
        return p.duration + p.stagger * (lines.length - 1);
      },
      exit: (tl, at) => {
        tl.to(lines, { yPercent: -110, duration: Math.max(0.2, p.duration * 0.4), ease: EXIT, stagger: p.stagger * 0.5 }, at);
        tl.call(cue(330), undefined, at);
      },
    },
    () => {
      button.removeEventListener("click", toggle);
      ctx?.close();
      remove();
    },
  );
  tlRef = loop.timeline;
  return loop;
});

export const TIME_STAGES: Record<string, StageDef> = {
  reveal: imageReveal,
  "line-draw": lineDraw,
  "path-follow": pathFollow,
  "count-up": countUp,
  odometer,
  marquee,
  cycle: logoCycle,
  curtain,
  preloader,
  rain,
  "sound-cues": soundCues,
};
