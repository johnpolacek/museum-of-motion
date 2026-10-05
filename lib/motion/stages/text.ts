// Live stages for the text exhibits. Recipes from the animaxxing skill's split entrances,
// speak-in, wave, route letters, and the motion vocabulary's shelf.
import { gsap, SplitText } from "../gsap";
import { type Act, art, assemble, def, end, EXIT, type LoopParams, merge, pinWidths, rnd, split, type StageDef } from "../stage-core";
import { EXHIBITS } from "../../exhibits";

/* ---------- Line mask ---------- */

const ELLIPSE = {
  closedBottom: "ellipse(20% 0% at 50% 100%)",
  openBottom: "ellipse(100% 120% at 50% 100%)",
  openTop: "ellipse(100% 120% at 50% 0%)",
  closedTop: "ellipse(20% 0% at 50% 0%)",
} as const;

/** Lays a bar over each line's words, for the highlight. SplitText's revert removes the bars with the split. */
function addBars(s: SplitText) {
  return s.lines.map((line) => {
    const words = s.words.filter((word) => line.contains(word));
    const lineBox = line.getBoundingClientRect();
    const boxes = words.map((word) => word.getBoundingClientRect());
    const left = boxes.length ? Math.min(...boxes.map((b) => b.left)) : lineBox.left;
    const right = boxes.length ? Math.max(...boxes.map((b) => b.right)) : lineBox.right;
    const bar = document.createElement("span");
    bar.setAttribute("aria-hidden", "true");
    Object.assign(bar.style, {
      position: "absolute",
      top: "0",
      bottom: "0",
      left: `${left - lineBox.left}px`,
      width: `${right - left}px`,
      background: "var(--line-highlight, currentColor)",
      pointerEvents: "none",
    });
    (line as HTMLElement).style.position = "relative";
    line.appendChild(bar);
    return { bar, words };
  });
}

export const lineMask = def(
  ["Line mask", "Ellipse", "Highlight"],
  ["mask", "ellipse", "highlight"],
  ["duration", "stagger", "hold", "ease"],
  { duration: 0.8, stagger: 0.06, hold: 2, ease: "signature" },
  (text, p) => {
    const splits: SplitText[] = [];
    const highlight = p.variation === "highlight";
    const s = split(text, highlight ? { type: "lines,words" } : { type: "lines", mask: "lines" }, splits);
    const lines = s.lines as HTMLElement[];
    const out = Math.max(0.2, p.duration * 0.4);
    const outEach = p.stagger * 0.5;
    if (p.variation === "mask") {
      return assemble(text, p, splits, {
        enter: (tl) => (tl.fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: p.duration, ease: p.ease, stagger: p.stagger }, 0), end(lines.length, p)),
        exit: (tl, at) => tl.to(lines, { yPercent: -110, duration: out, ease: EXIT, stagger: outEach }, at),
      });
    }
    if (p.variation === "ellipse") {
      const masks = s.masks as HTMLElement[];
      return assemble(text, p, splits, {
        enter: (tl) => {
          tl.fromTo(masks, { clipPath: ELLIPSE.closedBottom }, { clipPath: ELLIPSE.openBottom, duration: p.duration, ease: p.ease, stagger: p.stagger }, 0)
            .fromTo(lines, { yPercent: 40 }, { yPercent: 0, duration: p.duration, ease: p.ease, stagger: p.stagger }, 0);
          return end(lines.length, p);
        },
        exit: (tl, at) =>
          tl.fromTo(masks, { clipPath: ELLIPSE.openTop }, { clipPath: ELLIPSE.closedTop, duration: out, ease: EXIT, stagger: outEach, immediateRender: false }, at)
            .to(lines, { yPercent: -40, duration: out, ease: EXIT, stagger: outEach }, at),
      });
    }
    // A bar sweeps across each line, the words appear beneath it, the bar retracts. Out runs the same way.
    const sweep = Math.max(0.15, p.duration * 0.45);
    const bars = addBars(s);
    return assemble(text, p, splits, {
      enter: (tl) => {
        bars.forEach(({ bar, words }, i) => {
          const at = i * p.stagger * 2;
          tl.set(words, { autoAlpha: 0 }, 0)
            .fromTo(bar, { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: sweep, ease: "power3.in" }, at)
            .set(words, { autoAlpha: 1 }, at + sweep)
            .to(bar, { scaleX: 0, transformOrigin: "100% 50%", duration: sweep, ease: p.ease }, at + sweep);
        });
        return (bars.length - 1) * p.stagger * 2 + sweep * 2;
      },
      exit: (tl, at) =>
        bars.forEach(({ bar, words }, i) => {
          const t = at + i * outEach * 2;
          tl.fromTo(bar, { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: out, ease: "power3.in", immediateRender: false }, t)
            .set(words, { autoAlpha: 0 }, t + out)
            .to(bar, { scaleX: 0, transformOrigin: "100% 50%", duration: out, ease: EXIT }, t + out);
        }),
    });
  },
);

/* ---------- Characters ---------- */

export const characters = def(
  ["Implode", "Rise", "Cascade", "Flip", "Spring", "Scatter", "Fall"],
  ["implode", "rise", "cascade", "flip", "spring", "scatter", "fall"],
  ["duration", "stagger", "hold", "ease"],
  { duration: 0.6, stagger: 0.03, hold: 2, ease: "signature" },
  (text, p) => {
    const splits: SplitText[] = [];
    const masked = p.variation === "rise" || p.variation === "fall";
    const s = split(text, { type: "words,chars", ...(masked ? { mask: "chars" as const } : {}) }, splits);
    const chars = s.chars as HTMLElement[];
    const n = chars.length;
    const out = Math.max(0.2, p.duration * 0.4);
    const box = text.getBoundingClientRect();
    // From split-entrances' charsImplodeIn and charsExplodeOut: each character sits straight out from
    // the line's center, farther the farther it rests from it. Drawn once, so every pass is the same.
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const reach = Math.max(box.width * 0.6, 240);
    const burst = chars.map((c) => {
      const r = c.getBoundingClientRect();
      let dx = r.left + r.width / 2 - cx;
      let dy = r.top + r.height / 2 - cy;
      const length = Math.hypot(dx, dy);
      const angle = rnd(0, Math.PI * 2);
      [dx, dy] = length < 1 ? [Math.cos(angle), Math.sin(angle)] : [dx / length, dy / length];
      const distance = (reach + length) * rnd(0.7, 1.3);
      return { x: dx * distance, y: dy * distance * 0.7 + rnd(-reach, reach) * 0.15, rotation: rnd(-120, 120), scale: rnd(1.6, 2.6) };
    });
    const fall = (tl: gsap.core.Timeline, at: number, dir: 1 | -1) =>
      tl.to(chars, { yPercent: 115 * dir, duration: out, ease: EXIT, stagger: 0.012 }, at);
    const acts: Record<string, Act> = {
      implode: {
        enter: (tl) => (
          tl.fromTo(
            chars,
            { autoAlpha: 0, x: (i: number) => burst[i].x, y: (i: number) => burst[i].y, rotation: (i: number) => burst[i].rotation, scale: (i: number) => burst[i].scale },
            { autoAlpha: 1, x: 0, y: 0, rotation: 0, scale: 1, duration: p.duration, ease: p.ease, stagger: { each: p.stagger, from: "edges" } },
            0,
          ),
          end(n, p)
        ),
        exit: (tl, at) =>
          tl.to(
            chars,
            { autoAlpha: 0, x: (i: number) => burst[i].x, y: (i: number) => burst[i].y, rotation: (i: number) => -burst[i].rotation, scale: (i: number) => burst[i].scale, duration: Math.max(0.3, out), ease: EXIT, stagger: { each: 0.008, from: "center" } },
            at,
          ),
      },
      rise: {
        enter: (tl) => (tl.fromTo(chars, { yPercent: 115 }, { yPercent: 0, duration: p.duration, ease: p.ease, stagger: p.stagger }, 0), end(n, p)),
        exit: (tl, at) => fall(tl, at, 1),
      },
      fall: {
        enter: (tl) => (tl.fromTo(chars, { yPercent: 115 }, { yPercent: 0, duration: p.duration, ease: p.ease, stagger: p.stagger }, 0), end(n, p)),
        exit: (tl, at) => fall(tl, at, -1),
      },
      cascade: {
        enter: (tl) => (
          tl.fromTo(
            chars,
            { autoAlpha: 0, y: -18, rotation: () => rnd(-14, 14) },
            { autoAlpha: 1, y: 0, rotation: 0, duration: p.duration, ease: p.ease, stagger: { each: p.stagger, from: "random" } },
            0,
          ),
          end(n, p)
        ),
        exit: (tl, at) => tl.to(chars, { autoAlpha: 0, y: 18, rotation: () => rnd(-14, 14), duration: out, ease: EXIT, stagger: { each: 0.012, from: "random" } }, at),
      },
      flip: {
        enter: (tl) => (
          tl.fromTo(
            chars,
            { autoAlpha: 0, rotationX: -90, transformOrigin: "50% 0%", transformPerspective: 600 },
            { autoAlpha: 1, rotationX: 0, duration: p.duration, ease: p.ease, stagger: p.stagger },
            0,
          ),
          end(n, p)
        ),
        exit: (tl, at) => tl.to(chars, { autoAlpha: 0, rotationX: 90, transformOrigin: "50% 100%", duration: out, ease: EXIT, stagger: 0.012 }, at),
      },
      spring: {
        enter: (tl) => (tl.fromTo(chars, { yPercent: 115, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: p.duration, ease: p.ease, stagger: p.stagger }, 0), end(n, p)),
        exit: (tl, at) => tl.to(chars, { yPercent: -60, autoAlpha: 0, duration: out, ease: EXIT, stagger: 0.012 }, at),
      },
      scatter: {
        enter: (tl) => (
          tl.fromTo(
            chars,
            { autoAlpha: 0, x: () => rnd(-0.3, 0.3) * box.width, y: () => rnd(-0.3, 0.3) * box.height, rotation: () => rnd(-45, 45), scale: 0.6 },
            { autoAlpha: 1, x: 0, y: 0, rotation: 0, scale: 1, duration: p.duration, ease: p.ease, stagger: { each: p.stagger, from: "center" } },
            0,
          ),
          end(n, p)
        ),
        exit: (tl, at) =>
          tl.to(
            chars,
            { autoAlpha: 0, x: () => rnd(-0.3, 0.3) * box.width, y: () => rnd(-0.3, 0.3) * box.height, rotation: () => rnd(-45, 45), scale: 0.6, duration: out, ease: EXIT, stagger: { each: 0.012, from: "edges" } },
            at,
          ),
      },
    };
    return assemble(text, p, splits, acts[p.variation] ?? acts.implode);
  },
  {
    implode: { ease: "power4.out", duration: 0.9, stagger: 0.01 },
    cascade: { ease: "back.out(1.8)", duration: 0.45, stagger: 0.02 },
    flip: { ease: "back.out(1.4)", duration: 0.5 },
    spring: { ease: "elastic.out(1, 0.5)", duration: 1.1 },
    scatter: { ease: "power3.out", stagger: 0.012 },
  },
);

/* ---------- Word slide ---------- */

export const wordSlide = def(["Word slide"], ["slide"], ["duration", "stagger", "hold", "ease"], { duration: 0.5, stagger: 0.05, hold: 2, ease: "signature" }, (text, p) => {
  const splits: SplitText[] = [];
  const words = split(text, { type: "words" }, splits).words as HTMLElement[];
  const side = (i: number) => (i % 2 === 0 ? -1 : 1);
  return assemble(text, p, splits, {
    enter: (tl) => (
      tl.fromTo(words, { autoAlpha: 0, xPercent: (i: number) => side(i) * 40 }, { autoAlpha: 1, xPercent: 0, duration: p.duration, ease: p.ease, stagger: p.stagger }, 0),
      end(words.length, p)
    ),
    exit: (tl, at) => tl.to(words, { autoAlpha: 0, xPercent: (i: number) => -side(i) * 40, duration: Math.max(0.2, p.duration * 0.4), ease: EXIT, stagger: 0.03 }, at),
  });
});

/* ---------- Scramble ---------- */

// From split-entrances' scramble: each character cycles within its kind, capitals as capitals,
// lowercase as lowercase, digits as digits; punctuation stays blank until its turn. Noise is drawn
// from the timeline's time, so every pass and every scrub position shows the same frame.
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SCRAMBLE_RATE = 20;
const noiseIndex = (position: number, tick: number, size: number) => {
  const x = Math.sin(position * 12.9898 + tick * 78.233) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * size);
};
const noiseFor = (char: string, position: number, tick: number) => {
  if (/\s/.test(char)) return char;
  if (/[0-9]/.test(char)) return DIGITS[noiseIndex(position, tick, 10)];
  if (char.toLowerCase() !== char.toUpperCase()) return (char === char.toUpperCase() ? UPPER : LOWER)[noiseIndex(position, tick, 26)];
  return " ";
};
const scrambleFrame = (text: string, shown: number, time: number) => {
  const tick = Math.floor(time * SCRAMBLE_RATE);
  return Array.from(text, (char, i) => (i < shown ? char : noiseFor(char, i, tick))).join("");
};

export const scramble = def(["Scramble"], ["scramble"], ["duration", "stagger", "hold"], { duration: 0.9, stagger: 0.15, hold: 2, ease: "none" }, (text, p) => {
  const splits: SplitText[] = [];
  // Scramble replaces text, so each line becomes its own plain-text element first.
  const lines = split(text, { type: "lines" }, splits).lines as HTMLElement[];
  const copy = lines.map((l) => l.textContent ?? "");
  const hold = 0.15;
  return assemble(text, p, splits, {
    enter: (tl) => {
      lines.forEach((line, i) => {
        const state = { p: 0 };
        const length = Array.from(copy[i]).length;
        tl.fromTo(line, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, i * p.stagger).fromTo(
          state,
          { p: 0 },
          {
            p: 1,
            duration: p.duration,
            ease: "none",
            onUpdate: () => {
              const shown = Math.floor(Math.max(0, (state.p - hold) / (1 - hold)) * length);
              line.textContent = scrambleFrame(copy[i], shown, state.p * p.duration);
            },
          },
          i * p.stagger,
        );
      });
      return end(lines.length, p);
    },
    exit: (tl, at) =>
      lines.forEach((line, i) => {
        const state = { p: 0 };
        const length = Array.from(copy[i]).length;
        tl.fromTo(
          state,
          { p: 0 },
          {
            p: 1,
            duration: 0.45,
            ease: "none",
            immediateRender: false,
            onUpdate: () => (line.textContent = scrambleFrame(copy[i], length - Math.floor(state.p * length), state.p * 0.45)),
          },
          at + i * 0.05,
        ).to(line, { autoAlpha: 0, duration: 0.14, ease: EXIT }, at + i * 0.05 + 0.45);
      }),
  });
});

/* ---------- Speak-in ---------- */

/** Word entrances from the speak-in recipe, as start states; each lands at rest. */
const WORD_INS: gsap.TweenVars[] = [
  { y: 16 },
  { y: -12 },
  { scale: 0.6, transformOrigin: "50% 100%" },
  { filter: "blur(8px)" },
  { x: -14 },
  { rotationX: -80, transformOrigin: "50% 100%", transformPerspective: 600 },
];
const REST: gsap.TweenVars = { x: 0, y: 0, scale: 1, rotationX: 0, filter: "blur(0px)" };

export const speakIn = def(["Speak-in"], ["speak"], ["duration", "hold"], { duration: 0.4, stagger: 0, hold: 2, ease: "power3.out" }, (text, p) => {
  const splits: SplitText[] = [];
  const words = split(text, { type: "words" }, splits).words as HTMLElement[];
  // The last word is the emphasis: it speaks letter by letter and pops.
  const last = words[words.length - 1];
  const letters = split(last, { type: "chars" }, splits).chars as HTMLElement[];
  return assemble(text, p, splits, {
    enter: (tl) => {
      let t = 0;
      words.forEach((word, i) => {
        const len = (word.textContent ?? "").replace(/\W/g, "").length;
        if (word === last) {
          tl.set(word, { autoAlpha: 1 }, 0).fromTo(
            letters,
            { scale: 0, rotation: (j: number) => (j % 2 ? 24 : -24), autoAlpha: 0 },
            { scale: 1, rotation: 0, autoAlpha: 1, duration: p.duration * 1.6, ease: "elastic.out(1, 0.45)", stagger: 0.05 },
            t + 0.1,
          );
          t += 0.1 + letters.length * 0.05 + p.duration * 1.6;
        } else {
          tl.fromTo(word, { ...WORD_INS[i % WORD_INS.length], autoAlpha: 0 }, { ...REST, autoAlpha: 1, duration: p.duration, ease: p.ease }, t);
          // Speaking pace: longer words take longer to say.
          t += 0.06 + 0.008 * len + (word.textContent?.endsWith(".") ? 0.65 : 0) + p.duration * 0.25;
        }
      });
      return t;
    },
    exit: (tl, at) => tl.to(words, { autoAlpha: 0, y: -10, duration: 0.25, ease: EXIT, stagger: 0.02 }, at),
  });
});

/* ---------- Weight wave ---------- */

export const weightWave = def(["Weight wave"], ["wave"], ["duration", "stagger", "hold", "ease"], { duration: 0.7, stagger: 0.03, hold: 1, ease: "power2.inOut" }, (text, p) => {
  const splits: SplitText[] = [];
  const chars = split(text, { type: "words,chars" }, splits).chars as HTMLElement[];
  const rest = Number(getComputedStyle(text).fontWeight) || 400;
  const far = rest >= 600 ? 100 : 900;
  // Each letter keeps its resting width, so the line reads with normal tracking at rest. As it gains
  // weight it narrows by exactly the width the weight adds, so the wave never collides or reflows.
  const restW = chars.map((c) => c.getBoundingClientRect().width);
  pinWidths(chars, far);
  const farW = chars.map((c) => c.getBoundingClientRect().width);
  chars.forEach((c, i) => (c.style.width = `${restW[i]}px`));
  const squeeze = (i: number) => Math.min(1, restW[i] / (farW[i] || 1));
  return assemble(text, p, splits, {
    enter: (tl) => {
      tl.fromTo(
        chars,
        { fontWeight: rest, scaleX: 1 },
        { fontWeight: far, scaleX: (i: number) => squeeze(i), duration: p.duration * 0.43, ease: p.ease, stagger: p.stagger },
        0,
      ).to(chars, { fontWeight: rest, scaleX: 1, duration: p.duration * 0.57, ease: p.ease, stagger: p.stagger }, p.duration * 0.26);
      return p.duration * 0.83 + p.stagger * (chars.length - 1);
    },
  });
});

/* ---------- Letter wave ---------- */

type Move = (chars: HTMLElement[], p: LoopParams, em: number) => gsap.TweenVars;
/** The wave recipe's moves, as the out-and-back half of each. Weight moves go lighter, so letters need no extra room. */
const WAVE_MOVES: Record<string, Move> = {
  hop: (_c, _p, em) => ({ y: -0.12 * em, ease: "power2.out" }),
  breathe: () => ({ scale: 1.07, transformOrigin: "50% 100%" }),
  lean: () => ({ rotation: 7, transformOrigin: "50% 100%" }),
  lighten: () => ({ fontWeight: 100 }),
  shear: () => ({ skewX: 12, ease: "power2.inOut" }),
  squash: () => ({ scaleY: 0.82, transformOrigin: "50% 100%", ease: "power2.inOut" }),
  twist: () => ({ scale: 1.1, rotation: () => rnd(-12, 12), transformOrigin: "50% 50%", ease: "power2.inOut" }),
};
const WAVE_KEYS = Object.keys(WAVE_MOVES);

export const letterWave = def(
  ["All", "Hop", "Breathe", "Lean", "Lighten", "Shear", "Squash", "Twist"],
  ["all", ...WAVE_KEYS],
  ["duration", "stagger", "hold"],
  { duration: 0.25, stagger: 0.03, hold: 1, ease: "sine.inOut" },
  (text, p) => {
    const splits: SplitText[] = [];
    const chars = split(text, { type: "words,chars" }, splits).chars as HTMLElement[];
    pinWidths(chars);
    const em = parseFloat(getComputedStyle(text).fontSize) || 16;
    const keys = p.variation === "all" ? WAVE_KEYS : [p.variation];
    const pass = p.duration + p.stagger * (chars.length - 1);
    return assemble(text, p, splits, {
      enter: (tl) => {
        keys.forEach((key, i) => {
          const at = i * (pass + p.hold);
          const { ease, ...vars } = WAVE_MOVES[key](chars, p, em);
          // Out and back per letter: repeat and yoyo inside the stagger, so each letter turns on its own beat.
          tl.to(chars, { ...vars, duration: p.duration / 2, ease: (ease as string) ?? p.ease, stagger: { each: p.stagger, yoyo: true, repeat: 1 } }, at);
        });
        return keys.length * (pass + p.hold) - p.hold;
      },
    });
  },
);

/* ---------- Route letters ---------- */

// Route letters runs a whole page at once: one call takes every marked item. The stage is a small page:
// a section label and a button slide, the text and picture rise as blocks, and the headline goes by letter.
const PAGE_ART = `<article class="mini-page">
  <span class="lab" data-route="slide">Exhibit · ${String(EXHIBITS.find((e) => e.slug === "route-letters")?.no ?? 0).padStart(2, "0")}</span>
  <h3 class="mp-title" data-route="letters">Route letters</h3>
  <div class="mp-body">
    <p data-route="rise">One call runs the whole page in, and back out on the way to the next one.</p>
    <figure class="mp-pic" data-route="rise"></figure>
  </div>
  <button type="button" class="pill" data-route="slide" tabindex="-1">Next exhibit</button>
</article>`;

export const routeLetters = def(
  ["Letters", "Sides"],
  ["letters", "sides"],
  ["duration", "stagger", "hold", "ease"],
  { duration: 0.75, stagger: 0.02, hold: 2, ease: "power4.out" },
  (text, p) => {
    const { layer, remove } = art(text, PAGE_ART);
    const page = layer.querySelector<HTMLElement>(".mini-page")!;
    const title = page.querySelector<HTMLElement>("[data-route=letters]")!;
    const rise = Array.from(page.querySelectorAll<HTMLElement>("[data-route=rise]"));
    const slide = Array.from(page.querySelectorAll<HTMLElement>("[data-route=slide]"));
    const splits: SplitText[] = [];
    const chars = split(title, { type: "words,chars" }, splits).chars as HTMLElement[];
    const box = page.getBoundingClientRect();
    const sides = p.variation === "sides";
    // As in the recipe: letters spread across the page, or zip in from alternate sides.
    const spread = (i: number) =>
      sides
        ? { x: (i % 2 ? 1 : -1) * box.width * 0.6, y: 0, rotation: 0, scale: 1 }
        : { x: rnd(-0.6, 0.6) * box.width, y: rnd(-0.6, 0.6) * box.height, rotation: rnd(-90, 90), scale: 0.5 };
    const starts = chars.map((_, i) => spread(i));
    const ends = chars.map((_, i) => spread(i));
    const lettersEnd = end(chars.length, p);
    return assemble(
      text,
      p,
      splits,
      {
        enter: (tl) => {
          tl.fromTo(
            chars,
            { autoAlpha: 0, x: (i: number) => starts[i].x, y: (i: number) => starts[i].y, rotation: (i: number) => starts[i].rotation, scale: (i: number) => starts[i].scale },
            { autoAlpha: 1, x: 0, y: 0, rotation: 0, scale: 1, duration: p.duration, ease: p.ease, stagger: { each: p.stagger, from: sides ? "center" : "random" } },
            0,
          )
            // The rest of the page follows as whole blocks, once the headline is mostly in.
            .fromTo(rise, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.42, ease: "power3.out", stagger: 0.09 }, lettersEnd * 0.55)
            .fromTo(slide, { autoAlpha: 0, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.3, ease: "power2.out", stagger: 0.09 }, lettersEnd * 0.55 + 0.09);
          return lettersEnd * 0.55 + 0.6;
        },
        exit: (tl, at) => {
          tl.to([...slide, ...rise], { autoAlpha: 0, y: -8, duration: 0.22, ease: EXIT, stagger: 0.055 }, at).to(
            chars,
            {
              autoAlpha: 0,
              x: (i: number) => ends[i].x,
              y: (i: number) => ends[i].y,
              rotation: (i: number) => ends[i].rotation,
              scale: sides ? 1 : 1.6,
              duration: 0.28,
              ease: "power2.in",
              stagger: { each: 0.012, from: sides ? "center" : "edges" },
            },
            at + 0.1,
          );
        },
      },
      remove,
    );
  },
);

/* ---------- Enter and exit ---------- */

type Pair = { from: gsap.TweenVars; to: gsap.TweenVars; out: gsap.TweenVars };
const PAIRS: Record<string, Pair> = {
  fade: { from: { autoAlpha: 0 }, to: { autoAlpha: 1 }, out: { autoAlpha: 0 } },
  rise: { from: { autoAlpha: 0, y: 8 }, to: { autoAlpha: 1, y: 0 }, out: { autoAlpha: 0, y: -4 } },
  drop: { from: { autoAlpha: 0, y: -8 }, to: { autoAlpha: 1, y: 0 }, out: { autoAlpha: 0, y: 4 } },
  slide: { from: { autoAlpha: 0, x: -16 }, to: { autoAlpha: 1, x: 0 }, out: { autoAlpha: 0, x: -8 } },
  scale: { from: { autoAlpha: 0, scale: 0.96 }, to: { autoAlpha: 1, scale: 1 }, out: { autoAlpha: 0, scale: 0.98 } },
  pop: { from: { autoAlpha: 0, scale: 0.4 }, to: { autoAlpha: 1, scale: 1 }, out: { autoAlpha: 0, scale: 0.6 } },
  wipeUp: { from: { clipPath: "inset(0% 0% 100% 0%)" }, to: { clipPath: "inset(0% 0% 0% 0%)" }, out: { clipPath: "inset(100% 0% 0% 0%)" } },
  wipeAcross: { from: { clipPath: "inset(0% 100% 0% 0%)" }, to: { clipPath: "inset(0% 0% 0% 0%)" }, out: { clipPath: "inset(0% 0% 0% 100%)" } },
  flip: {
    from: { autoAlpha: 0, rotationX: -60, transformPerspective: 800, transformOrigin: "50% 0%" },
    to: { autoAlpha: 1, rotationX: 0 },
    out: { autoAlpha: 0, rotationX: 25 },
  },
  focus: { from: { autoAlpha: 0, filter: "blur(8px)" }, to: { autoAlpha: 1, filter: "blur(0px)" }, out: { autoAlpha: 0, filter: "blur(6px)" } },
  weight: { from: { autoAlpha: 0, fontWeight: 100, y: 4 }, to: { autoAlpha: 1, fontWeight: 400, y: 0 }, out: { autoAlpha: 0, fontWeight: 100 } },
};
const PAIR_KEYS = Object.keys(PAIRS);

export const paired = def(
  ["Fade", "Rise", "Drop", "Slide", "Scale", "Pop", "Wipe up", "Wipe across", "Flip", "Focus", "Weight"],
  PAIR_KEYS,
  ["duration", "stagger", "hold", "ease"],
  { duration: 0.4, stagger: 0.09, hold: 1.5, ease: "power2.out" },
  (text, p) => {
    const splits: SplitText[] = [];
    // The shelf moves whole elements, so each line of the sample is one item.
    const lines = split(text, { type: "lines" }, splits).lines as HTMLElement[];
    const pair = PAIRS[p.variation] ?? PAIRS.fade;
    return assemble(text, p, splits, {
      enter: (tl) => (tl.fromTo(lines, pair.from, { ...pair.to, duration: p.duration, ease: p.ease, stagger: p.stagger }, 0), end(lines.length, p)),
      exit: (tl, at) => tl.to(lines, { ...pair.out, duration: Math.max(0.14, p.duration * 0.5), ease: "power2.in", stagger: p.stagger * 0.5 }, at),
    });
  },
  { pop: { ease: "back.out(2.4)" }, wipeUp: { ease: "power2.out", duration: 0.5 }, wipeAcross: { duration: 0.5 }, flip: { duration: 0.5 }, focus: { duration: 0.5 }, weight: { ease: "power2.inOut", duration: 0.6 } },
);


/* ---------- Typewriter ---------- */

// From the typewriter recipe: the text stays in place at opacity 0 for screen readers and layout, an
// aria-hidden overlay types it behind a caret at a human rhythm. Beats are drawn once at build.
const typeBeats = (text: string, speed: number) =>
  [...text].map((_, i) => {
    const before = text[i - 1] ?? "";
    const base = (1 / speed) * rnd(0.6, 1.4);
    if (/[.,!?;:\n]/.test(before)) return base + 4 / speed;
    if (before === " ") return base + 0.6 / speed;
    return base;
  });
/** Steps a counter one character per beat, writing each frame; reversible, so the loop scrubs. */
function typeSteps(tl: gsap.core.Timeline, at: number, beats: number[], write: (n: number) => void, forward: boolean) {
  const state = { n: forward ? 0 : beats.length };
  let t = at;
  beats.forEach((beat, i) => {
    const target = forward ? i + 1 : beats.length - 1 - i;
    const from = forward ? i : beats.length - i;
    tl.fromTo(state, { n: from }, { n: target, duration: beat, ease: "steps(1)", immediateRender: false, onUpdate: () => write(Math.round(state.n)) }, t);
    t += beat;
  });
  return t;
}
const RETYPE = ["move.", "turn.", "land.", "move."];

export const typewriter = def(
  ["Type", "Retype"],
  ["type", "retype"],
  ["duration", "hold"],
  { duration: 22, stagger: 0, hold: 1.6, ease: "none" },
  (text, p) => {
    const speed = p.duration;
    const caret = document.createElement("span");
    caret.dataset.caret = "";
    caret.setAttribute("aria-hidden", "true");
    if (p.variation === "retype") {
      // The last word cycles; the rest of the line stays put.
      const nodes = Array.from(text.childNodes);
      const tail = nodes[nodes.length - 1] as Text;
      const lead = tail.data.slice(0, tail.data.lastIndexOf(" ") + 1);
      const word = document.createElement("span");
      word.textContent = RETYPE[0];
      word.setAttribute("aria-hidden", "true");
      tail.data = lead;
      text.append(word, caret);
      const write = (s: string) => (n: number) => (word.textContent = s.slice(0, n));
      return assemble(
        text,
        p,
        [],
        {
          enter: (tl) => {
            tl.set(text, { autoAlpha: 1 }, 0).set(caret, { autoAlpha: 1 }, 0);
            let t = p.hold * 0.5;
            RETYPE.slice(1).forEach((next, i) => {
              t = typeSteps(tl, t, typeBeats(RETYPE[i], speed * 2), write(RETYPE[i]), false);
              t = typeSteps(tl, t, typeBeats(next, speed), write(next), true);
              t += i < RETYPE.length - 2 ? p.hold : 0;
            });
            return t;
          },
        },
        () => {
          caret.remove();
          word.remove();
          tail.data = lead + RETYPE[0];
        },
      );
    }
    const source = document.createElement("span");
    source.style.opacity = "0";
    source.append(...Array.from(text.childNodes));
    const layer = document.createElement("span");
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, { position: "absolute", inset: "0", padding: "inherit", boxSizing: "border-box", whiteSpace: "pre-line", pointerEvents: "none" });
    const typed = document.createTextNode("");
    layer.append(typed, caret);
    const position = text.style.position;
    text.style.position = "relative";
    text.append(source, layer);
    const copy = Array.from(source.childNodes).map((n) => (n.nodeName === "BR" ? "\n" : (n.textContent ?? ""))).join("");
    const write = (n: number) => (typed.data = copy.slice(0, n));
    const ins = typeBeats(copy, speed);
    const outs = typeBeats(copy, speed * 2.5);
    return assemble(
      text,
      p,
      [],
      {
        enter: (tl) => {
          tl.set(text, { autoAlpha: 1 }, 0).set(caret, { autoAlpha: 1 }, 0);
          return typeSteps(tl, 0.1, ins, write, true);
        },
        exit: (tl, at) => {
          const done = typeSteps(tl, at, outs, write, false);
          tl.set(caret, { autoAlpha: 0 }, done);
        },
      },
      () => {
        layer.remove();
        source.replaceWith(...Array.from(source.childNodes));
        text.style.position = position;
      },
    );
  },
  { retype: { hold: 1.2, duration: 16 } },
  { duration: { label: "Speed", min: 6, max: 60, step: 1, unit: "/s" } },
);

/* ---------- Glitch ---------- */

// From split-entrances' glitchIn and glitchOut. Jumps are stepped at twelve a
// second. Random offsets are drawn once at build, so every pass and every scrub position is the same frame.
const GLITCH_RATE = 12;
type Cell = [number, number, number, number];
const cellGrid = (rows: number, cols: number): Cell[] =>
  Array.from({ length: rows * cols }, (_, k) => {
    const r = Math.floor(k / cols);
    const c = k % cols;
    return [(r / rows) * 100, 100 - ((c + 1) / cols) * 100, 100 - ((r + 1) / rows) * 100, (c / cols) * 100];
  });
const GLITCH_CELLS: Record<string, Cell[]> = {
  slice: cellGrid(6, 1),
  blocks: cellGrid(3, 4),
  scanline: cellGrid(10, 1),
  ghost: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
};

/** The recipe's layers: the text kept for screen readers at opacity 0, clipped aria-hidden copies over it. */
function glitchLayers(text: HTMLElement, cells: Cell[]) {
  const position = text.style.position;
  if (getComputedStyle(text).position === "static") text.style.position = "relative";
  const source = document.createElement("span");
  source.style.opacity = "0";
  source.append(...Array.from(text.childNodes));
  text.append(source);
  const layers = cells.map(([t, r, b, l]) => {
    const layer = document.createElement("span");
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, { position: "absolute", inset: "0", padding: "inherit", boxSizing: "border-box", pointerEvents: "none", clipPath: `inset(calc(${t}% - 0.5px) calc(${r}% - 0.5px) calc(${b}% - 0.5px) calc(${l}% - 0.5px))` });
    source.childNodes.forEach((node) => layer.append(node.cloneNode(true)));
    text.append(layer);
    return layer;
  });
  return {
    layers,
    restore: () => {
      layers.forEach((layer) => layer.remove());
      source.replaceWith(...Array.from(source.childNodes));
      text.style.position = position;
    },
  };
}

export const glitch = def(
  ["Slice", "Blocks", "Skew", "Ghost", "Weight", "Scanline"],
  ["slice", "blocks", "skew", "ghost", "weight", "scanline"],
  ["duration", "hold"],
  { duration: 0.6, stagger: 0, hold: 1.6, ease: "none" },
  (text, p) => {
    const kind = p.variation;
    const steps = Math.max(2, Math.round(p.duration * GLITCH_RATE));
    const outSteps = Math.max(2, Math.round(p.duration * 0.6 * GLITCH_RATE));
    const shift = parseFloat(getComputedStyle(text).fontSize) * 0.18;
    const at = (i: number) => i / GLITCH_RATE;
    const jump = (scale = 1) => rnd(-shift, shift) * scale;
    const fade = (i: number) => 1 - i / steps;
    const grow = (i: number) => (i + 1) / outSteps;
    const still = { x: 0, y: 0 };

    if (kind === "weight") {
      const splits: SplitText[] = [];
      const chars = split(text, { type: "words,chars" }, splits).chars as HTMLElement[];
      const rest = Number(getComputedStyle(text).fontWeight) || 400;
      pinWidths(chars, 900);
      const weights = (n: number) => Array.from({ length: n }, () => chars.map(() => ({ fontWeight: rnd(100, 900, 100), y: jump(0.3) })));
      const ins = weights(steps);
      const outs = weights(outSteps);
      return assemble(text, p, splits, {
        enter: (tl) => {
          tl.set(chars, { autoAlpha: 1 }, 0);
          ins.forEach((frame, i) => chars.forEach((c, k) => tl.set(c, { fontWeight: frame[k].fontWeight, y: frame[k].y * fade(i) }, at(i))));
          tl.set(chars, { fontWeight: rest, y: 0 }, at(steps));
          return at(steps);
        },
        exit: (tl, at0) => {
          outs.forEach((frame, i) => chars.forEach((c, k) => tl.set(c, { fontWeight: frame[k].fontWeight, y: frame[k].y * grow(i) }, at0 + at(i))));
          tl.set(chars, { autoAlpha: 0 }, at0 + at(outSteps));
        },
      });
    }

    if (kind === "skew") {
      const ins = Array.from({ length: steps }, (_, i) => ({ x: jump(fade(i)), skewX: rnd(-24, 24) * fade(i) }));
      const outs = Array.from({ length: outSteps }, (_, i) => ({ x: jump(grow(i)), skewX: rnd(-24, 24) * grow(i) }));
      return assemble(text, p, [], {
        enter: (tl) => {
          ins.forEach((v, i) => tl.set(text, v, at(i)));
          tl.set(text, { x: 0, skewX: 0 }, at(steps));
          return at(steps);
        },
        exit: (tl, at0) => {
          outs.forEach((v, i) => tl.set(text, v, at0 + at(i)));
          tl.set(text, { x: 0, skewX: 0, autoAlpha: 0 }, at0 + at(outSteps));
        },
      });
    }

    const { layers, restore } = glitchLayers(text, GLITCH_CELLS[kind]);
    const frames = (n: number, scale: (i: number) => number, vertical: number) =>
      Array.from({ length: n }, (_, i) => layers.map(() => (Math.random() < 0.34 ? { x: jump(scale(i)), y: jump(scale(i) * vertical) } : still)));
    const vertical = kind === "blocks" ? 0.4 : 0;
    const ins = frames(steps, fade, vertical);
    const outs = frames(outSteps, grow, vertical);
    const ghostIn = Array.from({ length: steps }, (_, i) => Math.abs(jump(fade(i))) * 1.5);
    const ghostOut = Array.from({ length: outSteps }, (_, i) => Math.abs(jump(grow(i))) * 1.5);
    const lineJumps = layers.map(() => jump());
    return assemble(
      text,
      p,
      [],
      {
        enter: (tl) => {
          tl.set(text, { autoAlpha: 1 }, 0);
          if (kind === "ghost") {
            const [main, ...ghosts] = layers;
            tl.set(main, { autoAlpha: 0 }, 0).set(main, { autoAlpha: 1 }, at(1)).set(ghosts, { autoAlpha: 0.45 }, 0);
            ghostIn.forEach((d, i) => ghosts.forEach((g, k) => tl.set(g, { x: (k ? 1 : -1) * d }, at(i))));
            tl.set(ghosts, { ...still, autoAlpha: 0 }, at(steps));
          } else if (kind === "scanline") {
            const each = steps / layers.length;
            layers.forEach((layer, k) => {
              const turn = Math.floor(k * each);
              tl.set(layer, { autoAlpha: 0, x: 0 }, 0).set(layer, { autoAlpha: 1, x: lineJumps[k] }, at(turn)).set(layer, still, at(turn + 1));
            });
          } else {
            tl.set(layers, { autoAlpha: 1 }, 0);
            ins.forEach((frame, i) => layers.forEach((layer, k) => tl.set(layer, frame[k], at(i))));
            tl.set(layers, still, at(steps));
          }
          return at(steps);
        },
        exit: (tl, at0) => {
          if (kind === "ghost") {
            const ghosts = layers.slice(1);
            tl.set(ghosts, { autoAlpha: 0.45 }, at0);
            ghostOut.forEach((d, i) => ghosts.forEach((g, k) => tl.set(g, { x: (k ? 1 : -1) * d }, at0 + at(i))));
            tl.set(layers, { autoAlpha: 0 }, at0 + at(outSteps));
          } else if (kind === "scanline") {
            const each = outSteps / layers.length;
            layers.forEach((layer, k) => {
              const turn = Math.floor(k * each);
              tl.set(layer, { x: lineJumps[layers.length - 1 - k] }, at0 + at(turn)).set(layer, { autoAlpha: 0 }, at0 + at(turn + 1));
            });
          } else {
            outs.forEach((frame, i) => layers.forEach((layer, k) => tl.set(layer, frame[k], at0 + at(i))));
            tl.set(layers, { autoAlpha: 0 }, at0 + at(outSteps));
          }
        },
      },
      restore,
    );
  },
);

export const TEXT_STAGES: Record<string, StageDef> = {
  "line-mask": lineMask,
  characters,
  "word-slide": wordSlide,
  scramble,
  glitch,
  "type-and-speak": merge([{ def: typewriter, all: true }, { def: speakIn, label: "Speak", key: "speak" }]),
  wave: merge([{ def: weightWave, label: "Weight", key: "weight" }, { def: letterWave, all: true }]),
  "route-letters": routeLetters,
  "enter-and-exit": paired,
};
