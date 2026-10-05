// Stages for the Scroll exhibits. Each stage holds a small scrolling window, a page within the
// page, and the animaxxing recipe runs against it with `scroller` set to that window. Nothing loops:
// scrolling is the control. Recipes are copied unchanged into lib/motion/recipes, apart from the
// section pager's `embedded` option, marked where it is defined.
import { ScrollTrigger } from "../gsap";
import { live, play, type Play, type StageDef } from "../stage-core";
import {
  horizontalRun,
  navTheme,
  parallax,
  pinnedScene,
  revealOnScroll,
  runDrift,
  scrollDirection,
  scrollProgress,
  scrollWaypoints,
  scrubStatement,
  stackCards,
  velocitySkew,
  zoomThrough,
} from "../recipes/scroll-effects";
import { frameSequence, scrubVideo } from "../recipes/media-effects";
import { morphScrub, pathLoop, pathScrub } from "../recipes/svg-effects";
import { sectionPager } from "../recipes/section-pager";
import { lenisScroll } from "../recipes/smooth/lenis-scroll";

const SCROLL_HINT = "Scroll inside the window.";
const one = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;
const all = (root: ParentNode, sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
const two = (n: number) => String(n).padStart(2, "0");

const TONES: [string, string][] = [
  ["#0b0b0b", "#2130ff"],
  ["#ffffff", "#0b0b0b"],
  ["#1a27d9", "#ffffff"],
  ["#0b0b0b", "#ffffff"],
  ["#ffffff", "#2130ff"],
];
function poster(n: number, i: number) {
  const [bg, fg] = TONES[i % TONES.length];
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"><rect width="400" height="300" fill="${bg}"/><g fill="none" stroke="${fg}" stroke-width="2" opacity="0.45"><circle cx="300" cy="140" r="90"/><circle cx="300" cy="140" r="56"/></g><text x="24" y="270" fill="${fg}" font-family="var(--font-archivo), Arial, sans-serif" font-weight="800" font-size="190" font-stretch="75%" letter-spacing="-6">${two(n)}</text></svg>`;
}

const CUE = `<section class="w-pad"><p class="lab">Scroll ↓</p></section>`;
const END = `<section class="w-pad"><p class="lab">End</p></section>`;

/**
 * A scrolling window filling the stage. `wire` gets the window and returns teardowns. Triggers are
 * measured once the window has its size, and again after fonts load.
 */
function windowed(text: HTMLElement, inner: string, wire: (win: HTMLElement, layer: HTMLElement) => Array<() => void>, className = ""): Play {
  return live(
    text,
    `<div class="win ${className}" tabindex="0" role="region" aria-label="A scrolling sample page">${inner}</div>`,
    (layer) => {
      const win = one(layer, ".win");
      const offs = wire(win, layer);
      const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
      let alive = true;
      document.fonts?.ready.then(() => alive && ScrollTrigger.refresh());
      return [
        () => {
          alive = false;
          cancelAnimationFrame(frame);
        },
        ...offs,
      ];
    },
    "scroll",
  );
}

/* ---------- Scroll reveal ---------- */

const reveal = play(["Rise", "Plop"], ["rise", "plop"], SCROLL_HINT, (text, p) =>
  windowed(text, `${CUE}<div class="w-grid">${Array.from({ length: 12 }, (_, i) => `<div class="w-card">${poster(22 + i, i)}</div>`).join("")}</div>${END}`, (win) => [
    revealOnScroll(
      all(win, ".w-card"),
      p.variation === "plop"
        ? { scroller: win, start: "top 92%", y: -32, scale: 0, rotation: -20, duration: 0.7, stagger: 0.12, ease: "elastic.out(1, 0.72)", repeat: true }
        : { scroller: win, start: "top 92%", ease: "signature", repeat: true },
    ),
  ]),
);

/* ---------- Scrubbed statement ---------- */

const statement = play(["Words", "Chars"], ["words", "chars"], SCROLL_HINT, (text, p) =>
  windowed(
    text,
    `${CUE}<section class="w-statement"><p>Every way a page can move, from the first frame to the last, read at the speed you scroll.</p></section>${END}`,
    (win) => [scrubStatement(one(win, ".w-statement p"), { by: p.variation as "words", scroller: win })],
  ),
);

/* ---------- Parallax ---------- */

// Depth: seven planes at seven speeds. The letters of the word travel opposite ways and only line up
// as the scene crosses the middle of the window, where every layer's travel passes through zero.
const DEPTH_LETTERS: Array<[string, number]> = [["D", 150], ["e", -90], ["p", 60], ["t", -140], ["h", 110]];
const DEPTH = `<section class="w-depth">
  <svg class="d-rings" data-parallax="-220" viewBox="0 0 400 400" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="1.5" opacity="0.28"><circle cx="200" cy="200" r="190"/><circle cx="200" cy="200" r="140"/><circle cx="200" cy="200" r="90"/><circle cx="200" cy="200" r="40"/></g></svg>
  <b class="d-num" data-parallax="-130">27</b>
  <div class="d-plate" data-parallax="-50">${poster(27, 0)}</div>
  <h3 class="d-word">${DEPTH_LETTERS.map(([c, t]) => `<span data-parallax="${t}">${c}</span>`).join("")}</h3>
  <span class="d-tag lab d-tag-a" data-parallax="240">Far · slow</span>
  <span class="d-tag lab d-tag-b" data-parallax="300">Near · fast</span>
  <i class="d-dot d-dot-a" data-parallax="320"></i><i class="d-dot d-dot-b" data-parallax="-260"></i><i class="d-dot d-dot-c" data-parallax="200"></i>
</section>`;

// Windows: each frame holds still while the picture inside slides past it, taller than its frame.
const WINDOWS = `<section class="w-windows">${[0, 1, 2]
  .map((i) => `<figure class="w-window"><div class="w-frame"><div class="w-window-in" data-parallax="${[-70, 90, -110][i]}">${poster(25 + i, i + 1)}</div></div><figcaption class="lab" data-parallax="${[24, -24, 32][i]}">Window ${i + 1}</figcaption></figure>`)
  .join("")}</section>`;

const parallaxStage = play(["Depth", "Windows"], ["depth", "windows"], SCROLL_HINT, (text, p) =>
  windowed(text, `${CUE}${p.variation === "windows" ? WINDOWS : DEPTH}${END}`, (win) =>
    all(win, ".w-depth, .w-windows").map((sec) => parallax(sec, { scroller: win })),
  ),
);

/* ---------- Pinned scene ---------- */

const pinned = play(["Pinned scene"], ["pinned"], SCROLL_HINT, (text) =>
  windowed(
    text,
    `${CUE}<section class="w-scene">${["Pin", "Scrub", "Release"].map((s, i) => `<div class="w-step"><span class="lab">Step ${i + 1}</span><b>${s}</b></div>`).join("")}</section>${END}`,
    (win) => [
      pinnedScene(
        one(win, ".w-scene"),
        (tl, section) => {
          const [a, b, c] = all(section, ".w-step");
          // Each step hands over to the next while the section holds still.
          tl.fromTo(b, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0 })
            .to(a, { autoAlpha: 0, y: -60 }, "<")
            .fromTo(c, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0 })
            .to(b, { autoAlpha: 0, y: -60 }, "<");
        },
        { length: 2, scroller: win },
      ),
    ],
  ),
);

/* ---------- Horizontal run ---------- */

const run = play(["Run", "Drift"], ["run", "drift"], SCROLL_HINT, (text, p) =>
  windowed(
    text,
    `${CUE}<section class="w-run"><div class="w-track">${Array.from({ length: 7 }, (_, i) => `<article class="w-runcard"><div data-run-drift="48">${poster(26 + i, i)}</div></article>`).join("")}</div></section>${END}`,
    (win) => {
      const r = horizontalRun(one(win, ".w-run"), one(win, ".w-track"), { scroller: win });
      const offs = [r.revert];
      if (p.variation === "drift") offs.unshift(runDrift(one(win, ".w-track"), r));
      return offs;
    },
  ),
);

/* ---------- Waypoints ---------- */

const waypoints = play(["Waypoints"], ["waypoints"], SCROLL_HINT, (text) =>
  windowed(
    text,
    `<section class="w-way"><div class="w-traveller" data-traveller>${poster(27, 0)}</div><h3>Plan</h3></section>
     <section class="w-way"><div data-waypoint class="w-dock right"></div><h3>Share</h3></section>
     <section class="w-way"><div data-waypoint class="w-dock left"></div><h3>Ship</h3></section>${END}`,
    (win) => [scrollWaypoints(one(win, "[data-traveller]"), all(win, "[data-waypoint]"), { scroller: win })],
  ),
);

/* ---------- Progress ---------- */

const PARAS = [
  "A hairline at the top reports how far through the page you are.",
  "It runs under reduced motion too, unsmoothed, because it is information, not decoration.",
  "It scales from the left edge, a transform only, so it never moves the layout.",
  "Keep reading, or keep scrolling. The line keeps count.",
];
const progress = play(["Progress"], ["progress"], SCROLL_HINT, (text) =>
  windowed(text, `<div class="w-bar"><i></i></div><article class="w-article">${[...PARAS, ...PARAS, ...PARAS].map((t) => `<p>${t}</p>`).join("")}</article>`, (win) => [
    scrollProgress(one(win, ".w-bar i"), { scroller: win }),
  ]),
);

/* ---------- Velocity skew ---------- */

const skew = play(["Velocity skew"], ["skew"], "Scroll inside the window, fast and slow.", (text) =>
  windowed(text, `${CUE}<div class="w-cols">${Array.from({ length: 10 }, (_, i) => `<div class="w-skew">${poster(29 + i, i)}</div>`).join("")}</div>${END}`, (win) => [
    velocitySkew(all(win, ".w-skew"), { scroller: win }),
  ]),
);

/* ---------- Header theme, 31 Hide on scroll ---------- */

const HEAD = `<header class="w-head"><b>Museum of Motion</b><span class="lab">Collection · About</span></header>`;
const BANDS = (n: number) =>
  Array.from({ length: n }, (_, i) => `<section class="w-band ${i % 2 ? "dark" : "light"}" data-nav-theme="${i % 2 ? "dark" : "light"}"><h3>${i % 2 ? "Dark section" : "Light section"}</h3></section>`).join("");

const headerTheme = play(["Header theme"], ["theme"], SCROLL_HINT, (text) =>
  windowed(text, `${HEAD}${BANDS(6)}`, (win) => [navTheme(one(win, ".w-head"), { scroller: win })], "themed"),
);

const hideOnScroll = play(["Hide on scroll"], ["hide"], "Scroll down to hide the header, up to bring it back.", (text) =>
  windowed(text, `${HEAD}${BANDS(8)}`, (win) => [scrollDirection(win, { scroller: win })], "hiding"),
);

/* ---------- Smooth scroll ---------- */

const NAMES = ["Line mask", "Characters", "Word slide", "Scramble", "Speak-in", "Weight wave", "Letter wave", "Route letters", "Entrances and exits", "Reveal", "Line draw", "Path follow", "Count-up", "Marquee"];

const smooth = play(["Lenis", "Native"], ["lenis", "native"], "Wheel inside the window. Switch tabs to feel the difference.", (text, p) =>
  windowed(text, `<div class="w-content">${NAMES.map((n, i) => `<p class="w-name"><span class="num">${two(i + 1)}</span> ${n}</p>`).join("")}</div>`, (win) => {
    if (p.variation !== "lenis") return [];
    // Lenis on the window element instead of the page, stepped by GSAP's ticker as the recipe does.
    const s = lenisScroll({ wrapper: win, content: one(win, ".w-content"), lerp: 0.08 });
    return [s.destroy];
  }),
);

/* ---------- Section pager ---------- */

const pager = play(["Section pager"], ["pager"], "Wheel, swipe, or use the arrow keys inside the box.", (text) =>
  live(
    text,
    `<div class="w-pagerbox"><div class="w-pager" tabindex="0" aria-label="Sample chapters">${["One", "Two", "Three", "Four"].map((t, i) => `<section class="w-chapter c${i}"><span class="lab">Chapter ${i + 1}</span><b>${t}</b></section>`).join("")}</div>
     <div class="w-pagerbtns"><button type="button" class="pill" data-prev>Previous</button><button type="button" class="pill" data-next>Next</button></div></div>`,
    (layer) => {
      const pg = sectionPager(one(layer, ".w-pager"), { embedded: true });
      const prev = () => pg.previous();
      const next = () => pg.next();
      one(layer, "[data-prev]").addEventListener("click", prev);
      one(layer, "[data-next]").addEventListener("click", next);
      return [
        () => {
          one(layer, "[data-prev]").removeEventListener("click", prev);
          one(layer, "[data-next]").removeEventListener("click", next);
        },
        pg.revert,
      ];
    },
  ),
);

/* ---------- Scrubbed video, 35 Frame sequence ---------- */

/** Sticky media fills the window's height while its section scrolls three windows' worth. */
const holdHeight = (win: HTMLElement, media: HTMLElement) => (media.style.height = `${win.clientHeight}px`);

const video = play(["Scrubbed video"], ["video"], SCROLL_HINT, (text) =>
  windowed(
    text,
    `<section class="w-tall"><video class="w-sticky" muted playsinline preload="auto" src="/media/scrub.mp4" aria-label="A counter and a square, scrubbed by scroll"></video></section>${END}`,
    (win) => {
      const v = one<HTMLVideoElement>(win, "video");
      holdHeight(win, v);
      return [scrubVideo(v, { section: one<HTMLElement>(win, ".w-tall"), scroller: win })];
    },
  ),
);

/** Frames drawn as images: a ring turns while a numeral counts, one frame per step. */
const FRAME_COUNT = 48;
const frame = (i: number) => {
  const t = i / (FRAME_COUNT - 1);
  const a = t * 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"><rect width="800" height="450" fill="#0b0b0b"/><g transform="rotate(${a} 560 225)" fill="none" stroke="#2130ff" stroke-width="18"><path d="M560 85 A140 140 0 1 1 420 225"/></g><circle cx="${560 + 140 * Math.cos(((a - 90) * Math.PI) / 180)}" cy="${225 + 140 * Math.sin(((a - 90) * Math.PI) / 180)}" r="16" fill="#fff"/><text x="60" y="330" fill="#fff" font-family="Arial, sans-serif" font-weight="700" font-size="200">${two(Math.round(t * 99))}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const frames = play(["Frame sequence"], ["frames"], SCROLL_HINT, (text) =>
  windowed(text, `<section class="w-tall"><canvas class="w-sticky" role="img" aria-label="A ring turns and a number counts as you scroll"></canvas></section>${END}`, (win) => {
    const c = one<HTMLCanvasElement>(win, "canvas");
    holdHeight(win, c);
    return [frameSequence(c, Array.from({ length: FRAME_COUNT }, (_, i) => frame(i)), { section: one<HTMLElement>(win, ".w-tall"), scroller: win, fit: "contain" })];
  }),
);

/* ---------- Shape scrub ---------- */

const shape = play(["Shape scrub"], ["shape"], SCROLL_HINT, (text) =>
  windowed(
    text,
    `${CUE}<section class="w-bowl"><svg class="w-edge" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path d="M0 10 C30 0 70 0 100 10 Z"/></svg><h3>The edge flattens as this arrives.</h3></section><section class="w-pad dark"></section>`,
    (win) => [morphScrub(one<SVGPathElement>(win, ".w-edge path"), "M0 10 C30 10 70 10 100 10 Z", { trigger: one<HTMLElement>(win, ".w-bowl"), scroller: win })],
  ),
);

/* ---------- Stacking cards ---------- */

const stacking = play(["Stacking cards"], ["stack"], SCROLL_HINT, (text) =>
  windowed(
    text,
    `${CUE}<section class="w-deck">${[0, 1, 2, 3].map((k) => `<article class="w-deckcard" data-stack-card>${poster(k + 1, k)}<b>Card ${k + 1}</b></article>`).join("")}</section>${END}`,
    (win) => [stackCards(all(win, "[data-stack-card]"), { top: 20, offset: 14, scroller: win })],
  ),
);

/* ---------- Zoom-through ---------- */

/**
 * A blue plate with the word cut out of it, so the poster behind shows through the letters. The mask's
 * text is never painted, so a transparent copy on top gives the m a box to measure: its center sits in
 * the m's middle stem, a hole in the plate, so the zoom flies through the stem into the poster.
 */
const WORD = `font-family="var(--font-archivo), Arial, sans-serif" font-weight="800" font-stretch="75%" font-size="220" letter-spacing="-4" text-anchor="middle" x="500" y="275"`;
const PLATE = `<svg class="w-zoomplate" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice" aria-label="move."><defs><mask id="zoom-cut"><rect width="1000" height="400" fill="#fff"/><text ${WORD} fill="#000">move.</text></mask></defs><rect width="1000" height="400" fill="#2130ff" mask="url(#zoom-cut)"/><text ${WORD} fill="transparent"><tspan data-zoom-focus>m</tspan>ove.</text></svg>`;

const zoom = play(["Scale", "Clip"], ["scale", "clip"], SCROLL_HINT, (text, p) =>
  windowed(
    text,
    p.variation === "clip"
      ? `${CUE}<section class="w-zoom"><div class="w-zoomclip">${poster(7, 0)}</div></section>${END}`
      : `${CUE}<section class="w-zoom"><div class="w-zoomback">${poster(7, 0)}</div>${PLATE}</section>${END}`,
    (win) => [
      p.variation === "clip"
        ? zoomThrough(one(win, ".w-zoom"), one(win, ".w-zoomclip"), { mode: "clip", scroller: win, length: 1.2 })
        : zoomThrough(one(win, ".w-zoom"), one(win, ".w-zoomplate"), { focus: one(win, "[data-zoom-focus]"), scale: 60, scroller: win, length: 1.2 }),
    ],
  ),
);

/* ---------- Text on path ---------- */

const RING = "M100 20 a80 80 0 1 1 0 160 a80 80 0 1 1 0 -160 a80 80 0 1 1 0 160 a80 80 0 1 1 0 -160";

const textOnPath = play(["Curve", "Badge"], ["curve", "badge"], SCROLL_HINT, (text, p) =>
  p.variation === "badge"
    ? live(
        text,
        `<div class="path-badge"><svg viewBox="0 0 200 200"><path id="tp-ring" d="${RING}" fill="none"/><text><textPath href="#tp-ring">Every way a page can move · Every way ·</textPath></text></svg><button type="button" class="ctl lab" aria-pressed="false">Pause</button></div>`,
        (layer) => {
          const loop = pathLoop(one<SVGTextPathElement>(layer, "textPath"), { duration: 16 });
          const button = one<HTMLButtonElement>(layer, "button");
          const toggle = () => {
            const paused = button.getAttribute("aria-pressed") !== "true";
            button.setAttribute("aria-pressed", String(paused));
            button.textContent = paused ? "Play" : "Pause";
            if (paused) loop.pause();
            else loop.play();
          };
          button.addEventListener("click", toggle);
          return [() => button.removeEventListener("click", toggle), loop.revert];
        },
      )
    : windowed(
        text,
        `${CUE}<section class="w-path"><svg viewBox="0 0 600 220"><path id="tp-curve" d="M10 190 C170 10 430 10 590 190" fill="none"/><text><textPath href="#tp-curve" startOffset="0%">Every way a page can move.</textPath></text></svg></section>${END}`,
        (win) => [pathScrub(one<SVGTextPathElement>(win, "textPath"), { trigger: one<HTMLElement>(win, ".w-path"), scroller: win })],
      ),
);

export const SCROLL_STAGES: Record<string, StageDef> = {
  "scroll-reveal": reveal,
  "scrubbed-statement": statement,
  parallax: parallaxStage,
  "pinned-scene": pinned,
  "stacking-cards": stacking,
  "zoom-through": zoom,
  "horizontal-run": run,
  waypoints,
  progress,
  "velocity-skew": skew,
  "header-theme": headerTheme,
  "hide-on-scroll": hideOnScroll,
  "smooth-scroll": smooth,
  "section-pager": pager,
  "scrubbed-video": video,
  "frame-sequence": frames,
  "shape-scrub": shape,
  "text-on-path": textOnPath,
};
