// Stages for the Scroll exhibits. Each stage holds a small scrolling window, a page within the
// page, and the animaxxing recipe runs against it with `scroller` set to that window. Nothing loops:
// scrolling is the control. Recipes are copied unchanged into lib/motion/recipes, apart from the
// section pager's `embedded` option, marked where it is defined.
import { gsap, prefersReducedMotion, ScrollTrigger, SplitText } from "../gsap";
import { live, play, type Play, type StageDef } from "../stage-core";
import {
  horizontalRun,
  headerSection,
  headerShrink,
  navTheme,
  parallax,
  pinnedScene,
  revealOnScroll,
  runDrift,
  scrollDirection,
  scrollWaypoints,
  scrubStatement,
  stackCards,
  zoomThrough,
} from "../recipes/scroll-effects";
import { sectionPager } from "../recipes/section-pager";
import { lenisScroll } from "../recipes/smooth/lenis-scroll";
import type { LenisOptions } from "lenis";

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
 * measured once the window has its size, and again after fonts load. Lenis drives the window.
 */
export function windowed(
  text: HTMLElement,
  inner: string,
  wire: (win: HTMLElement, layer: HTMLElement) => Array<() => void>,
  className = "",
  lenis: Partial<LenisOptions> = {},
): Play {
  return live(
    text,
    `<div class="win ${className}" tabindex="0" role="region" aria-label="A scrolling sample page">${inner}</div>`,
    (layer) => {
      const win = one(layer, ".win");
      // The skill's Lenis drives the window's scroll from GSAP's ticker, so pins and scrubbed transforms
      // land in the same frame as the scroll. Left native, the browser scrolls first and a pinned
      // section shakes a frame behind.
      const smooth = lenisScroll({ wrapper: win, content: win, ...lenis });
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
        smooth.destroy,
      ];
    },
    "scroll",
  );
}

/* ---------- Scroll reveal ---------- */

// Cards from the skill's revealOnScroll, each tab a different start state; the statement tabs are its
// scrubStatement, where words or letters fill in at the speed you read. All reverse on the way back up.
const CARD_REVEALS: Record<string, Parameters<typeof revealOnScroll>[1]> = {
  rise: { ease: "signature" },
  plop: { y: -32, scale: 0, rotation: -20, duration: 0.7, stagger: 0.12, ease: "elastic.out(1, 0.72)" },
  zoom: { y: 0, scale: 0.6, duration: 0.6, stagger: 0.07, ease: "back.out(1.6)" },
  tilt: { y: 60, rotation: 8, duration: 0.6, stagger: 0.08, ease: "power3.out" },
};

const reveal = play(["Rise", "Plop", "Zoom", "Tilt", "Words", "Letters"], ["rise", "plop", "zoom", "tilt", "words", "chars"], SCROLL_HINT, (text, p) =>
  p.variation === "words" || p.variation === "chars"
    ? windowed(
        text,
        `${CUE}<section class="w-statement"><p>Every way a page can move, from the first frame to the last, read at the speed you scroll.</p></section>${END}`,
        (win) => [scrubStatement(one(win, ".w-statement p"), { by: p.variation as "words", scroller: win })],
      )
    : windowed(text, `${CUE}<div class="w-grid">${Array.from({ length: 24 }, (_, i) => `<div class="w-card">${poster(10 + i, i)}</div>`).join("")}</div>${END}`, (win) => [
        revealOnScroll(all(win, ".w-card"), { scroller: win, start: "top 70%", repeat: true, ...CARD_REVEALS[p.variation] }),
      ]),
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

/* ---------- Pinned ---------- */

const pinned = play(["Pinned"], ["pinned"], SCROLL_HINT, (text) =>
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

// Seven stops of different sizes, sides, and one tilt: the skill's scrollWaypoints fits the poster to each
// dock's box and angle, so it shrinks, grows, crosses, and turns as the page scrolls.
const STOPS: Array<[string, string]> = [
  ["Sketch", "right small"],
  ["Draft", "left"],
  ["Review", "wide"],
  ["Polish", "right small tilt"],
  ["Share", "left small"],
  ["Ship", "center"],
];
const waypoints = play(["Waypoints"], ["waypoints"], SCROLL_HINT, (text) =>
  windowed(
    text,
    `<section class="w-way"><div class="w-traveller" data-traveller>${poster(27, 0)}</div><h3>Plan</h3></section>
     ${STOPS.map(([name, kind]) => `<section class="w-way"><div data-waypoint class="w-dock ${kind}"></div><h3>${name}</h3></section>`).join("")}${END}`,
    (win) => [scrollWaypoints(one(win, "[data-traveller]"), all(win, "[data-waypoint]"), { scroller: win })],
  ),
);

/* ---------- Header ---------- */

const HEAD = `<header class="w-head"><b>Museum of Motion</b><span class="lab">Collection · About</span></header>`;
const ROOMS = ["Time", "Scroll", "Pointer", "Drag", "Type", "Paths", "Covers", "Exit"];
const BANDS = (n: number) =>
  Array.from(
    { length: n },
    (_, i) =>
      `<section class="w-band ${i % 2 ? "dark" : "light"}" data-nav-theme="${i % 2 ? "dark" : "light"}" data-header-section="${ROOMS[i % ROOMS.length]}"><h3>${i % 2 ? "Dark section" : "Light section"}</h3></section>`,
  ).join("");
// Shrink: a tall header whose backdrop, wide wordmark, and nav condense into a slim bar.
const TALL_HEAD = `<header class="w-head w-tallhead" data-header-shrink><i data-header-bg></i><b data-header-mark>Museum of Motion</b><span class="lab" data-header-nav>Collection · About</span></header>`;
// Section: the header names the room beneath it.
const ROOM_HEAD = `<header class="w-head"><b>Museum of Motion</b><span class="w-room" data-header-label aria-hidden="true">${ROOMS[0]}</span></header>`;

// Theme and Hide are the skill's navTheme and scrollDirection; Both runs them together, as most sites would.
// Shrink is headerShrink, and Section is headerSection.
const header = play(
  ["Theme", "Hide", "Both", "Shrink", "Section"],
  ["theme", "hide", "both", "shrink", "section"],
  "Scroll down, then back up.",
  (text, p) =>
    windowed(
      text,
      `${p.variation === "shrink" ? TALL_HEAD : p.variation === "section" ? ROOM_HEAD : HEAD}${BANDS(8)}`,
      (win) => {
        const head = one(win, ".w-head");
        if (p.variation === "shrink") return [headerShrink(head, { compact: 56, distance: 200, mark: 0.42, stretch: "75%", scroller: win })];
        if (p.variation === "section") return [navTheme(head, { scroller: win }), headerSection(one(win, "[data-header-label]"), { scroller: win })];
        return [
          ...(p.variation === "hide" ? [] : [navTheme(head, { scroller: win })]),
          ...(p.variation === "theme" ? [] : [scrollDirection(win, { scroller: win })]),
        ];
      },
      p.variation === "hide" || p.variation === "both" ? "hiding" : "",
    ),
);

/* ---------- Section pager ---------- */

const CHAPTERS = ["Arrive", "Hold", "Turn", "Leave"];

// The skill's sectionPager does the cover; its onChange nests each chapter's entrance on the move's
// timeline. The title's letters rise out of a mask as the word widens, the numeral slides in, and the
// ticks and counter follow. Stack shrinks the outgoing chapter back; Loop wraps past the ends.
const pager = play(["Cover", "Stack", "Loop"], ["cover", "stack", "loop"], "Wheel, swipe, or use the arrow keys inside the box.", (text, p) =>
  live(
    text,
    `<div class="w-pagerbox"><div class="w-pager" tabindex="0" aria-label="Sample chapters">${CHAPTERS.map(
      (t, i) => `<section class="w-chapter c${i}"><b class="w-cnum" aria-hidden="true">${two(i + 1)}</b><span class="lab">Chapter ${i + 1}</span><b class="w-ctitle">${t}</b></section>`,
    ).join("")}</div>
     <div class="w-pagerbar"><span class="w-ticks" aria-hidden="true">${CHAPTERS.map(() => "<i></i>").join("")}</span><span class="lab w-count" aria-live="polite">01 / ${two(CHAPTERS.length)}</span></div>
     <div class="w-pagerbtns"><button type="button" class="pill" data-prev>Previous</button><button type="button" class="pill" data-next>Next</button></div></div>`,
    (layer) => {
      const reduced = prefersReducedMotion();
      const sections = all(layer, ".w-chapter");
      const ticks = all(layer, ".w-ticks i");
      const count = one(layer, ".w-count");
      const splits = sections.map((s) => SplitText.create(one(s, ".w-ctitle"), { type: "chars", mask: "chars", aria: "auto" }));
      const mark = (index: number) => {
        ticks.forEach((tick, i) => tick.classList.toggle("on", i === index));
        count.textContent = `${two(index + 1)} / ${two(CHAPTERS.length)}`;
      };
      mark(0);
      const pg = sectionPager(one(layer, ".w-pager"), {
        embedded: true,
        loop: p.variation === "loop",
        drift: p.variation === "stack" ? 0 : 30,
        onChange(index, previous, tl) {
          mark(index);
          if (reduced) return;
          const to = sections[index]!;
          const from = sections[previous]!;
          const forward = index > previous !== (p.variation === "loop" && Math.abs(index - previous) > 1);
          tl.fromTo(splits[index]!.chars, { yPercent: forward ? 110 : -110 }, { yPercent: 0, duration: 0.7, ease: "signature", stagger: 0.035 }, 0.3)
            .fromTo(one(to, ".w-ctitle"), { fontStretch: "62%" }, { fontStretch: "75%", duration: 0.9, ease: "signature" }, 0.3)
            // The numeral rests faint, as the stylesheet sets it.
            .fromTo(one(to, ".w-cnum"), { xPercent: 40, opacity: 0 }, { xPercent: 0, opacity: 0.16, duration: 0.8, ease: "signature" }, 0.35)
            .fromTo(one(to, ".lab"), { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, ease: "signature" }, 0.45);
          // Stack: the outgoing chapter sinks back under the cover instead of drifting.
          if (p.variation === "stack") tl.to(from, { scale: 0.86, duration: 0.9, ease: "power3.inOut" }, 0).set(from, { scale: 1 });
        },
      });
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
        () => {
          gsap.set(sections.flatMap((s) => [s, one(s, ".w-ctitle"), one(s, ".w-cnum"), one(s, ".lab")]), { clearProps: "transform,opacity,visibility,fontStretch" });
          splits.forEach((s) => s.revert());
        },
      ];
    },
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

export const SCROLL_STAGES: Record<string, StageDef> = {
  "scroll-reveal": reveal,
  parallax: parallaxStage,
  pinned,
  "stacking-cards": stacking,
  "zoom-through": zoom,
  "horizontal-run": run,
  waypoints,
  header,
  "section-pager": pager,
};
