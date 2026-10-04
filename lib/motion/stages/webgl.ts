// WebGL stages: 20 Shader wipe, 37 Scroll wave, 59 Hover lens. Each draws real <img> posters as planes on
// the animaxxing-webgl skill's one shared canvas (OGL), and GSAP tweens the planes' uniforms. The <img>
// stays the page: without WebGL, under reduced motion, or after a lost context, the poster shows as is.
import { gsap } from "../gsap";
import { art, assemble, def, live, play, type StageDef } from "../stage-core";
import { imagePlane, type ImagePlane } from "../recipes/webgl/image-planes";
import { hoverDistortion, scrollWave, wipe } from "../recipes/webgl/uniform-effects";

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
export function posterUrl(n: number, i: number) {
  const [bg, fg] = TONES[i % TONES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 400 300"><rect width="400" height="300" fill="${bg}"/><g fill="none" stroke="${fg}" stroke-width="2" opacity="0.5"><circle cx="300" cy="140" r="90"/><circle cx="300" cy="140" r="56"/><circle cx="300" cy="140" r="22"/></g><g stroke="${fg}" stroke-width="1" opacity="0.25">${Array.from({ length: 14 }, (_, k) => `<line x1="0" y1="${k * 22}" x2="400" y2="${k * 22}"/>`).join("")}</g><text x="24" y="270" fill="${fg}" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="190" letter-spacing="-8">${two(n)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Builds a plane per image; the planes hold the shared stage while they live. */
const planes = (images: HTMLImageElement[]) => images.map((img) => imagePlane(img));

/* ---------- 20 Shader wipe ---------- */

const shaderWipe = def(
  ["Shader wipe"],
  ["wipe"],
  ["duration", "hold", "ease"],
  { duration: 1.2, stagger: 0, hold: 1.4, ease: "power2.inOut" },
  (text, p) => {
    const { layer, remove } = art(text, `<figure class="gl-frame"><img alt="Poster 20, wiped in and out by a shader" src="${posterUrl(20, 0)}"></figure>`);
    const [plane] = planes([layer.querySelector("img")!]);
    // The recipe sets the plane hidden and owns the uniform; the loop tweens the same uniform so it scrubs.
    const w = wipe(plane, { hidden: true });
    const { uProgress } = plane.uniforms;
    return assemble(
      text,
      p,
      [],
      {
        enter: (tl) => (tl.fromTo(uProgress, { value: 0 }, { value: 1, duration: p.duration, ease: p.ease }, 0), p.duration),
        exit: (tl, at) => tl.to(uProgress, { value: 0, duration: p.duration * 0.7, ease: "power2.in" }, at),
      },
      () => {
        w.revert();
        plane.revert();
        remove();
      },
    );
  },
);

/* ---------- 37 Scroll wave ---------- */

/**
 * The canvas is fixed to the viewport, so a plane inside a scrolling box would draw past the box's edges.
 * This stage scrolls the page itself: a tall column of posters that bend with the page's scroll speed.
 */
const scrollWaveStage = play(["Scroll wave"], ["wave"], "Scroll the page past the posters, fast and slow.", (text) =>
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

/* ---------- 59 Hover lens ---------- */

const hoverLens = play(["Hover lens"], ["lens"], "Move the mouse over a poster. Tab to one to center the lens.", (text) =>
  live(
    text,
    `<div class="gl-row">${[59, 60, 61].map((n, i) => `<button type="button" class="gl-card" aria-label="Poster ${n}"><img alt="" src="${posterUrl(n, i)}"></button>`).join("")}</div>`,
    (layer) => {
      const ps: ImagePlane[] = planes(Array.from(layer.querySelectorAll("img")));
      // The button takes hover and focus; the recipe finds it from the image.
      const lenses = ps.map((pl) => hoverDistortion(pl, { strength: 1 }));
      return [...ps.map((pl) => () => pl.revert()), ...lenses, () => gsap.killTweensOf(ps.map((pl) => pl.uniforms.uHover))];
    },
  ),
);

export const WEBGL_STAGES: Record<string, StageDef> = {
  "shader-wipe": shaderWipe,
  "scroll-wave": scrollWaveStage,
  "hover-lens": hoverLens,
};
