// WebGL stages: Shader, Pixels, Flight, Curl, Distort (liquid, lens, ripple). Each draws on the animaxxing-webgl
// skill's one shared canvas (OGL), and GSAP tweens shader uniforms. Images draw as planes; Pixels and Flight
// draw framed views. The DOM stays the page: without WebGL, under reduced motion, or after a lost context,
// each <img> or poster <img> shows as is.
import { gsap } from "../gsap";
import { art, assemble, def, live, merge, play, type LoopParams, type StageDef } from "../stage-core";
import { EXHIBITS } from "../../exhibits";
import { imagePlane, type ImagePlane } from "../recipes/webgl/image-planes";
import { hoverDistortion, ripple, scrollWave } from "../recipes/webgl/uniform-effects";
import { flight, pointerLean, scrollFlight } from "../recipes/webgl/scene-flight";
import { particleMorph, pointerPush, scatterShape, sphereShape, textShape, type PointShape } from "../recipes/webgl/particle-morph";
import { liquidImage } from "../recipes/webgl/liquid-image";
import { drawText, melt, pourStream } from "../recipes/webgl/metaballs";

const TONES: [string, string][] = [
  ["#0b0b0b", "#2130ff"],
  ["#ffffff", "#0b0b0b"],
  ["#1a27d9", "#ffffff"],
  ["#0b0b0b", "#ffffff"],
];
const two = (n: number) => String(n).padStart(2, "0");

/**
 * A poster as a data URI, so WebGL can read it without CORS. Explicit width and height make the
 * browser rasterize the SVG at full size for the texture. Images cannot reach the page font.
 */
export function posterUrl(n: number, i: number, width = 1600) {
  const [bg, fg] = TONES[i % TONES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${(width * 3) / 4}" viewBox="0 0 400 300"><rect width="400" height="300" fill="${bg}"/><g fill="none" stroke="${fg}" stroke-width="2" opacity="0.5"><circle cx="300" cy="140" r="90"/><circle cx="300" cy="140" r="56"/><circle cx="300" cy="140" r="22"/></g><g stroke="${fg}" stroke-width="1" opacity="0.25">${Array.from({ length: 14 }, (_, k) => `<line x1="0" y1="${k * 22}" x2="400" y2="${k * 22}"/>`).join("")}</g><text x="24" y="270" fill="${fg}" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="190" letter-spacing="-8">${two(n)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Builds a plane per image; the planes hold the shared stage while they live. */
const planes = (images: HTMLImageElement[]) => images.map((img) => imagePlane(img));

/* ---------- Shader ---------- */

// One poster plane, five shader moves from the animaxxing-webgl skill, each on its own uniform. Each recipe
// sets its plane up; the loop tweens the same uniforms, so pause, scrub, and the knobs work as on every stage.
type ShaderMove = {
  start: (u: ImagePlane["uniforms"]) => void;
  enter: (tl: gsap.core.Timeline, u: ImagePlane["uniforms"], p: LoopParams) => number;
  exit: (tl: gsap.core.Timeline, u: ImagePlane["uniforms"], p: LoopParams, at: number) => void;
};
const SHADER_MOVES: Record<string, ShaderMove> = {
  wipe: {
    start: (u) => (u.uProgress.value = 0),
    enter: (tl, u, p) => (tl.fromTo(u.uProgress, { value: 0 }, { value: 1, duration: p.duration, ease: p.ease }, 0), p.duration),
    exit: (tl, u, p, at) => tl.to(u.uProgress, { value: 0, duration: p.duration * 0.7, ease: "power2.in" }, at),
  },
  dissolve: {
    start: (u) => (u.uDissolve.value = 0),
    enter: (tl, u, p) => (tl.fromTo(u.uDissolve, { value: 0 }, { value: 1, duration: p.duration, ease: "power2.out" }, 0), p.duration),
    exit: (tl, u, p, at) => tl.to(u.uDissolve, { value: 0, duration: p.duration * 0.6, ease: "power2.in" }, at),
  },
  pixelate: {
    start: (u) => (u.uProgress.value = 0),
    enter: (tl, u, p) => (
      tl.set(u.uProgress, { value: 1 }, 0).fromTo(u.uPixelate, { value: 1 }, { value: 0, duration: p.duration, ease: "steps(8)" }, 0), p.duration
    ),
    exit: (tl, u, p, at) =>
      tl.fromTo(u.uPixelate, { value: 0 }, { value: 1, duration: p.duration * 0.6, ease: "steps(6)", immediateRender: false }, at)
        .set(u.uProgress, { value: 0 }, at + p.duration * 0.6)
        .set(u.uPixelate, { value: 0 }, at + p.duration * 0.6),
  },
  ripple: {
    start: (u) => (u.uProgress.value = 0),
    enter: (tl, u, p) => (
      tl.set(u.uProgress, { value: 1 }, 0).fromTo(u.uRipple, { value: 0 }, { value: 1, duration: p.duration, ease: "power2.out" }, 0).set(u.uRipple, { value: 0 }, p.duration),
      p.duration
    ),
    exit: (tl, u, p, at) =>
      tl.fromTo(u.uRipple, { value: 0 }, { value: 1, duration: p.duration, ease: "power2.out", immediateRender: false }, at)
        .set(u.uProgress, { value: 0 }, at + p.duration * 0.5)
        .set(u.uRipple, { value: 0 }, at + p.duration),
  },
  glitch: {
    start: (u) => (u.uProgress.value = 0),
    enter: (tl, u, p) => (tl.set(u.uProgress, { value: 1 }, 0).fromTo(u.uGlitch, { value: 1 }, { value: 0, duration: p.duration, ease: "power2.in" }, 0), p.duration),
    exit: (tl, u, p, at) =>
      tl.fromTo(u.uGlitch, { value: 0 }, { value: 1, duration: p.duration * 0.6, ease: "power2.out", immediateRender: false }, at)
        .set(u.uProgress, { value: 0 }, at + p.duration * 0.6)
        .set(u.uGlitch, { value: 0 }, at + p.duration * 0.6),
  },
};

const shader = def(
  ["Wipe", "Dissolve", "Pixelate", "Ripple", "Glitch"],
  ["wipe", "dissolve", "pixelate", "ripple", "glitch"],
  ["duration", "hold", "ease"],
  { duration: 1.2, stagger: 0, hold: 1.4, ease: "power2.inOut" },
  (text, p) => {
    const n = EXHIBITS.find((e) => e.slug === "shader")?.no ?? 0;
    const { layer, remove } = art(text, `<figure class="gl-frame"><img alt="A poster that a shader brings in and out" src="${posterUrl(n, 0)}"></figure>`);
    // Until the plane draws, the <img> shows the whole poster: a flash before the move brings it in.
    // The recipe's gate: hide the wrapper, await `ready`, then show it. The plane still prepares while hidden.
    layer.style.visibility = "hidden";
    const [plane] = planes([layer.querySelector("img")!]);
    const move = SHADER_MOVES[p.variation] ?? SHADER_MOVES.wipe;
    const u = plane.uniforms;
    const saved = { uProgress: u.uProgress.value, uDissolve: u.uDissolve.value, uPixelate: u.uPixelate.value, uRipple: u.uRipple.value, uGlitch: u.uGlitch.value };
    move.start(u);
    // Without WebGL, ready settles false at once and the plain poster shows. A slow device waits two seconds at most.
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const ready = Promise.race([plane.ready, new Promise((resolve) => (deadline = setTimeout(resolve, 2000)))]).then(() => {
      clearTimeout(deadline);
      layer.style.removeProperty("visibility");
    });
    const loop = assemble(
      text,
      p,
      [],
      { enter: (tl) => move.enter(tl, u, p), exit: (tl, at) => move.exit(tl, u, p, at) },
      () => {
        clearTimeout(deadline);
        gsap.killTweensOf(Object.values(u));
        Object.entries(saved).forEach(([k, v]) => ((u as unknown as Record<string, { value: number }>)[k].value = v));
        plane.revert();
        remove();
      },
    );
    return { ...loop, ready };
  },
  { dissolve: { duration: 1.1 }, pixelate: { duration: 1 }, ripple: { duration: 1.4 }, glitch: { duration: 0.6 } },
);

/* ---------- Pixels ---------- */

// Points gather into a shape, rest, and blow back apart: a word in the page's own face, the exhibit's
// number, a sphere. One uniform, uShape, carries it; each point leaves on its own delay. The pointer parts
// the points. A poster per tab shows the gathered shape whenever WebGL cannot draw.
const PIXEL_SHAPES: Record<string, (text: HTMLElement, n: number) => PointShape> = {
  word: (text) => textShape("MOTION", { font: `800 200px ${getComputedStyle(text).fontFamily}` }),
  number: (text, n) => textShape(two(n), { font: `800 320px ${getComputedStyle(text).fontFamily}` }),
  sphere: () => sphereShape(5000, 0.95),
};
const pixels = def(
  ["Word", "Number", "Sphere"],
  ["word", "number", "sphere"],
  ["duration", "hold"],
  { duration: 2, stagger: 0, hold: 1.6, ease: "power2.inOut" },
  (text, p) => {
    const n = EXHIBITS.find((e) => e.slug === "pixels")?.no ?? 0;
    const { layer, remove } = art(
      text,
      `<figure class="gl-view gl-pixels"><img data-poster alt="" src="/exhibits/pixels-${p.variation}.jpg"></figure>`,
    );
    const host = layer.querySelector<HTMLElement>(".gl-pixels")!;
    // The gathered shape is the poster; hide it until the points are ready, so the loop starts scattered.
    layer.style.visibility = "hidden";
    const shape = (PIXEL_SHAPES[p.variation] ?? PIXEL_SHAPES.word)(text, n);
    const m = particleMorph(host, { shapes: [scatterShape(4000, 1.1), shape], size: 2, fill: 0.86 });
    const push = pointerPush(m, { touch: true });
    const u = m.uniforms;
    const spin = p.variation === "sphere";
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const ready = Promise.race([m.view.ready, new Promise((resolve) => (deadline = setTimeout(resolve, 2000)))]).then(() => {
      clearTimeout(deadline);
      layer.style.removeProperty("visibility");
    });
    const loop = assemble(
      text,
      p,
      [],
      {
        enter: (tl) => {
          tl.fromTo(u.uShape, { value: 0 }, { value: 1, duration: p.duration, ease: p.ease }, 0);
          if (spin) tl.fromTo(u.uSpin, { value: -1.2 }, { value: 0, duration: p.duration, ease: "power2.out" }, 0);
          return p.duration;
        },
        exit: (tl, at) => {
          tl.to(u.uShape, { value: 0, duration: p.duration * 0.6, ease: "power2.in" }, at);
          if (spin) tl.to(u.uSpin, { value: 1.2, duration: p.duration * 0.6, ease: "power2.in" }, at);
        },
      },
      () => {
        clearTimeout(deadline);
        push();
        m.revert();
        remove();
      },
    );
    return { ...loop, ready };
  },
  { number: { duration: 1.8 }, sphere: { duration: 2.4 } },
);

/* ---------- Melt ---------- */

// Liquid metal: one bead swells, drops run out to their places, and they merge into the word. The button
// lets it drip apart and pours it back. The live heading is the poster: without WebGL it simply shows.
const meltStage = play(["Word", "Number"], ["word", "number"], "Press the button to let it drip, and again to pour it back.", (text, p) =>
  live(
    text,
    `<div class="melt-stage"><div class="gl-view gl-melt"><h3 class="melt-word">${p.variation === "number" ? two(EXHIBITS.find((e) => e.slug === "melt")?.no ?? 0) : "MOTION"}</h3></div><button type="button" class="pill melt-toggle" aria-pressed="false">Let it drip</button></div>`,
    (layer) => {
      const host = layer.querySelector<HTMLElement>(".gl-melt")!;
      const word = host.querySelector<HTMLElement>(".melt-word")!;
      const font = `800 ${p.variation === "number" ? 320 : 220}px ${getComputedStyle(word).fontFamily}`;
      const metal = melt(host, { draw: drawText(word.textContent ?? "", font), poster: word, drops: p.variation === "number" ? 10 : 16 });
      const button = layer.querySelector<HTMLButtonElement>(".melt-toggle")!;
      let cancelled = false;
      metal.view.ready.then((drawn) => {
        if (drawn && !cancelled) metal.form();
      });
      const toggle = () => {
        const dripping = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", String(dripping));
        button.textContent = dripping ? "Pour it back" : "Let it drip";
        if (dripping) metal.drip();
        else metal.form();
      };
      button.addEventListener("click", toggle);
      return [
        () => {
          cancelled = true;
          button.removeEventListener("click", toggle);
        },
        () => metal.revert(),
      ];
    },
  ),
);

/* ---------- Pour ---------- */

// A stream of liquid metal runs down beside an index as the page scrolls, its head following the reader,
// and a drop settles beside each row it reaches. The stage scrolls the page itself, as Flight does.
const POUR_ROWS = ["Mask", "Stagger", "Explode", "Slide", "Scramble", "Glitch", "Speak", "Wave", "Pulse", "Count", "In and Out", "Cycle"];
const pourStage = play(["Pour"], ["pour"], "Scroll the page down the index, and back up.", (text) =>
  live(
    text,
    `<div class="pour-index"><div class="pour-gutter" aria-hidden="true"></div><ol class="pour-rows">${POUR_ROWS.map((name, i) => `<li><span>${two(i + 1)}</span>${name}</li>`).join("")}</ol></div>`,
    (layer) => {
      const stream = pourStream(layer.querySelector<HTMLElement>(".pour-gutter")!, { rows: Array.from(layer.querySelectorAll<HTMLElement>(".pour-rows li")), width: 7 });
      return [() => stream.revert()];
    },
    "flow",
  ),
);

/* ---------- Flight ---------- */

/**
 * A camera flies down a spiral of posters as the page scrolls. Like the scroll wave, the stage scrolls the
 * page itself: a tall track holds the view in place with `position: sticky` while the scroll drives the flight.
 */
const FLIGHT_POSTERS = Array.from({ length: 12 }, (_, i) => i + 1);
const flightStage = play(["Flight"], ["flight"], "Scroll the page to fly through the posters. Move the mouse to lean.", (text) =>
  live(
    text,
    `<div class="gl-flight-track"><figure class="gl-view gl-flight"><img data-poster alt="Twelve posters receding down a spiral" src="/exhibits/flight.jpg"></figure></div>`,
    (layer) => {
      const ride = flight(layer.querySelector<HTMLElement>(".gl-flight")!, { images: FLIGHT_POSTERS.map((n, i) => posterUrl(n, i, 800)), fog: 24 });
      return [
        () => ride.revert(),
        scrollFlight(ride, { trigger: layer.querySelector(".gl-flight-track")!, start: "top top", end: "bottom bottom", scrub: 1 }),
        pointerLean(ride),
      ];
    },
    "flow",
  ),
);

/* ---------- Curl ---------- */

/**
 * The canvas is fixed to the viewport, so a plane inside a scrolling box would draw past the box's edges.
 * This stage scrolls the page itself: a tall column of posters that bend with the page's scroll speed.
 */
const scrollWaveStage = play(["Curl"], ["curl"], "Scroll the page past the posters, fast and slow.", (text) =>
  live(
    text,
    `<div class="gl-column">${[37, 38, 39, 40].map((n, i) => `<figure class="gl-frame"><img alt="Poster ${n}" src="${posterUrl(n, i)}"></figure>`).join("")}</div>`,
    (layer) => {
      const ps = planes(Array.from(layer.querySelectorAll("img")));
      const waves = ps.map((pl) => scrollWave(pl, { strength: 0.03, max: 60 }));
      return [...ps.map((pl) => () => pl.revert()), ...waves];
    },
    "flow",
  ),
);

/* ---------- Hover lens ---------- */

const hoverLens = play(["Hover lens"], ["lens"], "Move the mouse or a held finger over a poster. Tab to one to center the lens.", (text) =>
  live(
    text,
    `<div class="gl-row">${[59, 60, 61].map((n, i) => `<button type="button" class="gl-card" aria-label="Poster ${n}"><img alt="" src="${posterUrl(n, i)}"></button>`).join("")}</div>`,
    (layer) => {
      const ps: ImagePlane[] = planes(Array.from(layer.querySelectorAll("img")));
      // The button takes hover and focus; the recipe finds it from the image.
      const lenses = ps.map((pl) => hoverDistortion(pl, { strength: 1, touch: true }));
      return [...ps.map((pl) => () => pl.revert()), ...lenses, () => gsap.killTweensOf(ps.map((pl) => pl.uniforms.uHover))];
    },
  ),
);

/* ---------- Liquid ---------- */

// The poster is water: the pointer, or a held finger, drags a trail through it that bends the picture and
// fades back to rest. On arrival one stroke pours across it. The <img> is the content and the fallback.
const LIQUID_NO = () => EXHIBITS.find((e) => e.slug === "distort")?.no ?? 0;
const liquid = play(["Liquid"], ["liquid"], "Drag the mouse or a held finger across the poster.", (text) =>
  live(
    text,
    `<figure class="gl-frame gl-liquid"><img alt="Poster ${two(LIQUID_NO())}, its surface stirred like water" src="${posterUrl(LIQUID_NO(), 2)}"></figure>`,
    (layer) => {
      const water = liquidImage(layer.querySelector("img")!, { touch: true });
      // A touch stronger than the recipe's default: the poster's thin lines need a firmer bend to read.
      water.uniforms.uStrength.value = 0.12;
      let cancelled = false;
      water.view.ready.then((drawn) => {
        if (drawn && !cancelled) water.pour({ duration: 1.6 });
      });
      return [
        () => {
          cancelled = true;
          water.revert();
        },
      ];
    },
  ),
);

/* ---------- Ripple ---------- */

// A press sends one ring out across the poster from its center. A button, so a tap, a click, and Enter all work.
const rippleStage = play(["Ripple"], ["ripple"], "Click, tap, or press Enter on the poster.", (text) =>
  live(
    text,
    `<button type="button" class="gl-frame gl-card gl-ripple" aria-label="Poster ${two(LIQUID_NO())}: send a ripple"><img alt="" src="${posterUrl(LIQUID_NO(), 0)}"></button>`,
    (layer) => {
      const button = layer.querySelector<HTMLButtonElement>(".gl-ripple")!;
      const [plane] = planes([button.querySelector("img")!]);
      const ring = ripple(plane, { duration: 1.4, hidden: false });
      const send = () => ring.burst();
      button.addEventListener("click", send);
      return [() => plane.revert(), ring.revert, () => button.removeEventListener("click", send)];
    },
  ),
);

// Distort: one exhibit, one tab per way the image bends.
const distort = merge([
  { label: "Liquid", key: "liquid", def: liquid },
  { label: "Lens", key: "lens", def: hoverLens },
  { label: "Ripple", key: "ripple", def: rippleStage },
]);

export const WEBGL_STAGES: Record<string, StageDef> = {
  shader,
  pixels,
  flight: flightStage,
  melt: meltStage,
  pour: pourStage,
  distort,
  "curl": scrollWaveStage,
};
