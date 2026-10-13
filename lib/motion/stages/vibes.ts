// Vibes: the collection's effects combined into one feeling. Each is a small site with its own look,
// built on one skeleton (nav, hero, button, cards, a statement, a footer) so the vibes compare cleanly.
// The skills supply the parts: revealOnScroll, scrubStatement, parallax, pressFeedback, the hover
// effects, confetti, and Lenis on the window. Each vibe chooses which, and tunes their curves and timing.
import { Flip, gsap, prefersReducedMotion, ScrollTrigger, SplitText } from "../gsap";
import { play, type StageDef } from "../stage-core";
import { windowed } from "./scroll";
import { parallax, revealOnScroll, scrubStatement } from "../recipes/scroll-effects";
import { pressFeedback } from "../recipes/press-feedback";
import { beadUnderline, imageZoom, jelly, pourFill, textRoll, underlineSweep } from "../recipes/hover-effects";
import { dragPull, inkText, paintReveal, pullCorner, registrationSlip, writeOn, type Pull } from "../recipes/print-effects";
import { liquidImage } from "../recipes/webgl/liquid-image";
import { flight, pointerLean, scrollFlight } from "../recipes/webgl/scene-flight";
import { particleMorph, pointerPush, scatterShape } from "../recipes/webgl/particle-morph";
import { pourReveal } from "../recipes/media-effects";
import { cursorFollower, spotlight, tilt } from "../recipes/pointer-effects";
import { burstFrom, pile } from "../recipes/physics-effects";
import { horizontalRun } from "../recipes/scroll-effects";
import { sortable } from "../recipes/sortable";
import { stateButton, tabIndicator } from "../recipes/component-motion";
import { Draggable } from "gsap/Draggable";

gsap.registerPlugin(Draggable);

type Copy = { brand: string; links: [string, string]; kicker: string; head: string; sub: string; cta: string; cards: Array<[string, string]>; quote: string; foot: string };

/** The page's parts, found once the window is mounted. */
type Page = {
  win: HTMLElement;
  nav: HTMLElement[];
  kicker: HTMLElement;
  head: HTMLElement;
  sub: HTMLElement;
  btn: HTMLElement;
  cards: HTMLElement[];
  quote: HTMLElement;
  quoteSection: HTMLElement;
  cardsSection: HTMLElement;
};

type Vibe = {
  copy: Copy;
  /** The vibe's own sections, between the cards and the statement: what only this kind of site would do. */
  extra?: string;
  /** A page of its own in place of the shared skeleton. It keeps the skeleton's classes for nav, hero, cards, and statement. */
  page?: string;
  /** Lenis feel for the window, such as a heavier `lerp` for a slower scroll. */
  lenis?: { lerp?: number; wheelMultiplier?: number };
  /** The vibe's way of moving between sections: the nav links use it. */
  move: Move;
  /** Where the two nav links go, as selectors inside the page. */
  nav: [string, string];
  /** Builds the page's intro on `tl`. Returns its own undo, such as a split's revert. */
  intro: (page: Page, tl: gsap.core.Timeline) => () => void;
  /** Everything after the intro: scroll, press, hover. Returns teardowns. */
  wire: (page: Page, layer: HTMLElement) => Array<() => void>;
};

const one = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;
const all = (root: ParentNode, sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));

/**
 * Ambient loops longer than five seconds get a pause control, as the brief asks. Loops start paused
 * under reduced motion. Returns the teardown.
 */
function ambient(button: HTMLElement, loops: gsap.core.Animation[]): () => void {
  const reduced = prefersReducedMotion();
  let paused = reduced;
  const sync = () => {
    loops.forEach((loop) => loop.paused(paused));
    button.textContent = paused ? "Play" : "Pause";
    button.setAttribute("aria-pressed", String(paused));
  };
  const toggle = () => {
    paused = !paused;
    sync();
  };
  sync();
  button.addEventListener("click", toggle);
  return () => {
    button.removeEventListener("click", toggle);
    loops.forEach((loop) => loop.kill());
  };
}

/**
 * The hero button takes the visitor to the vibe's signature section, moving the way the vibe moves:
 * a slow glide, a hop, a jump in steps. Reduced motion jumps. Returns the teardown.
 */
function cta(p: Page, target: HTMLElement, move: Move, then?: () => void): () => void {
  const go = () => scrollWin(p.win, target, move, then);
  p.btn.addEventListener("click", go);
  return () => {
    p.btn.removeEventListener("click", go);
    gsap.killTweensOf(p.win);
  };
}

type Move = { duration: number; ease: string; delay?: number };

/** Scrolls the window to a section the way the vibe moves. Reduced motion jumps. */
function scrollWin(win: HTMLElement, target: HTMLElement, move: Move, then?: () => void) {
  const y = target.getBoundingClientRect().top - win.getBoundingClientRect().top + win.scrollTop - 24;
  gsap.to(win, {
    scrollTo: { y, autoKill: true },
    duration: prefersReducedMotion() ? 0 : move.duration,
    delay: prefersReducedMotion() ? 0 : (move.delay ?? 0),
    ease: move.ease,
    overwrite: true,
    onComplete: then,
  });
}

/** Runs `enter` once a section scrolls into the window's view. */
const onView = (section: HTMLElement, win: HTMLElement, enter: () => void, start = "top 80%") =>
  ScrollTrigger.create({ trigger: section, scroller: win, start, once: true, onEnter: enter });

function markup({ brand, links, kicker, head, sub, cta, cards, quote, foot }: Copy, extra = "") {
  return `<header class="v-nav"><b class="v-brand">${brand}</b><span class="v-links"><a href="#v">${links[0]}</a><a href="#v">${links[1]}</a></span></header>
    <section class="v-hero"><p class="v-kicker">${kicker}</p><h3 class="v-head">${head}</h3><p class="v-sub">${sub}</p><button type="button" class="v-btn"><span data-roll-label>${cta}</span></button></section>
    <section class="v-cards">${cards.map(([t, m]) => `<article class="v-card"><span class="v-art"><i data-parallax="-24"></i></span><b>${t}</b><span class="v-meta">${m}</span></article>`).join("")}</section>
    ${extra}
    <section class="v-quote"><p>${quote}</p></section>
    <footer class="v-foot">${foot}</footer>`;
}

/** One vibe, as an exhibit: the page in a scrolling window, its intro, a Replay control, and a link to the page at full size. */
function vibe(key: string, v: Vibe): StageDef {
  return play([key[0]!.toUpperCase() + key.slice(1)], [key], "Scroll the page. Press the button. Replay to see it arrive again.", (text) =>
    windowed(
      text,
      v.page ?? markup(v.copy, v.extra),
      (win, layer) => {
        // A vibe's faces load on first use. Laid out in a fallback first, its lines would break one way and
        // then jump when the face arrives, so the page stays hidden until its faces are in, briefly at most.
        let alive = true;
        let teardowns: Array<() => void> = [];
        win.style.visibility = "hidden";
        facesIn(win).then(() => {
          if (!alive) return;
          win.style.removeProperty("visibility");
          teardowns = setup(win, layer);
          ScrollTrigger.refresh();
        });
        return [
          () => {
            alive = false;
            win.style.removeProperty("visibility");
            teardowns.forEach((off) => off());
          },
        ];
      },
      `vibe vibe-${key}`,
      v.lenis,
    ),
  );

  function setup(win: HTMLElement, layer: HTMLElement): Array<() => void> {
    const page: Page = {
      win,
      nav: all(win, ".v-brand, .v-links a"),
      kicker: one(win, ".v-kicker"),
      head: one(win, ".v-head"),
      sub: one(win, ".v-sub"),
      btn: one(win, ".v-btn"),
      cards: all(win, ".v-card"),
      quote: one(win, ".v-quote p"),
      quoteSection: one(win, ".v-quote"),
      cardsSection: one(win, ".v-cards"),
    };
    let undo = () => {};
    let tl: gsap.core.Timeline | undefined;
    const start = () => {
      tl?.kill();
      undo();
      tl = gsap.timeline({ defaults: { overwrite: "auto" } });
      undo = v.intro(page, tl);
      if (prefersReducedMotion()) tl.progress(1);
    };
    start();
    const replay = document.createElement("button");
    replay.type = "button";
    replay.className = "pill v-replay";
    replay.textContent = "Replay";
    const again = () => {
      win.scrollTo({ top: 0 });
      start();
    };
    replay.addEventListener("click", again);
    // The page can be seen whole, in a tab of its own. There, the same pill leads back to the exhibit.
    const full = !!layer.closest(".vibe-full");
    const open = document.createElement("a");
    open.className = "pill v-open";
    open.href = full ? `/exhibits/${key}` : `/vibes/${key}`;
    open.textContent = full ? "← Exhibit" : "Full page ↗";
    if (!full) {
      open.target = "_blank";
      open.rel = "noopener";
      open.setAttribute("aria-label", "Full page, opens in a new tab");
    }
    const tools = document.createElement("div");
    tools.className = "v-tools";
    tools.append(open, replay);
    layer.append(tools);
    // The nav links go to the vibe's own sections, moving the way the vibe moves.
    const links = all(win, ".v-links a");
    const goes = links.map((a, i) => {
      const go = (e: Event) => {
        e.preventDefault();
        scrollWin(win, one(win, v.nav[i]!), v.move);
      };
      a.addEventListener("click", go);
      return () => a.removeEventListener("click", go);
    });
    return [
      () => {
        replay.removeEventListener("click", again);
        tools.remove();
        goes.forEach((off) => off());
      },
      ...v.wire(page, layer),
      () => {
        tl?.kill();
        undo();
      },
    ];
  }
}

/** Resolves once every face the window's text uses has loaded, or after a second and a half. */
function facesIn(win: HTMLElement): Promise<void> {
  if (!document.fonts) return Promise.resolve();
  const faces = new Set<string>();
  for (const el of win.querySelectorAll<HTMLElement>("*")) {
    if (!el.childNodes.length || el.closest("svg")) continue;
    const s = getComputedStyle(el);
    faces.add(`${s.fontStyle} ${s.fontWeight} 16px ${s.fontFamily}`);
  }
  const loads = Promise.all([...faces].map((face) => document.fonts.load(face).catch(() => [])));
  return Promise.race([loads.then(() => undefined), new Promise<void>((resolve) => setTimeout(resolve, 1500))]);
}

/** Splits for an intro, undone by the returned revert. */
const split = (el: HTMLElement, type: string, mask?: "lines" | "words" | "chars") => SplitText.create(el, { type, ...(mask ? { mask } : {}), aria: "auto" });

/* ---------- Calm ---------- */

/** One time of day for the lake: sky, sun, three hills back to front, water, and whether stars are out. */
type Hour = { sky: [string, string]; sun: string; sunY: number; hills: [string, string, string]; water: string; stars?: boolean; moon?: boolean };
const DAWN: Hour = { sky: ["#f1e4d3", "#f6d9bf"], sun: "#f3b98a", sunY: 146, hills: ["#d7d6c6", "#b9c4b2", "#93a893"], water: "#e6e3d6" };
const NOON: Hour = { sky: ["#dfe9ea", "#eef1e8"], sun: "#fbf3dc", sunY: 104, hills: ["#c4d1c3", "#a3b8a2", "#7f9a82"], water: "#d5e2e1" };
const DUSK: Hour = { sky: ["#e9cfc4", "#f1d7b8"], sun: "#e79a78", sunY: 182, hills: ["#c9b7b0", "#a99c9a", "#857c80"], water: "#e3d2c8" };
const NIGHT: Hour = { sky: ["#2f3b45", "#46525a"], sun: "#e8e4d6", sunY: 100, hills: ["#3f4c52", "#34414a", "#28343c"], water: "#3a4750", stars: true, moon: true };

/** A still lake under low hills, at one hour. Soft shapes only, no outlines. */
function lake(id: string, h: Hour, hero = false) {
  const stars = h.stars ? [[60, 40], [110, 24], [170, 52], [250, 30], [300, 58], [350, 22], [80, 90], [330, 96]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#f4efe2" opacity=".8"/>`).join("") : "";
  const sun = h.moon
    ? `<g class="cl-sun"><circle cx="290" cy="${h.sunY}" r="18" fill="${h.sun}"/><circle cx="298" cy="${h.sunY - 5}" r="16" fill="${h.sky[0]}"/></g>`
    : `<circle class="cl-sun" cx="200" cy="${h.sunY}" r="${hero ? 30 : 26}" fill="${h.sun}"/>`;
  return `<svg viewBox="0 0 400 300" class="cl-lake" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${h.sky[0]}"/><stop offset="1" stop-color="${h.sky[1]}"/></linearGradient>
  <linearGradient id="${id}-glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${h.sun}" stop-opacity=".9"/><stop offset="1" stop-color="${h.sun}" stop-opacity="0"/></linearGradient></defs>
  <rect width="400" height="300" fill="url(#${id}-sky)"/>${stars}${sun}
  <path class="cl-hill" d="M0 170C60 140 110 128 170 146C230 164 290 132 400 150V210H0Z" fill="${h.hills[0]}"/>
  <path class="cl-hill" d="M0 186C70 166 130 176 190 184C260 194 320 166 400 176V210H0Z" fill="${h.hills[1]}"/>
  <path class="cl-hill" d="M0 200C80 188 150 204 220 198C290 192 340 186 400 194V212H0Z" fill="${h.hills[2]}"/>
  <rect class="cl-water" y="208" width="400" height="92" fill="${h.water}"/>
  <path d="${[0, 1, 2, 3, 4, 5].map((i) => `M${(h.moon ? 290 : 200) - (26 - i * 4)} ${216 + i * 9}h${(26 - i * 4) * 2}`).join("")}" stroke="url(#${id}-glow)" stroke-width="3" stroke-linecap="round"/>
  <path class="cl-ripple" d="M150 232H250M120 252H280M170 270H230M90 286H200" stroke="#fff" stroke-opacity="${h.stars ? 0.25 : 0.7}" stroke-width="1.4" stroke-linecap="round" fill="none"/>
</svg>`;
}

const CALM_SESSIONS: Array<[string, string, string, Hour]> = [
  ["Morning light", "10 min · with Ama", "Wake slowly, one breath at a time.", DAWN],
  ["Evening tide", "12 min · with Jonah", "Set the day down like a heavy bag.", DUSK],
  ["Into sleep", "20 min · with Ama", "A body scan that ends in rest.", NIGHT],
];
const CALM_DAY: Array<[string, string, string, Hour]> = [
  ["05:58", "First light", "Morning light, ten minutes, before the house wakes.", DAWN],
  ["12:30", "Midday", "Three breaths at your desk. No one has to know.", NOON],
  ["19:40", "Dusk", "Evening tide, to let the day go.", DUSK],
  ["22:15", "Night", "Into sleep, with the lights already off.", NIGHT],
];

// Slow and soft: long fades on gentle eases, a dawn that rises, ripples that spread, nothing that bounces.
// Its own page, set in Fraunces at its softest and Manrope.
const calm = vibe("calm", {
  copy: { brand: "", links: ["", ""], kicker: "", head: "", sub: "", cta: "", cards: [], quote: "", foot: "" },
  lenis: { lerp: 0.045 },
  move: { duration: 2.2, ease: "sine.inOut" },
  nav: [".v-cards", ".cl-journal"],
  page: `<header class="v-nav"><b class="v-brand"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 14c3-2 6-2 9 0s6 2 9 0M6 18c2-1.3 4-1.3 6 0s4 1.3 6 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="8" r="3" fill="currentColor"/></svg>Stillwater</b><span class="v-links"><a href="#v">Practice</a><a href="#v">Journal</a></span></header>
    <section class="v-hero cl-hero">
      <div class="cl-copy"><p class="v-kicker">A morning practice</p><h3 class="v-head">Breathe out. <em>Begin again.</em></h3><p class="v-sub">Ten unhurried minutes to start the day, guided by a voice that never rushes you.</p><button type="button" class="v-btn">Begin a session</button></div>
      <div class="cl-hero-art">${lake("clh", DAWN, true)}</div>
    </section>
    <section class="cl-sessions"><p class="v-kicker">Today’s sessions</p><div class="v-cards">${CALM_SESSIONS.map(([name, meta, line, hour], i) => `<article class="v-card"><span class="v-art"><i data-parallax="-16">${lake(`clc${i}`, hour)}</i><b class="cl-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 7l8 5-8 5Z" fill="currentColor"/></svg></b></span><b>${name}</b><span class="v-meta">${meta}</span><span class="cl-line">${line}</span></article>`).join("")}</div></section>
    <section class="v-breathe"><div class="cl-orb" aria-hidden="true"><i></i><i></i><span class="v-orb"></span></div><p class="v-orb-say"><span class="cl-said">Breathe in for four, hold, and breathe out for four.</span><span aria-hidden="true">Breathe in</span><span aria-hidden="true">Hold</span><span aria-hidden="true">Breathe out</span></p></section>
    <p class="v-ambient"><button type="button" class="v-pause">Pause</button></p>
    <section class="cl-day"><div class="cl-day-pin">${CALM_DAY.map(([time, name, line, hour], i) => `<figure class="cl-hour">${lake(`cld${i}`, hour)}<figcaption><span>${time}</span><b>${name}</b><em>${line}</em></figcaption></figure>`).join("")}</div></section>
    <section class="cl-journal"><p class="v-kicker">From the journal</p>${[["On beginning badly", "Why a wandering mind is the practice, not the failure.", "4 min read"], ["The long exhale", "A breath twice as long going out as coming in, and what it does.", "6 min read"], ["Rest is not a reward", "You do not have to earn the ten minutes.", "5 min read"]].map(([t, d, m]) => `<article class="cl-entry"><b>${t}</b><span>${d}</span><small>${m}</small></article>`).join("")}</section>
    <section class="v-quote"><p>Nothing to fix. Nowhere to be. Just this breath, and then the next.</p></section>
    <footer class="v-foot"><span>Stillwater</span><span>Made slowly in Lisbon</span></footer>
    <i class="v-soft-cursor" aria-hidden="true"></i>`,
  intro: (p, tl) => {
    const s = split(p.head, "words");
    const art = one(p.win, ".cl-hero-art");
    const sun = one(art, ".cl-sun");
    const hills = all(art, ".cl-hill");
    const ripple = one(art, ".cl-ripple");
    tl.from(p.nav, { autoAlpha: 0, duration: 1.4, ease: "sine.out", stagger: 0.2 }, 0)
      // Dawn: the sun lifts out of the hills, the hills settle back to front, the water ripples outward.
      .from(art, { autoAlpha: 0, duration: 2, ease: "sine.out" }, 0)
      .from(sun, { y: 50, duration: 4, ease: "sine.out" }, 0.2)
      .from(hills, { y: 14, autoAlpha: 0, duration: 2.4, ease: "sine.out", stagger: 0.4 }, 0.4)
      .fromTo(ripple, { drawSVG: "50% 50%" }, { drawSVG: "0% 100%", duration: 3, ease: "sine.inOut" }, 1.4)
      .from(p.kicker, { autoAlpha: 0, y: 8, duration: 1.4, ease: "sine.out" }, 0.4)
      .from(s.words, { autoAlpha: 0, y: 18, duration: 1.8, ease: "power2.out", stagger: 0.28 }, 0.7)
      .from(p.sub, { autoAlpha: 0, duration: 1.6, ease: "sine.out" }, 1.8)
      .from(p.btn, { autoAlpha: 0, duration: 1.4, ease: "sine.out" }, 2.3);
    return () => {
      s.revert();
      gsap.set([art, sun, ...hills, ripple], { clearProps: "all" });
    };
  },
  wire: (p) => [
    (() => {
      const orb = one(p.win, ".v-orb");
      const rings = all(p.win, ".cl-orb i");
      const [breatheIn, hold, breatheOut] = all(p.win, ".v-orb-say [aria-hidden]");
      gsap.set([hold, breatheOut], { autoAlpha: 0 });
      // One cue fades out as the next fades in, slowly, like the breath itself.
      const fade = (tl: gsap.core.Timeline, from: HTMLElement, to: HTMLElement, at: number) =>
        tl.to(from, { autoAlpha: 0, duration: 0.9, ease: "sine.inOut" }, at).to(to, { autoAlpha: 1, duration: 0.9, ease: "sine.inOut" }, at + 0.15);
      // Four seconds in, a beat held, four seconds out: the pace of a calm breath. The rings follow a little late.
      const breath = gsap
        .timeline({ repeat: -1, defaults: { ease: "sine.inOut" } })
        .fromTo(orb, { scale: 0.55 }, { scale: 1, duration: 4 }, 0)
        .fromTo(rings, { scale: 0.6, opacity: 0.2 }, { scale: 1, opacity: 1, duration: 4, stagger: 0.3 }, 0)
        .to(orb, { scale: 0.55, duration: 4 }, 5.2)
        .to(rings, { scale: 0.6, opacity: 0.2, duration: 4, stagger: 0.3 }, 5.2);
      fade(breath, breatheIn!, hold!, 3.4);
      fade(breath, hold!, breatheOut!, 4.7);
      // Into the next breath: out gives way to in as the loop turns over.
      fade(breath, breatheOut!, breatheIn!, 8.6);
      // The day, as you scroll: dawn gives way to noon, dusk, then night. A slow crossfade, scrubbed.
      const hours = all(p.win, ".cl-hour");
      gsap.set(hours.slice(1), { autoAlpha: 0 });
      const day = gsap.timeline({ scrollTrigger: { trigger: one(p.win, ".cl-day"), scroller: p.win, start: "top top", end: "bottom bottom", scrub: 1.4 } });
      hours.slice(1).forEach((h, i) => {
        day.to(h, { autoAlpha: 1, duration: 1, ease: "sine.inOut" }, i * 1.4 + 0.4).set(hours[i]!, { autoAlpha: 0 });
      });
      // Begin: a slow glide down to the guide. The breath carries on as it was.
      const begin = cta(p, one(p.win, ".v-breathe"), { duration: 2.2, ease: "sine.inOut" });
      const loops = ambient(one(p.win, ".v-pause"), [breath]);
      return () => {
        begin();
        loops();
        day.scrollTrigger?.kill();
        day.kill();
        gsap.set([...hours, ...rings], { clearProps: "all" });
      };
    })(),
    cursorFollower(one(p.win, ".v-soft-cursor"), { touch: p.win }),
    revealOnScroll(p.cards, { scroller: p.win, y: 24, duration: 1.4, stagger: 0.25, ease: "power2.out" }),
    revealOnScroll(all(p.win, ".cl-entry"), { scroller: p.win, y: 20, duration: 1.4, stagger: 0.25, ease: "power2.out" }),
    scrubStatement(p.quote, { by: "words", scroller: p.win, scrub: 1.4 }),
    parallax(p.cardsSection, { scroller: p.win }),
    pressFeedback(p.btn, { squash: 0.98, ink: 0.12 }),
    ...p.cards.map((c) => imageZoom(c, { image: one<HTMLElement>(c, ".v-art i"), scale: 1.04, duration: 1.4, touch: true })),
  ],
});

/* ---------- Playful ---------- */

// Sticker characters, drawn in SVG with a thick ink outline and a white die-cut edge.
const INK = "#1d1145";
const eyes = (x: number, y: number, gap = 16) =>
  `<g class="pl-eyes"><circle cx="${x - gap / 2}" cy="${y}" r="6" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="${x + gap / 2}" cy="${y}" r="6" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="${x - gap / 2 + 1.5}" cy="${y + 1}" r="2.6" fill="${INK}"/><circle cx="${x + gap / 2 + 1.5}" cy="${y + 1}" r="2.6" fill="${INK}"/></g>`;
const smile = (x: number, y: number, w = 12) => `<path d="M${x - w / 2} ${y}q${w / 2} ${w * 0.6} ${w} 0" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
const sticker = (body: string) =>
  `<svg viewBox="0 0 100 100" class="pl-char" aria-hidden="true"><g stroke-linejoin="round"><g class="pl-cut">${body.replace(/fill="[^"]*"/g, 'fill="#fff"').replace(/stroke-width="[\d.]+"/g, 'stroke-width="14"').replace(/stroke="[^"]*"/g, 'stroke="#fff"')}</g>${body}</g></svg>`;
const CHARS: Record<string, string> = {
  blob: sticker(`<path d="M50 14C74 12 90 30 88 52C86 76 70 88 48 86C26 84 12 70 14 48C16 28 30 15 50 14Z" fill="#ff4f9a" stroke="${INK}" stroke-width="4"/>${eyes(50, 46)}${smile(50, 62)}`),
  star: sticker(`<path d="M50 10L61 36L89 38L67 56L74 84L50 69L26 84L33 56L11 38L39 36Z" fill="#ffd23f" stroke="${INK}" stroke-width="4"/>${eyes(50, 48, 14)}${smile(50, 62, 10)}`),
  pizza: sticker(`<path d="M18 20Q50 6 82 20L50 92Z" fill="#ffb648" stroke="${INK}" stroke-width="4"/><path d="M18 20Q50 6 82 20L78 30Q50 18 22 30Z" fill="#c9773a" stroke="${INK}" stroke-width="4"/><circle cx="40" cy="58" r="5" fill="#ff4f4f" stroke="${INK}" stroke-width="2.5"/><circle cx="60" cy="68" r="4" fill="#ff4f4f" stroke="${INK}" stroke-width="2.5"/>${eyes(50, 40, 14)}`),
  cloud: sticker(`<path d="M26 72C12 72 10 52 24 50C22 34 42 28 50 40C56 26 80 30 78 48C92 50 90 72 76 72Z" fill="#8fd3ff" stroke="${INK}" stroke-width="4"/><path d="M38 56q4 3 8 0M54 56q4 3 8 0" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>${smile(50, 64, 8)}`),
  heart: sticker(`<path d="M50 86C20 64 10 46 18 30C26 16 44 18 50 32C56 18 74 16 82 30C90 46 80 64 50 86Z" fill="#ff6b6b" stroke="${INK}" stroke-width="4"/>${eyes(50, 44)}<circle cx="32" cy="56" r="5" fill="#ffb3c7"/><circle cx="68" cy="56" r="5" fill="#ffb3c7"/>${smile(50, 58)}`),
  bolt: sticker(`<path d="M58 8L22 56H46L38 92L78 40H54Z" fill="#3a5bff" stroke="${INK}" stroke-width="4"/>${eyes(50, 46, 12)}`),
};
const PL_PACKS: Array<[string, string, string, string, string]> = [
  ["Snack Attack", "Pack 12 · 8 stickers", "$6", "#ffb648", "pizza"],
  ["Space Goo", "Pack 13 · 8 stickers", "$6", "#8fd3ff", "blob"],
  ["Tiny Weather", "Pack 14 · 10 stickers", "$7", "#c7f0a8", "cloud"],
];

// Bouncy and loud: stickers slap onto the hero, letters pop in at odd angles, cards plop, the button
// squashes and throws confetti, stickers fling and a jar of them shakes. Bricolage Grotesque, squeezed.
const playful = vibe("playful", {
  copy: { brand: "", links: ["", ""], kicker: "", head: "", sub: "", cta: "", cards: [], quote: "", foot: "" },
  move: { duration: 0.8, ease: "back.inOut(1.4)" },
  nav: [".v-cards", ".v-play"],
  page: `<header class="v-nav"><b class="v-brand">Bloop!</b><span class="v-links"><a href="#v">Packs</a><a href="#v">Play</a></span></header>
    <section class="v-hero pl-hero">
      <div class="pl-copy"><p class="v-kicker">New pack every month</p><h3 class="v-head">Stick it <span>anywhere.</span></h3><p class="v-sub">Weird little stickers, drawn by a different artist every month and mailed to your door.</p><button type="button" class="v-btn">Get pack Nº 1</button></div>
      <div class="pl-slap" aria-hidden="true">${["blob", "star", "pizza", "heart"].map((c, i) => `<span class="pl-on p${i}">${CHARS[c]}</span>`).join("")}</div>
    </section>
    <section class="v-cards">${PL_PACKS.map(([name, meta, price, bg, c]) => `<article class="v-card"><span class="v-art" style="background:${bg}"><i data-parallax="-14">${CHARS[c]}</i></span><b>${name}</b><span class="v-meta">${meta}</span><span class="pl-price">${price}</span></article>`).join("")}</section>
    <section class="v-play"><p class="v-play-head">Go on, grab one. Throw it.</p><div class="v-stickers">${["blob", "star", "pizza", "cloud", "heart", "bolt"].map((c) => `<span class="v-sticker">${CHARS[c]}</span>`).join("")}</div></section>
    <section class="v-heap"><p class="v-play-head">The sticker jar</p><div class="v-heap-box"></div><button type="button" class="v-shake">Shake the jar</button></section>
    <section class="v-quote"><p>Every laptop deserves a little party.</p></section>
    <footer class="v-foot"><span>Bloop! Sticker Club</span><span>Mailed from Portland · Cancel anytime</span></footer>`,
  intro: (p, tl) => {
    const s = split(p.head, "chars");
    const slaps = all(p.win, ".pl-on");
    tl.from(p.nav, { autoAlpha: 0, scale: 0, duration: 0.6, ease: "back.out(2.5)", stagger: 0.08 }, 0)
      .from(p.kicker, { autoAlpha: 0, scale: 0, rotation: -25, duration: 0.7, ease: "back.out(3)" }, 0.15)
      .from(s.chars, { autoAlpha: 0, scale: 0, yPercent: 60, rotation: () => gsap.utils.random(-40, 40), duration: 0.9, ease: "elastic.out(1, 0.45)", stagger: 0.04 }, 0.25)
      // Each sticker comes down from above the page and slaps on: big, then squashed flat, then itself.
      .from(slaps, { autoAlpha: 0, scale: 1.8, rotation: () => gsap.utils.random(-30, 30), duration: 0.35, ease: "power3.in", stagger: 0.22 }, 0.6)
      .fromTo(slaps, { scaleX: 1, scaleY: 1 }, { keyframes: { scaleX: [1.18, 0.94, 1], scaleY: [0.82, 1.06, 1] }, duration: 0.45, ease: "power1.out", stagger: 0.22, immediateRender: false }, 0.95)
      .from(p.sub, { autoAlpha: 0, y: 20, duration: 0.6, ease: "back.out(2)" }, 0.9)
      .from(p.btn, { autoAlpha: 0, scale: 0, duration: 0.9, ease: "elastic.out(1, 0.4)" }, 1.1);
    return () => {
      s.revert();
      gsap.set(slaps, { clearProps: "all" });
    };
  },
  wire: (p, layer) => {
    const confetti = () =>
      burstFrom(one(layer, ".v-burst"), p.btn, {
        pieces: ["#ff4f9a", "#3a5bff", "#1d1145", "#ffffff", "#8fd3ff"].map((c) => {
          const s = document.createElement("span");
          s.className = "confetto";
          s.style.background = c;
          return s;
        }),
        count: 34,
      });
    const burst = document.createElement("div");
    burst.className = "v-burst";
    burst.setAttribute("aria-hidden", "true");
    layer.append(burst);
    p.btn.addEventListener("click", confetti);
    // Letters hop when the pointer or a finger finds them.
    const hop = (e: PointerEvent) => {
      const letter = (e.target as HTMLElement).closest<HTMLElement>(".v-head div, .v-head span > div");
      if (!letter || prefersReducedMotion()) return;
      gsap.fromTo(letter, { y: 0 }, { y: -22, rotation: gsap.utils.random(-12, 12), duration: 0.18, ease: "power2.out", yoyo: true, repeat: 1, overwrite: true });
    };
    p.head.addEventListener("pointerover", hop);
    // Hero stickers wobble when touched.
    const wobbles = all(p.win, ".pl-on").map((el) => {
      const wobble = () => !prefersReducedMotion() && gsap.fromTo(el, { rotation: 0 }, { keyframes: { rotation: [-12, 9, -5, 0] }, duration: 0.6, ease: "power1.out", overwrite: true });
      el.addEventListener("pointerenter", wobble);
      el.addEventListener("pointerdown", wobble);
      return () => {
        el.removeEventListener("pointerenter", wobble);
        el.removeEventListener("pointerdown", wobble);
      };
    });
    // Stickers drag and throw, bounded by their section; the one held grows and leans.
    const area = one(p.win, ".v-play");
    // A throw carries on after release and bounces off the walls, losing a little each time, spinning as it
    // goes. Draggable's own inertia would stop dead at the bounds, so the throw is a small simulation.
    const flights = new Map<Element, () => void>();
    const fling = (drag: Draggable, vx: number, vy: number) => {
      const el = drag.target as HTMLElement;
      flights.get(el)?.();
      if (prefersReducedMotion()) return;
      let [x, y] = [Number(gsap.getProperty(el, "x")), Number(gsap.getProperty(el, "y"))];
      let spin = vx * 0.04;
      const step = (_time: number, deltaMs: number) => {
        const dt = Math.min(deltaMs, 40) / 1000;
        x += vx * dt;
        y += vy * dt;
        // Off a wall: reflect, keep 82% of the speed, and kick the spin.
        if (x < drag.minX) [x, vx, spin] = [drag.minX, -vx * 0.82, -spin + vy * 0.02];
        if (x > drag.maxX) [x, vx, spin] = [drag.maxX, -vx * 0.82, -spin - vy * 0.02];
        if (y < drag.minY) [y, vy, spin] = [drag.minY, -vy * 0.82, -spin - vx * 0.02];
        if (y > drag.maxY) [y, vy, spin] = [drag.maxY, -vy * 0.82, -spin + vx * 0.02];
        const drag2 = Math.pow(0.32, dt);
        [vx, vy, spin] = [vx * drag2, vy * drag2, spin * drag2];
        gsap.set(el, { x, y, rotation: `+=${spin * dt * 60}` });
        if (Math.hypot(vx, vy) < 12) stop();
      };
      const stop = () => {
        gsap.ticker.remove(step);
        flights.delete(el);
      };
      flights.set(el, stop);
      gsap.ticker.add(step);
    };
    /** The last few pointer samples, for a throw's speed. */
    const trail = new WeakMap<Element, Array<{ x: number; y: number; t: number }>>();
    const stickers = Draggable.create(all(p.win, ".v-sticker"), {
      type: "x,y",
      bounds: area,
      zIndexBoost: true,
      onPress(this: Draggable) {
        flights.get(this.target)?.();
        trail.set(this.target, []);
        gsap.to(this.target, { scale: 1.2, rotation: gsap.utils.random(-15, 15), duration: 0.2, ease: "back.out(3)" });
      },
      onDrag(this: Draggable) {
        const samples = trail.get(this.target)!;
        samples.push({ x: this.x, y: this.y, t: performance.now() });
        if (samples.length > 5) samples.shift();
      },
      onRelease(this: Draggable) {
        gsap.to(this.target, { scale: 1, duration: 0.4, ease: "elastic.out(1, 0.4)" });
        const samples = trail.get(this.target) ?? [];
        const [first, last] = [samples[0], samples[samples.length - 1]];
        if (!first || !last || last.t - first.t < 8 || performance.now() - last.t > 80) return;
        const seconds = (last.t - first.t) / 1000;
        fling(this, (last.x - first.x) / seconds, (last.y - first.y) / seconds);
      },
    });
    // A jar of stickers falls in once it scrolls into view; the button throws them back up.
    const heap = pile(one(p.win, ".v-heap-box"), {
      pieces: ["blob", "star", "pizza", "cloud", "heart", "bolt", "blob", "star"].map((c, i) => {
        const el = document.createElement("span");
        const size = [64, 56, 60, 58, 54, 52, 48, 50][i]!;
        Object.assign(el.style, { width: `${size}px`, height: `${size}px`, borderRadius: "50%" });
        el.innerHTML = CHARS[c]!;
        return el;
      }),
    });
    const landed = onView(one(p.win, ".v-heap"), p.win, () => heap.drop(18));
    // Get pack: confetti first, then a quick hop down to the packs.
    const go = cta(p, p.cardsSection, { duration: 0.8, ease: "back.inOut(1.4)", delay: 0.5 });
    const shake = () => heap.shake();
    one(p.win, ".v-shake").addEventListener("click", shake);
    return [
      () => {
        go();
        p.head.removeEventListener("pointerover", hop);
        wobbles.forEach((off) => off());
        flights.forEach((stop) => stop());
        stickers.forEach((d) => d.kill());
        landed.kill();
        one(p.win, ".v-shake").removeEventListener("click", shake);
        heap.stop();
      },
      () => {
        p.btn.removeEventListener("click", confetti);
        burst.remove();
      },
      revealOnScroll(p.cards, { scroller: p.win, y: -32, scale: 0, rotation: -20, duration: 0.7, stagger: 0.12, ease: "elastic.out(1, 0.6)" }),
      scrubStatement(p.quote, { by: "chars", scroller: p.win }),
      pressFeedback(p.btn, { squash: 0.86, ink: 0.35 }),
      ...p.cards.map((c) => tilt(c, { max: 14, touch: true })),
    ];
  },
});

/* ---------- Luxury ---------- */

// Gold line art, drawn as SVG. One gradient and one sheen per drawing, so each stands alone.
const GOLD = (id: string, size = 200) => `<defs>
  <linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${size}" y2="${size}"><stop offset="0" stop-color="#f6e3b0"/><stop offset=".45" stop-color="#c9a15a"/><stop offset="1" stop-color="#7d5c2c"/></linearGradient>
  <linearGradient id="${id}-s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>`;
/** A four-point glint. */
const glint = (x: number, y: number, r: number) =>
  `<path class="lx-glint" d="M${x} ${y - r}L${x + r * 0.22} ${y - r * 0.22}L${x + r} ${y}L${x + r * 0.22} ${y + r * 0.22}L${x} ${y + r}L${x - r * 0.22} ${y + r * 0.22}L${x - r} ${y}L${x - r * 0.22} ${y - r * 0.22}Z" fill="#fff"/>`;
/** A ring in three-quarter view with an old-cut diamond: band, setting, crown, and pavilion facets. */
function ring(id: string, hero = false) {
  return `<svg viewBox="0 0 200 200" class="lx-art" aria-hidden="true">${GOLD(id)}
  <clipPath id="${id}-c"><path d="M100 64a62 58 0 1 0 .1 0Zm0 14a48 44 0 1 1-.1 0Z" clip-rule="evenodd"/><path d="M76 60L88 44H112L124 60L100 92Z"/></clipPath>
  <path class="lx-fill" d="M100 64a62 58 0 1 0 .1 0Zm0 14a48 44 0 1 1-.1 0Z" fill-rule="evenodd" fill="url(#${id}-g)" opacity=".18"/>
  <ellipse class="lx-line" cx="100" cy="122" rx="62" ry="58" fill="none" stroke="url(#${id}-g)" stroke-width="1.6"/>
  <ellipse class="lx-line" cx="100" cy="122" rx="48" ry="44" fill="none" stroke="url(#${id}-g)" stroke-width="1.2"/>
  <path class="lx-line" d="M84 66L80 58M116 66L120 58M92 64L90 56M108 64L110 56" stroke="url(#${id}-g)" stroke-width="1.4" fill="none"/>
  <path class="lx-line" d="M76 60L88 44H112L124 60L100 92Z" fill="none" stroke="url(#${id}-g)" stroke-width="1.4" stroke-linejoin="round"/>
  <path class="lx-facet" d="M76 60H124M88 44L94 60L100 44L106 60L112 44M94 60L100 92L106 60M84 60L100 92L116 60" fill="none" stroke="#f6e3b0" stroke-width=".7" opacity=".85"/>
  ${hero ? `<g clip-path="url(#${id}-c)"><path class="lx-sheen" d="M-40 30H6L-34 200H-80Z" fill="url(#${id}-s)"/></g>${glint(118, 48, 9)}${glint(150, 92, 6)}${glint(70, 150, 5)}` : ""}
</svg>`;
}
/** A pear-cut stone on a fine chain. */
function pendant(id: string) {
  return `<svg viewBox="0 0 200 200" class="lx-art" aria-hidden="true">${GOLD(id)}
  <path class="lx-line" d="M40 10C60 70 84 96 100 104C116 96 140 70 160 10" fill="none" stroke="url(#${id}-g)" stroke-width="1"/>
  <circle class="lx-line" cx="100" cy="110" r="6" fill="none" stroke="url(#${id}-g)" stroke-width="1.4"/>
  <path class="lx-line" d="M100 118C84 140 80 160 100 176C120 160 116 140 100 118Z" fill="url(#${id}-g)" fill-opacity=".16" stroke="url(#${id}-g)" stroke-width="1.4"/>
  <path class="lx-facet" d="M100 118V176M88 150H112M92 136L100 160L108 136" fill="none" stroke="#f6e3b0" stroke-width=".7" opacity=".8"/>
</svg>`;
}
/** A pair of drop earrings with pearls. */
function earrings(id: string) {
  const drop = (x: number) => `<path class="lx-line" d="M${x} 40V82" stroke="url(#${id}-g)" stroke-width="1.2"/><circle class="lx-line" cx="${x}" cy="36" r="5" fill="none" stroke="url(#${id}-g)" stroke-width="1.4"/>
  <circle class="lx-line" cx="${x}" cy="104" r="20" fill="#f3ead8" fill-opacity=".14" stroke="url(#${id}-g)" stroke-width="1.4"/><path class="lx-facet" d="M${x - 8} 96a10 10 0 0 1 10 -6" stroke="#fff" stroke-width="1.2" fill="none" opacity=".7"/>`;
  return `<svg viewBox="0 0 200 200" class="lx-art" aria-hidden="true">${GOLD(id)}${drop(70)}${drop(130)}</svg>`;
}
/** The atelier: an arched window at dawn, its light falling across the bench, a ring on its mandrel. */
function atelier(id: string) {
  return `<svg viewBox="0 0 800 400" class="lx-scene" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${GOLD(id, 800)}
  <defs><radialGradient id="${id}-dawn" cx=".5" cy=".9" r=".9"><stop offset="0" stop-color="#e9c98a" stop-opacity=".55"/><stop offset="1" stop-color="#2a2216" stop-opacity="0"/></radialGradient>
  <linearGradient id="${id}-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9c98a" stop-opacity=".22"/><stop offset="1" stop-color="#e9c98a" stop-opacity="0"/></linearGradient></defs>
  <rect width="800" height="400" fill="#120f0b"/>
  <g transform="translate(40 22) scale(.9)">
  <path d="M330 300V140a70 70 0 0 1 140 0V300Z" fill="#1d1810"/>
  <path d="M330 300V140a70 70 0 0 1 140 0V300Z" fill="url(#${id}-dawn)"/>
  <path class="lx-beam" d="M330 300L170 400H730L470 300Z" fill="url(#${id}-beam)"/>
  <path d="M400 70V300M330 160H470M330 230H470" stroke="url(#${id}-g)" stroke-width="1.4" opacity=".75"/>
  <path d="M330 300V140a70 70 0 0 1 140 0V300" fill="none" stroke="url(#${id}-g)" stroke-width="2.2"/>
  <path d="M318 300H482" stroke="url(#${id}-g)" stroke-width="2"/>
  <path d="M60 330H740" stroke="url(#${id}-g)" stroke-width="1.6"/>
  <path d="M560 330L600 282L612 282L604 330" fill="none" stroke="url(#${id}-g)" stroke-width="1.4"/>
  <ellipse cx="606" cy="300" rx="12" ry="5" fill="none" stroke="#e9c98a" stroke-width="1.6"/>
  <path d="M190 330V300M180 300H200M230 330l14 -40l4 2l-10 38" fill="none" stroke="url(#${id}-g)" stroke-width="1.2" opacity=".7"/>
  ${[[372, 200], [430, 250], [395, 285], [452, 190], [360, 260]].map(([x, y]) => `<circle class="lx-mote" cx="${x}" cy="${y}" r="1.4" fill="#f6e3b0" opacity=".7"/>`).join("")}
  </g>
</svg>`;
}
/** A wide band in gold. The engraved copy carries the line the spotlight uncovers. */
function band(id: string, engraved: boolean) {
  return `<svg viewBox="0 0 400 160" class="lx-band" aria-hidden="true">${GOLD(id, 400)}
  <path id="${id}-p" d="M30 96C130 58 270 58 370 96" fill="none"/>
  <path d="M30 78C130 40 270 40 370 78V112C270 74 130 74 30 112Z" fill="url(#${id}-g)" opacity="${engraved ? 1 : 0.5}"/>
  ${engraved ? `<text font-family="var(--font-cormorant), serif" font-style="italic" font-size="17" letter-spacing="2.5" fill="#4a3518"><textPath href="#${id}-p" startOffset="50%" text-anchor="middle">Pour toujours · A &amp; L · 2026</textPath></text>` : ""}
</svg>`;
}

const LUX_PIECES: Array<[string, string, string, (id: string) => string]> = [
  ["Bague Aube", "Yellow gold, old-cut diamond", "€ 4 800", (id) => ring(id)],
  ["Pendentif Midi", "Rose gold, pear-cut sapphire", "€ 3 200", pendant],
  ["Boucles Soir", "White gold, freshwater pearls", "€ 2 650", earrings],
];
const LUX_GALLERY: Array<[string, string, (id: string) => string]> = [
  ["I", "Aube", (id) => ring(id)],
  ["II", "Midi", pendant],
  ["III", "Soir", earrings],
  ["IV", "Nuit", (id) => ring(id)],
  ["V", "Retour", pendant],
];

// Slow and exact. The ring draws itself in gold, its facets catch the light, a sheen crosses the stone;
// lines rise from behind masks on long expo curves; a picture opens from a slit; a pinned gallery moves
// sideways; a spotlight finds the engraving. Its own page, typeset in Cormorant and Jost.
const luxury = vibe("luxury", {
  copy: { brand: "", links: ["", ""], kicker: "", head: "", sub: "", cta: "", cards: [], quote: "", foot: "" },
  move: { duration: 2.4, ease: "expo.inOut" },
  nav: [".v-cards", ".v-curtain"],
  page: `<header class="v-nav"><b class="v-brand">Maison Orée</b><span class="v-links"><a href="#v">Collection</a><a href="#v">Atelier</a></span></header>
    <section class="v-hero lx-hero">
      <div class="lx-copy"><p class="v-kicker">Collection Nº 7 · Lumière</p><h3 class="v-head">Quiet light, <em>finished by hand.</em></h3><p class="v-sub">Each piece is cast, set, and polished in our Paris atelier, in editions of twelve.</p><button type="button" class="v-btn">Discover the collection</button></div>
      <div class="lx-hero-art">${ring("lxh", true)}</div>
    </section>
    <section class="v-cards">${LUX_PIECES.map(([name, made, price, art], i) => `<article class="v-card"><span class="v-art"><i data-parallax="-18">${art(`lxc${i}`)}</i></span><b>${name}</b><span class="v-meta">${made}</span><span class="lx-price">${price}</span></article>`).join("")}</section>
    <section class="v-curtain"><div class="v-curtain-img"><i>${atelier("lxa")}</i></div><p class="v-caption">The atelier on rue Saint-Honoré, at first light</p></section>
    <section class="v-run"><div class="v-run-track">${LUX_GALLERY.map(([n, name, art], i) => `<figure class="v-panel"><i>${art(`lxg${i}`)}</i><figcaption><span>${n}</span>${name}</figcaption></figure>`).join("")}</div></section>
    <section class="v-detail"><p class="v-kicker">Engraving</p><div class="v-spot" tabindex="0" aria-label="The band, engraved: Pour toujours, A and L, 2026"><div class="v-spot-base">${band("lxb", false)}</div><div class="v-spot-reveal">${band("lxr", true)}</div></div><p class="v-caption">Every band carries a line of your choosing. Hold a finger or move the pointer over it.</p></section>
    <section class="v-quote"><p>What is made slowly is worn for a lifetime.</p></section>
    <footer class="v-foot">Maison Orée · 214 rue Saint-Honoré, Paris · By appointment</footer>`,
  intro: (p, tl) => {
    const s = split(p.head, "lines", "lines");
    const hero = one(p.win, ".lx-hero-art svg");
    const lines = all(hero, ".lx-line");
    const facets = all(hero, ".lx-facet");
    const fill = one(hero, ".lx-fill");
    const sheen = one(hero, ".lx-sheen");
    const glints = all(hero, ".lx-glint");
    gsap.set(glints, { transformOrigin: "50% 50%", scale: 0 });
    tl.from(p.nav, { autoAlpha: 0, duration: 1.6, ease: "power2.out", stagger: 0.2 }, 0)
      // The ring draws itself in gold, band first, then the setting and the stone.
      .fromTo(lines, { drawSVG: "0%" }, { drawSVG: "100%", duration: 2.2, ease: "power2.inOut", stagger: 0.18 }, 0.2)
      .from(fill, { opacity: 0, duration: 1.6, ease: "power1.out" }, 1.2)
      .from(facets, { opacity: 0, duration: 1.2, ease: "power1.out" }, 1.6)
      .from(p.kicker, { autoAlpha: 0, y: 10, duration: 2, ease: "expo.out" }, 0.3)
      .from(s.lines, { yPercent: 110, duration: 1.8, ease: "expo.out", stagger: 0.2 }, 0.6)
      .from(p.sub, { autoAlpha: 0, duration: 1.6, ease: "power2.out" }, 1.5)
      .from(p.btn, { autoAlpha: 0, y: 8, duration: 1.4, ease: "expo.out" }, 1.9)
      // Light catches the stone: one sheen across it, then the glints turn on and off.
      .fromTo(sheen, { x: 0 }, { x: 300, duration: 1.8, ease: "power2.inOut" }, 2.4)
      .to(glints, { scale: 1, rotation: 45, duration: 0.5, ease: "power2.out", stagger: 0.25, yoyo: true, repeat: 1, repeatDelay: 0.2 }, 3.0);
    return () => {
      s.revert();
      gsap.set([...lines, ...facets, fill, sheen, ...glints], { clearProps: "all" });
    };
  },
  wire: (p) => [
    (() => {
      // Scrubbed: the picture opens from a slit in the middle and settles from a slight zoom.
      const box = one(p.win, ".v-curtain-img");
      const tween = gsap.fromTo(
        box,
        { clipPath: "inset(0% 48% 0% 48%)" },
        { clipPath: "inset(0% 0% 0% 0%)", ease: "power2.inOut", scrollTrigger: { trigger: box, scroller: p.win, start: "top 90%", end: "center 55%", scrub: 1.2 } },
      );
      const zoom = gsap.fromTo(one(box, "i"), { scale: 1.25 }, { scale: 1, ease: "none", scrollTrigger: { trigger: box, scroller: p.win, start: "top 90%", end: "bottom top", scrub: 1.2 } });
      // Dawn comes up as you pass: the beam brightens and dust drifts upward in it.
      const dawn = gsap.timeline({ scrollTrigger: { trigger: box, scroller: p.win, start: "top 70%", end: "bottom top", scrub: 1.6 } })
        .fromTo(one(box, ".lx-beam"), { opacity: 0.2 }, { opacity: 1, ease: "none" }, 0)
        .fromTo(all(box, ".lx-mote"), { y: 0 }, { y: -40, ease: "none", stagger: 0.04 }, 0);
      return () => {
        dawn.scrollTrigger?.kill();
        dawn.kill();
        gsap.set([one(box, ".lx-beam"), ...all(box, ".lx-mote")], { clearProps: "all" });
        tween.scrollTrigger?.kill();
        tween.kill();
        zoom.scrollTrigger?.kill();
        zoom.kill();
        gsap.set([box, one(box, "i")], { clearProps: "all" });
      };
    })(),
    // Discover: a long, slow glide to the pieces.
    cta(p, p.cardsSection, { duration: 2.4, ease: "expo.inOut" }),
    horizontalRun(one(p.win, ".v-run"), one(p.win, ".v-run-track"), { scroller: p.win, scrub: 1.2 }).revert,
    spotlight(one(p.win, ".v-spot"), one(p.win, ".v-spot-reveal"), { radius: 130, follow: 0.6, touch: true }),
    revealOnScroll(p.cards, { scroller: p.win, y: 12, duration: 1.6, stagger: 0.3, ease: "expo.out" }),
    scrubStatement(p.quote, { by: "words", scroller: p.win, scrub: 1.6 }),
    parallax(p.cardsSection, { scroller: p.win }),
    underlineSweep(p.btn, { touch: true }),
    ...p.cards.map((c) => imageZoom(c, { image: one<HTMLElement>(c, ".v-art i"), scale: 1.08, duration: 1.4, touch: true })),
  ],
});

/* ---------- Snappy ---------- */

const SN_TAG: Record<string, string> = { Docs: "#7c5cff", Web: "#0055ff", API: "#00a870", Bug: "#ff4d4f" };
const snTask = (name: string, tag: string, who: string, cls = "") =>
  `<div class="sn-task${cls}"><span>${name}</span><span class="sn-row"><i class="sn-tag" style="--c:${SN_TAG[tag]}">${tag}</i><i class="sn-who">${who}</i></span></div>`;
const SN_FEATURES: Array<[string, string, string]> = [
  ["Keyboard first", "Every action has a shortcut. ⌘K finds the rest.", `<span class="sn-keys"><kbd>⌘</kbd><kbd>K</kbd></span><span class="sn-palette"><span>Move to Done</span><span>Assign to me</span><span>Set due Friday</span></span>`],
  ["Live everywhere", "Changes land on every screen in under 50 ms.", `<span class="sn-avatars"><i>PR</i><i>MK</i><i>JS</i></span><span class="sn-live"><b></b>3 editing now</span>`],
  ["Notes that write themselves", "Finished tasks become release notes for Friday.", `<span class="sn-notes"><span>✓ Faster search</span><span>✓ Dark mode</span><span>✓ CSV export</span></span>`],
];

// Fast and sure: everything slides a short way in a quarter second on a hard ease-out, the board fills
// at once, and a task moves itself to Done. Labels roll on hover; every press answers instantly. Geist.
const snappy = vibe("snappy", {
  copy: { brand: "", links: ["", ""], kicker: "", head: "", sub: "", cta: "", cards: [], quote: "", foot: "" },
  move: { duration: 0.35, ease: "power3.out" },
  nav: [".v-plans", ".v-cards"],
  page: `<header class="v-nav"><b class="v-brand"><i class="sn-mark" aria-hidden="true"></i>Tasko</b><span class="v-links"><a href="#v"><span data-roll-label>Pricing</span></a><a href="#v"><span data-roll-label>Features</span></a></span></header>
    <section class="v-hero sn-hero">
      <div class="sn-copy"><p class="v-kicker"><b>New</b> Tasko 3 is out. See what changed</p><h3 class="v-head">Plan Monday. <span>Ship Friday.</span></h3><p class="v-sub">The task board for small teams who would rather be shipping. Keyboard first, instant everywhere.</p><div class="sn-ctas"><button type="button" class="v-btn"><span data-roll-label>Start free</span></button><span class="sn-note">No card. Ten seats free.</span></div></div>
      <div class="sn-board" aria-hidden="true">
        <div class="sn-col"><p>To do <i>3</i></p>${snTask("Write launch post", "Docs", "PR")}${snTask("Fix Safari tab focus", "Bug", "MK")}${snTask("Rate limit export", "API", "JS")}</div>
        <div class="sn-col"><p>Doing <i>2</i></p>${snTask("New pricing page", "Web", "PR", " sn-mover")}${snTask("Webhooks v2", "API", "JS")}</div>
        <div class="sn-col sn-done"><p>Done <i>1</i></p>${snTask("Search in 40 ms", "API", "MK", " is-done")}</div>
      </div>
    </section>
    <p class="sn-logos">Used by teams at <b>Northwind</b><b>Halcyon</b><b>Fieldnote</b><b>Parallel</b><b>Kiln</b></p>
    <section class="v-cards">${SN_FEATURES.map(([t, m, art]) => `<article class="v-card"><span class="v-art"><i data-parallax="-10">${art}</i></span><b>${t}</b><span class="v-meta">${m}</span></article>`).join("")}</section>
    <section class="v-plans"><p class="v-kicker">Pricing</p><div class="v-tablist" role="tablist" aria-label="Billing">${["Monthly", "Yearly", "Team"].map((t, i) => `<button type="button" role="tab" aria-selected="${i === 0}">${t}</button>`).join("")}<span class="v-tab-ind" aria-hidden="true"></span></div><p class="v-price"><b>$8</b> <span>per seat, per month</span></p><ul class="sn-perks"><li>Unlimited boards and tasks</li><li>⌘K for everything</li><li>Release notes from Done</li></ul><button type="button" class="v-state"><span data-state-label>Upgrade</span></button></section>
    <section class="v-tasks"><p class="v-kicker">Today. Drag to reorder</p><p id="v-sort-help" hidden>Press Space to pick up, arrow keys to move, Space to drop.</p><ol class="v-sort">${[["Write the launch post", "Docs"], ["Review the new pricing page", "Web"], ["Ship Webhooks v2", "API"], ["Reply to Sam about SSO", "Bug"]].map(([n, tag]) => `<li data-sortable-item><button type="button" class="v-handle" data-sortable-handle aria-describedby="v-sort-help" aria-label="Move ${n}">⠿</button><span data-sortable-name>${n}</span><i class="sn-tag" style="--c:${SN_TAG[tag!]}">${tag}</i></li>`).join("")}</ol></section>
    <section class="v-stats">${[["4200", "teams shipping"], ["38", "ms median sync"], ["99.98", "% uptime"]].map(([n, l]) => `<p><b data-count="${n}">0</b><span>${l}</span></p>`).join("")}</section>
    <section class="v-quote"><p>We moved the whole sprint over on a Friday. By Monday nobody remembered the old tool.</p><span class="sn-cite">Priya Raman, engineering lead at Northwind</span></section>
    <footer class="v-foot"><span>© 2026 Tasko</span><span class="sn-status"><b></b>All systems normal</span></footer>`,
  intro: (p, tl) => {
    const s = split(p.head, "words");
    const board = one(p.win, ".sn-board");
    const cols = all(board, ".sn-col");
    const tasks = all(board, ".sn-task");
    const mover = one(board, ".sn-mover");
    const from = mover.parentElement!;
    const done = one(board, ".sn-done");
    const counts = all(board, ".sn-col > p i");
    tl.from([...p.nav, p.kicker], { autoAlpha: 0, x: -16, duration: 0.25, ease: "power3.out", stagger: 0.02 }, 0)
      .from(s.words, { autoAlpha: 0, x: -24, duration: 0.3, ease: "power4.out", stagger: 0.04 }, 0.05)
      .from([p.sub, one(p.win, ".sn-ctas")], { autoAlpha: 0, x: -16, duration: 0.25, ease: "power3.out", stagger: 0.03 }, 0.15)
      .from(board, { autoAlpha: 0, y: 16, duration: 0.3, ease: "power3.out" }, 0.1)
      .from(cols, { autoAlpha: 0, duration: 0.2, ease: "power2.out", stagger: 0.04 }, 0.2)
      .from(tasks, { autoAlpha: 0, x: -12, duration: 0.25, ease: "power3.out", stagger: 0.03 }, 0.25)
      // A beat later, a task finishes itself: it jumps to Done, the counts change, and it ticks green.
      .call(() => {
        const state = Flip.getState(mover);
        done.querySelector("p")!.after(mover);
        mover.classList.add("is-done");
        counts[1]!.textContent = "1";
        counts[2]!.textContent = "2";
        Flip.from(state, { duration: prefersReducedMotion() ? 0 : 0.35, ease: "power3.out" });
      }, undefined, 1.3);
    return () => {
      s.revert();
      from.querySelector("p")!.after(mover);
      mover.classList.remove("is-done");
      counts[1]!.textContent = "2";
      counts[2]!.textContent = "1";
      gsap.set([board, ...cols, ...tasks], { clearProps: "all" });
    };
  },
  wire: (p) => [
    (() => {
      const list = one(p.win, ".v-tablist");
      const tabs = all(list, "[role=tab]");
      const price = one(p.win, ".v-price b");
      const per = one(p.win, ".v-price span");
      const prices: Array<[string, string]> = [["$8", "per seat, per month"], ["$80", "per seat, per year"], ["$24", "per month, up to 10 seats"]];
      const ind = tabIndicator(one(p.win, ".v-tab-ind"), list, { duration: 0.2 });
      ind.moveTo(tabs[0]!);
      const pick = (e: Event) => {
        const i = tabs.indexOf(e.currentTarget as HTMLElement);
        tabs.forEach((t, j) => t.setAttribute("aria-selected", String(i === j)));
        ind.moveTo(tabs[i]!);
        [price.textContent, per.textContent] = prices[i]!;
        if (!prefersReducedMotion()) gsap.fromTo(price, { yPercent: 40, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.18, ease: "power3.out" });
      };
      tabs.forEach((t) => t.addEventListener("click", pick));
      const state = one(p.win, ".v-state");
      const sb = stateButton(state, { hold: 1 });
      let busy = false;
      let timer = 0;
      const upgrade = () => {
        if (busy) return;
        busy = true;
        sb.loading();
        timer = window.setTimeout(() => sb.success("Upgraded").eventCallback("onComplete", () => (busy = false)), 600);
      };
      state.addEventListener("click", upgrade);
      const sorter = sortable(one(p.win, ".v-sort"), { lift: 1.02, grab: "item" });
      const counts = all(p.win, "[data-count]");
      const counted = onView(one(p.win, ".v-stats"), p.win, () =>
        counts.forEach((el) => {
          const to = Number(el.dataset.count);
          const decimals = el.dataset.count!.includes(".") ? 2 : 0;
          gsap.fromTo({ v: 0 }, { v: 0 }, { v: to, duration: prefersReducedMotion() ? 0 : 0.6, ease: "power3.out", onUpdate() {
            el.textContent = (this.targets()[0] as { v: number }).v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
          } });
        }),
      );
      return () => {
        tabs.forEach((t) => t.removeEventListener("click", pick));
        state.removeEventListener("click", upgrade);
        clearTimeout(timer);
        counted.kill();
        sorter.revert();
        sb.revert();
        ind.revert();
      };
    })(),
    // Start free: straight to the plans, in a third of a second.
    cta(p, one(p.win, ".v-plans"), { duration: 0.35, ease: "power3.out" }),
    revealOnScroll(p.cards, { scroller: p.win, y: 16, duration: 0.3, stagger: 0.03, ease: "power3.out" }),
    scrubStatement(p.quote, { by: "words", scroller: p.win, scrub: 0.2 }),
    pressFeedback(p.btn, { squash: 0.95, ripple: false }),
    textRoll(p.btn, { touch: true }),
    ...all(p.win, ".v-links a").map((a) => textRoll(a, { touch: true })),
  ],
});

/* ---------- Glitch ---------- */

/** A small seeded random, so the corrupted portraits come out the same on every visit. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** A halftone head and shoulders, sliced into bands that slip sideways, with a few bars of noise. */
function portrait(id: string, seed: number) {
  const r = seeded(seed);
  const bands = Array.from({ length: 9 }, (_, i) => {
    const y = i * (150 / 9);
    const dx = r() < 0.45 ? Math.round((r() - 0.5) * 36) : 0;
    return `<clipPath id="${id}-b${i}"><rect y="${y}" width="200" height="${150 / 9 + 0.5}"/></clipPath><use href="#${id}-s" clip-path="url(#${id}-b${i})" transform="translate(${dx} 0)"/>`;
  }).join("");
  const noise = Array.from({ length: 5 }, () => `<rect x="${Math.round(r() * 160)}" y="${Math.round(r() * 140)}" width="${Math.round(20 + r() * 70)}" height="${1 + Math.round(r() * 3)}" fill="${r() < 0.5 ? "#ff2bd6" : "#00e5ff"}"/>`).join("");
  return `<svg viewBox="0 0 200 150" class="gl-portrait" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs><pattern id="${id}-d" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="#39ff14"/></pattern>
  <g id="${id}-s"><circle cx="${96 + r() * 8}" cy="62" r="30" fill="url(#${id}-d)"/><path d="M40 150C44 112 70 98 100 98C130 98 156 112 160 150Z" fill="url(#${id}-d)"/></g></defs>
  <rect width="200" height="150" fill="#0d0d0d"/>${bands}${noise}
</svg>`;
}
const GL_LINEUP: Array<[string, string, number]> = [
  ["KAI/0", "live · 23:00", 4],
  ["Static Mother", "dj · 01:30", 11],
  ["Low Orbit", "a/v set · 03:00", 27],
];
const CHARS_GLITCH = "01#$%&*/<>";

// Broken on purpose: the headline decodes from noise and tears into color, a roll bar sweeps the screen,
// things blink on in hard steps, the countdown scrambles each tick. VT323 and JetBrains Mono.
const glitchy = vibe("glitchy", {
  copy: { brand: "", links: ["", ""], kicker: "", head: "", sub: "", cta: "", cards: [], quote: "", foot: "" },
  move: { duration: 0.45, ease: "steps(6)" },
  nav: [".v-cards", ".gl-tickets"],
  page: `<header class="v-nav"><b class="v-brand">NULL//SET</b><span class="v-links"><a href="#v">Lineup</a><a href="#v">Tickets</a></span></header>
    <section class="v-hero gl-hero">
      <i class="gl-roll" aria-hidden="true"></i>
      <p class="v-kicker">&gt; transmission 04 // sat 14 nov</p>
      <div class="gl-title"><h3 class="v-head">Signal lost.</h3><span class="gl-ghost c1" aria-hidden="true">Signal lost.</span><span class="gl-ghost c2" aria-hidden="true">Signal lost.</span></div>
      <p class="v-sub">Seven hours of broken techno in a disused print works. Bring nothing you would miss.</p>
      <p class="gl-meta"><span>Warehouse 9, Berlin</span><span>23:00 until the signal dies</span></p>
      <button type="button" class="v-btn">Get tickets</button>
    </section>
    <section class="v-cards">${GL_LINEUP.map(([name, meta, seed], i) => `<article class="v-card"><span class="v-art"><i>${portrait(`glp${i}`, seed)}</i></span><b>${name}</b><span class="v-meta">${meta}</span></article>`).join("")}</section>
    <section class="v-count"><p class="v-kicker">&gt; doors open in</p><p class="v-clock">00:59:59</p></section>
    <section class="v-marquee" aria-hidden="true"><div class="v-marquee-track">${"SIGNAL LOST // NO CARRIER // TUNE IN // ".repeat(4)}</div></section>
    <p class="v-ambient"><button type="button" class="v-pause">Pause</button></p>
    <section class="gl-tickets"><p class="v-kicker">&gt; tickets</p><ul>
      <li class="is-sold"><span>Early signal</span><b>€18</b><em>Sold out</em></li>
      <li><span>Standard</span><b>€24</b><button type="button" class="gl-buy">Reserve</button></li>
      <li><span>Late / door</span><b>€30</b><button type="button" class="gl-buy">Reserve</button></li>
    </ul></section>
    <section class="v-quote"><p>The night is a broken signal. Tune in anyway.</p></section>
    <footer class="v-foot"><span>NULL//SET</span><span>No photos on the floor</span></footer>`,
  intro: (p, tl) => {
    const head = p.head.textContent ?? "";
    const kicker = p.kicker.textContent ?? "";
    const ghosts = all(p.win, ".gl-ghost");
    const roll = one(p.win, ".gl-roll");
    tl.from(p.nav, { autoAlpha: 0, duration: 0.4, ease: "steps(4)", stagger: 0.1 }, 0)
      // A bright roll bar sweeps down the screen once, like a tube warming up.
      .fromTo(roll, { yPercent: -100, autoAlpha: 1 }, { yPercent: 900, duration: 1.1, ease: "none" }, 0)
      .set(roll, { autoAlpha: 0 })
      .fromTo(p.kicker, { text: "" }, { text: kicker, duration: 0.8, ease: "none" }, 0.1)
      .fromTo(p.head, { scrambleText: { text: "", chars: CHARS_GLITCH, speed: 0.6 } }, { scrambleText: { text: head, chars: CHARS_GLITCH, speed: 0.6 }, duration: 1.4, ease: "none" }, 0.3)
      // Then it tears: the color layers jump out of register in hard steps and snap back.
      .add(tear(ghosts, p.head), 1.75)
      .from([p.sub, one(p.win, ".gl-meta"), p.btn], { autoAlpha: 0, duration: 0.5, ease: "steps(5)", stagger: 0.15 }, 1.3);
    return () => {
      p.head.textContent = head;
      p.kicker.textContent = kicker;
      gsap.set([...ghosts, roll, p.head], { clearProps: "all" });
    };
  },
  wire: (p, layer) => {
    const quote = p.quote.textContent ?? "";
    const ghosts = all(p.win, ".gl-ghost");
    // The statement decodes as it scrolls into view, and again whenever it comes back.
    const decode = () => gsap.to(p.quote, { scrambleText: { text: quote, chars: CHARS_GLITCH, speed: 0.5 }, duration: 1.2, ease: "none", overwrite: true });
    const st = ScrollTrigger.create({ trigger: p.quoteSection, scroller: p.win, start: "top 75%", onEnter: decode, onEnterBack: decode });
    // The title tears again under the pointer or a tap.
    const title = one(p.win, ".gl-title");
    const again = () => !prefersReducedMotion() && tear(ghosts, p.head);
    title.addEventListener("pointerenter", again);
    title.addEventListener("pointerdown", again);
    const jitter = () => {
      if (prefersReducedMotion()) return;
      gsap.fromTo(p.btn, { x: 0, skewX: 0 }, { keyframes: { x: [-4, 3, -2, 2, 0], skewX: [8, -6, 4, 0, 0] }, duration: 0.3, ease: "steps(5)", overwrite: true });
    };
    p.btn.addEventListener("pointerenter", jitter);
    p.btn.addEventListener("pointerdown", jitter);
    // Nav links scramble when the pointer finds them.
    const links = all(p.win, ".v-links a");
    const scrambleLink = (e: Event) => {
      const a = e.currentTarget as HTMLElement;
      if (prefersReducedMotion()) return;
      gsap.to(a, { scrambleText: { text: a.dataset.text ?? a.textContent ?? "", chars: CHARS_GLITCH, speed: 0.8 }, duration: 0.5, overwrite: true });
    };
    links.forEach((a) => {
      a.dataset.text = a.textContent ?? "";
      a.addEventListener("pointerenter", scrambleLink);
    });
    // Portraits tear on hover: the picture jumps sideways in hard steps.
    const tears = p.cards.map((c) => {
      const art = one(c, ".v-art i");
      const go = () => !prefersReducedMotion() && gsap.fromTo(art, { x: 0, skewX: 0 }, { keyframes: { x: [12, -18, 6, -4, 0], skewX: [-14, 10, -6, 2, 0] }, duration: 0.35, ease: "steps(5)", overwrite: true });
      c.addEventListener("pointerenter", go);
      c.addEventListener("pointerdown", go);
      return () => {
        c.removeEventListener("pointerenter", go);
        c.removeEventListener("pointerdown", go);
        gsap.set(art, { clearProps: "transform" });
      };
    });
    // Reserve: the label decodes to a confirmation, once.
    const buys = all(p.win, ".gl-buy").map((b) => {
      const label = b.textContent ?? "";
      const buy = () => {
        if (b.getAttribute("aria-disabled") === "true") return;
        b.setAttribute("aria-disabled", "true");
        gsap.to(b, { scrambleText: { text: "Reserved", chars: CHARS_GLITCH, speed: 0.8 }, duration: prefersReducedMotion() ? 0 : 0.6, ease: "none" });
      };
      b.addEventListener("click", buy);
      return () => {
        b.removeEventListener("click", buy);
        gsap.killTweensOf(b);
        b.textContent = label;
        b.removeAttribute("aria-disabled");
      };
    });
    // The countdown ticks once a second; each tick scrambles the digits it changes.
    const clock = one(p.win, ".v-clock");
    let left = 59 * 60 + 59;
    const fmt = (s: number) => `00:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    const tick = gsap.timeline({ repeat: -1 }).call(() => {
      left = left > 0 ? left - 1 : 59 * 60 + 59;
      gsap.to(clock, { scrambleText: { text: fmt(left), chars: "0123456789", speed: 1, revealDelay: 0.1 }, duration: 0.35, ease: "none", overwrite: true });
    }).to({}, { duration: 1 });
    // The marquee runs and flickers in steps.
    const track = one(p.win, ".v-marquee-track");
    const run = gsap.to(track, { xPercent: -50, duration: 14, ease: "none", repeat: -1 });
    const flicker = gsap.to(track, { opacity: 0.35, duration: 0.12, ease: "steps(1)", repeat: -1, yoyo: true, repeatDelay: 1.7 });
    const loops = ambient(one(p.win, ".v-pause"), [tick, run, flicker]);
    // Get tickets: a jump to the tickets in six hard steps.
    const enter = cta(p, one(p.win, ".gl-tickets"), { duration: 0.45, ease: "steps(6)" });
    // A trail of symbols behind the pointer, or a finger dragging over the page, over the whole stage.
    const glyphs = document.createElement("div");
    glyphs.className = "v-glyphs";
    glyphs.setAttribute("aria-hidden", "true");
    layer.append(glyphs);
    let last = 0;
    const trail = (e: PointerEvent) => {
      if (prefersReducedMotion() || (e.pointerType !== "mouse" && e.buttons === 0) || e.timeStamp - last < 45) return;
      last = e.timeStamp;
      const g = document.createElement("span");
      g.textContent = CHARS_GLITCH[Math.floor(Math.random() * CHARS_GLITCH.length)]!;
      const box = layer.getBoundingClientRect();
      glyphs.append(g);
      gsap.fromTo(
        g,
        { x: e.clientX - box.left, y: e.clientY - box.top, opacity: 1 },
        { y: `+=${gsap.utils.random(20, 50)}`, opacity: 0, duration: 0.7, ease: "steps(6)", onComplete: () => g.remove() },
      );
      while (glyphs.children.length > 24) glyphs.firstElementChild?.remove();
    };
    p.win.addEventListener("pointermove", trail);
    return [
      () => {
        links.forEach((a) => {
          a.removeEventListener("pointerenter", scrambleLink);
          gsap.killTweensOf(a);
          a.textContent = a.dataset.text ?? a.textContent;
          delete a.dataset.text;
        });
        tears.forEach((off) => off());
        buys.forEach((off) => off());
        enter();
        loops();
        gsap.killTweensOf(clock);
        p.win.removeEventListener("pointermove", trail);
        glyphs.remove();
        title.removeEventListener("pointerenter", again);
        title.removeEventListener("pointerdown", again);
      },
      () => {
        st.kill();
        gsap.killTweensOf(p.quote);
        p.quote.textContent = quote;
        p.btn.removeEventListener("pointerenter", jitter);
        p.btn.removeEventListener("pointerdown", jitter);
        gsap.set(p.btn, { clearProps: "transform" });
      },
      revealOnScroll(p.cards, { scroller: p.win, y: 0, duration: 0.5, stagger: 0.12, ease: "steps(5)" }),
      pressFeedback(p.btn, { squash: 0.96, ink: 0.4 }),
    ];
  },
});

/* ---------- Printed ---------- */

// Riso inks: a fluorescent pink and a blue, printed one plate at a time on warm paper. The pink plate
// multiplies over the blue, as the inks do, so where they cross they make a deep violet.
const RISO_PINK = "#ff48b0";
const RISO_BLUE = "#0078bf";
const PAPER = "#f3ede0";
/** A dot screen, the texture of a riso tone. */
const dots = (id: string, color: string, gap = 7) =>
  `<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(22)"><circle cx="${gap / 2}" cy="${gap / 2}" r="${gap * 0.3}" fill="${color}"/></pattern>`;
/** One two-color print: the blue plate, then the pink plate over it in its own layer, so each can be inked alone. */
const riso = (id: string, blue: string, pink: string) =>
  `<svg class="hm-plate" viewBox="0 0 300 380" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${dots(`${id}-b`, RISO_BLUE)}</defs>${blue.replaceAll("DOTS", `url(#${id}-b)`)}</svg>` +
  `<div class="hm-pink"><svg class="hm-plate" viewBox="0 0 300 380" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${dots(`${id}-p`, RISO_PINK, 6)}</defs>${pink.replaceAll("DOTS", `url(#${id}-p)`)}</svg></div>`;
const HM_ART: Record<string, [string, string]> = {
  moon: [
    `<path d="M0 260C60 220 110 236 160 214C210 192 250 210 300 196V380H0Z" fill="DOTS"/><path d="M0 300C70 276 130 300 190 286C240 274 270 280 300 272V380H0Z" fill="${RISO_BLUE}"/><text x="24" y="356" fill="${PAPER}" font-family="var(--font-bowlby), Impact, sans-serif" font-size="30" letter-spacing="1">PAPER MOON</text>`,
    `<circle cx="188" cy="118" r="70" fill="${RISO_PINK}"/><circle cx="96" cy="70" r="5" fill="${RISO_PINK}"/><circle cx="54" cy="128" r="3" fill="${RISO_PINK}"/><circle cx="262" cy="52" r="4" fill="${RISO_PINK}"/><path d="M0 238C80 222 140 246 210 230C250 222 280 228 300 224V258C240 268 180 250 110 266C60 276 30 268 0 272Z" fill="DOTS"/>`,
  ],
  bus: [
    `<rect x="30" y="150" width="240" height="120" rx="18" fill="${RISO_BLUE}"/>${[0, 1, 2, 3].map((i) => `<rect x="${46 + i * 54}" y="168" width="42" height="40" rx="4" fill="${PAPER}"/>`).join("")}<circle cx="86" cy="276" r="20" fill="${RISO_BLUE}"/><circle cx="214" cy="276" r="20" fill="${RISO_BLUE}"/><rect y="296" width="300" height="84" fill="DOTS"/>`,
    `<circle cx="230" cy="80" r="40" fill="${RISO_PINK}"/>${[0, 1, 2, 3].map((i) => `<rect x="${46 + i * 54}" y="168" width="42" height="40" rx="4" fill="DOTS"/>`).join("")}<rect x="30" y="226" width="240" height="10" fill="${RISO_PINK}"/>`,
  ],
  fern: [
    `<path d="M150 360C150 260 140 160 120 40" fill="none" stroke="${RISO_BLUE}" stroke-width="6"/>${Array.from({ length: 9 }, (_, i) => `<ellipse cx="${150 - i * 3.4 + (i % 2 ? 40 : -40)}" cy="${330 - i * 32}" rx="${44 - i * 3}" ry="12" transform="rotate(${i % 2 ? -28 : 28} ${150 - i * 3.4 + (i % 2 ? 40 : -40)} ${330 - i * 32})" fill="${RISO_BLUE}"/>`).join("")}`,
    `<rect width="300" height="380" fill="DOTS"/><circle cx="70" cy="300" r="46" fill="${RISO_PINK}"/>`,
  ],
  stars: [
    `<rect width="300" height="380" fill="${RISO_BLUE}"/>${Array.from({ length: 22 }, (_, i) => `<circle cx="${(i * 97) % 280 + 10}" cy="${(i * 61) % 300 + 12}" r="${1.5 + (i % 3)}" fill="${PAPER}"/>`).join("")}`,
    `<path d="M150 70L170 140L240 150L184 190L204 262L150 220L96 262L116 190L60 150L130 140Z" fill="${RISO_PINK}"/><rect y="300" width="300" height="80" fill="DOTS"/>`,
  ],
  hand: [
    `<path d="M110 360V210C110 196 130 196 130 210V120C130 104 152 104 152 120V200V100C152 84 174 84 174 100V200V114C174 98 196 98 196 114V220V160C196 146 216 146 216 160V270C216 320 190 360 150 360Z" fill="${RISO_BLUE}"/>`,
    `<circle cx="150" cy="150" r="110" fill="DOTS"/><path d="M40 40L90 40M40 52L76 52" stroke="${RISO_PINK}" stroke-width="6"/>`,
  ],
};
const HM_ZINES: Array<[string, string, string, string]> = [
  ["Night Bus", "Zine · 24 pages · edition of 150", "$12", "bus"],
  ["Fern Study", "Zine · 16 pages · edition of 100", "$10", "fern"],
  ["Small Hours", "Zine · 20 pages · edition of 120", "$12", "stars"],
];
const HM_RACK = ["hand", "stars", "fern", "moon"];

// Ink and paper: the headline inks on and its second plate slips into register, the hero print is brushed
// on and then gets its pink, covers print as they scroll in, prints peel off a drying rack,
// and a note is written by hand. Bowlby One, IBM Plex Mono, and Caveat for the hand.
const printed = vibe("printed", {
  copy: { brand: "", links: ["", ""], kicker: "", head: "", sub: "", cta: "", cards: [], quote: "", foot: "" },
  move: { duration: 1.1, ease: "power3.inOut" },
  nav: [".v-cards", ".hm-rack"],
  page: `<header class="v-nav"><b class="v-brand">Paper Moon Press</b><span class="v-links"><a href="#v">Zines</a><a href="#v">Drying rack</a></span></header>
    <section class="v-hero hm-hero">
      <div class="hm-copy"><p class="v-kicker">Risograph studio · Leeds</p><h3 class="v-head">Printed by hand, two colors at a time.</h3><p class="v-sub">Zines, posters, and small runs, inked one plate at a time on a drum that smells faintly of soy.</p><button type="button" class="v-btn">See the drying rack</button></div>
      <figure class="hm-print hm-sheet" role="img" aria-label="A riso print of a pink moon over blue hills">${riso("hmh", ...HM_ART.moon!)}</figure>
    </section>
    <section class="hm-zines"><h4 class="hm-title">This season’s zines</h4><div class="v-cards">${HM_ZINES.map(([name, meta, price, art], i) => `<article class="v-card"><span class="v-art hm-sheet">${riso(`hmz${i}`, ...HM_ART[art]!)}</span><a href="#v" class="hm-name">${name}</a><span class="v-meta">${meta}</span><span class="hm-price">${price}</span></article>`).join("")}</div></section>
    <section class="hm-rack"><h4 class="hm-title">The drying rack</h4><p class="hm-hint">Grab a print anywhere and pull it off the rack. Or press Enter on it.</p><div class="hm-stack">${HM_RACK.map((art, i) => `<div class="hm-slot"><figure class="hm-sheet hm-rack-sheet" tabindex="-1" aria-label="Print ${HM_RACK.length - i} of ${HM_RACK.length}: drag or press Enter to pull it off">${riso(`hmr${i}`, ...HM_ART[art]!)}</figure></div>`).join("")}</div><button type="button" class="hm-restack">Hang them back up</button></section>
    <section class="hm-note"><div class="hm-card"><p class="hm-hand">Open studio every Thursday. Bring a drawing, leave with fifty prints. Wear something you don’t mind getting pink.</p><p class="hm-sign">Mo &amp; Iris</p></div></section>
    <section class="v-quote"><p>Every copy comes out a little different. That’s the point.</p></section>
    <footer class="v-foot"><span>Paper Moon Press</span><span>Unit 4, Sovereign Street, Leeds</span></footer>`,
  intro: (p, tl) => {
    // The pink plate is down; the black inks on over it, then the pink slides into register.
    const slip = registrationSlip(p.head, { ink: RISO_PINK, x: 10, y: 5, duration: 0.6 });
    const ink = inkText([p.head], { duration: 1 });
    const sheet = one(p.win, ".hm-print");
    const pink = one(sheet, ".hm-pink");
    // Build the pink plate's mask first, so it stays hidden while the blue is brushed on.
    const second = inkText([pink], { duration: 1.2, direction: "down" });
    const first = paintReveal(sheet, { paper: PAPER, duration: 1.8 });
    tl.from(p.nav, { autoAlpha: 0, y: -8, duration: 0.4, ease: "power2.out", stagger: 0.06 }, 0)
      .from(p.kicker, { autoAlpha: 0, duration: 0.4 }, 0.1)
      .add(ink.timeline, 0.2)
      .add(slip.timeline, 1.2)
      .add(first.timeline, 0.3)
      .add(second.timeline, 1.6)
      .from(p.sub, { autoAlpha: 0, y: 10, duration: 0.5, ease: "power2.out" }, 0.9)
      .from(p.btn, { autoAlpha: 0, y: 10, duration: 0.5, ease: "back.out(1.8)" }, 1.1);
    return () => [slip, ink, first, second].forEach((e) => e.revert());
  },
  wire: (p) => {
    const offs: Array<() => void> = [];
    // Each cover prints as it scrolls in: its blue plate brushed on, then its pink.
    const covers = p.cards.map((card, i) => {
      const art = one(card, ".v-art");
      const pink = inkText([one(art, ".hm-pink")], { duration: 0.9, direction: "down" });
      const blue = paintReveal(art, { paper: PAPER, duration: 1.2, direction: i % 2 ? "down" : "right" });
      const tl = gsap.timeline({ paused: true }).add(blue.timeline, 0).add(pink.timeline, 0.8);
      return { tl, revert: () => [blue, pink].forEach((e) => e.revert()) };
    });
    const printing = onView(p.cardsSection, p.win, () => covers.forEach((c, i) => gsap.delayedCall(i * 0.25, () => c.tl.play())), "top 75%");
    offs.push(() => {
      printing.kill();
      covers.forEach((c) => {
        gsap.killTweensOf(c.tl.play);
        c.tl.kill();
        c.revert();
      });
    });
    // The section titles slip into register as they arrive.
    const titles = all(p.win, ".hm-title").map((title) => {
      let run: { revert: () => void } | undefined;
      const st = onView(title, p.win, () => {
        run = registrationSlip(title, { ink: RISO_PINK, x: -8, y: 4, duration: 0.6 });
      }, "top 85%");
      return () => {
        st.kill();
        run?.revert();
      };
    });
    offs.push(...titles);
    // A cover slips out of register under the pointer or focus, and back.
    p.cards.forEach((card) => {
      const pink = one(card, ".hm-pink");
      const shift = () => !prefersReducedMotion() && gsap.to(pink, { x: 5, y: -3, duration: 0.25, ease: "power2.out", overwrite: true });
      const back = () => gsap.to(pink, { x: 0, y: 0, duration: 0.35, ease: "back.out(3)", overwrite: true });
      const events: Array<[string, () => void]> = [["pointerenter", shift], ["pointerleave", back], ["focusin", shift], ["focusout", back]];
      events.forEach(([e, f]) => card.addEventListener(e, f));
      offs.push(() => {
        events.forEach(([e, f]) => card.removeEventListener(e, f));
        gsap.killTweensOf(pink);
        gsap.set(pink, { clearProps: "transform" });
      });
    });
    // The drying rack: the top print peels off under the hand, showing the next.
    const sheets = all(p.win, ".hm-rack-sheet");
    const restack = one(p.win, ".hm-restack");
    let pulls: Pull[] = [];
    let drags: Array<() => void> = [];
    const arm = (index: number) => {
      sheets.forEach((sheet, i) => {
        sheet.tabIndex = i === index ? 0 : -1;
        sheet.style.pointerEvents = i === index ? "auto" : "none";
      });
      if (index < 0) return;
      const sheet = sheets[index]!;
      const pull = pullCorner(sheet, { back: PAPER });
      pulls.push(pull);
      drags.push(
        dragPull(sheet, pull, {
          onPulled: () => {
            sheet.style.visibility = "hidden";
            arm(index - 1);
            (index > 0 ? sheets[index - 1]! : restack).focus({ preventScroll: true });
          },
        }),
      );
    };
    const clear = () => {
      drags.forEach((off) => off());
      pulls.forEach((pull) => pull.revert());
      drags = [];
      pulls = [];
      sheets.forEach((sheet) => sheet.style.removeProperty("visibility"));
    };
    const hang = () => {
      clear();
      arm(sheets.length - 1);
      if (!prefersReducedMotion()) gsap.from(sheets.map((s) => s.parentElement!), { y: -30, autoAlpha: 0, duration: 0.5, ease: "back.out(1.6)", stagger: 0.06, clearProps: "transform,opacity,visibility" });
    };
    arm(sheets.length - 1);
    restack.addEventListener("click", hang);
    offs.push(() => {
      restack.removeEventListener("click", hang);
      gsap.killTweensOf(sheets.map((s) => s.parentElement!));
      clear();
    });
    // The note is written by hand as it comes into view, then the signature. The masks are built now,
    // paused, so the note starts hidden: built on view, the finished note would show for a moment first.
    const hand = writeOn(one(p.win, ".hm-hand"), { duration: 2.4 });
    const name = writeOn(one(p.win, ".hm-sign"), { duration: 0.6 });
    hand.timeline.pause(0);
    name.timeline.pause(0);
    hand.timeline.eventCallback("onComplete", () => name.timeline.play());
    const writing = onView(one(p.win, ".hm-note"), p.win, () => hand.timeline.play(), "top 70%");
    offs.push(() => {
      writing.kill();
      hand.revert();
      name.revert();
    });
    // The statement inks on as its words come into view: one mask over the whole paragraph, built now and
    // paused for the same reason. Split into lines, the words would wrap differently from the resting text.
    const inked = inkText([p.quote], { duration: 1.4, direction: "right" });
    inked.timeline.pause(0);
    const quoteSt = onView(p.quote, p.win, () => inked.timeline.play(), "top 85%");
    offs.push(() => {
      quoteSt.kill();
      inked.revert();
    });
    return [
      ...offs,
      cta(p, one(p.win, ".hm-rack"), { duration: 1.1, ease: "power3.inOut" }),
      revealOnScroll(p.cards, { scroller: p.win, y: 18, duration: 0.5, stagger: 0.1, ease: "back.out(1.4)" }),
      pressFeedback(p.btn, { squash: 0.96, ink: 0.25 }),
    ];
  },
});

/* ---------- Liquid ---------- */

// After the Living Exhibition poster: ivory and black, a liquid-chrome sculpture with the sky showing
// through a window in it, a big serif title, and four arched works. The sculpture, the sky, and the
// handwriting are that poster's own images; the works are its artwork.
const LQ = "/vibes/liquid";
const LQ_WORKS: Array<[string, string, string]> = [
  ["117934", "Soft Assembly", "Form Practice"],
  ["117627", "Odd Company", "Form Practice"],
  ["117491", "Everyday Orbit", "Orbit Office"],
  ["119952", "Big Little Things", "Paper Social"],
  ["120476", "Aftertone", "Sine Workshop"],
  ["119861", "Low Frequency", "Sine Workshop"],
  ["117905", "Echo Season", "Interval Press"],
  ["116131", "Night Signal", "Interval Press"],
  ["118887", "Salt Horizon", "Tide Office"],
  ["120116", "Painted Quarter", "Block Studios"],
  ["116698", "Moss House", "Block Studios"],
  ["117780", "Stillwater", "Tide Office"],
];
/** Where the ink pours from: the seam behind the sculpture, as a fraction of the poster's width. */
const LQ_SEAM = 0.41;
/** The black field's leading edge at `p`, 0 at the seam and 1 past the right edge: a slow wave, not a straight line. */
const lqInk = (p: number, time: number) => {
  const x = (y: number) => (LQ_SEAM + (1.06 - LQ_SEAM) * p) * 100 + Math.sin(y * 7 + time * 3) * 2.2 * (1 - p);
  const edge = Array.from({ length: 17 }, (_, i) => `${x(i / 16).toFixed(1)}% ${((i / 16) * 100).toFixed(1)}%`);
  return `polygon(0% 0%, ${edge.join(", ")}, 0% 100%)`;
};

// Liquid, after a living poster, built on the vibes' own frame: a nav, a hero, three works, a signature
// section, a statement, a footer. Ink floods out from behind a liquid-chrome sculpture, the chrome pours in,
// and its window opens onto the sky. Works pour into view through a wobbling blob, and a chosen one pours
// into the sculpture's window. The water section ripples under the hand. Links draw a bead into a line,
// the button wobbles like jelly, and the arrows fill like a glass.
const liquid = vibe("liquid", {
  copy: { brand: "", links: ["", ""], kicker: "", head: "", sub: "", cta: "", cards: [], quote: "", foot: "" },
  lenis: { lerp: 0.07 },
  move: { duration: 1.4, ease: "power3.inOut" },
  nav: [".v-cards", ".lq-water"],
  page: `<header class="v-nav"><b class="v-brand"><span>Living</span> <span>Exhibition</span></b><span class="v-links"><a href="#v">Works</a><a href="#v">Water</a></span></header>
    <section class="v-hero lq-hero">
      <div class="lq-copy"><p class="v-kicker">An exhibition of imaginary projects</p><h3 class="v-head"><span class="lq-word">Websites</span> <span class="lq-word">breathe too.</span></h3><p class="v-sub">An experimental design festival where the identity evolves with the work on display.</p><button type="button" class="v-btn lq-pill"><span class="lq-pill-label">See the works</span> <span class="lq-pill-arrow" aria-hidden="true">→</span></button><p class="lq-echo" aria-live="polite"></p></div>
      <div class="lq-frame" aria-hidden="true"><div class="lq-plate">
        <div class="lq-ink"><div class="lq-field"></div></div>
        <div class="lq-opening"><img class="lq-sky" src="${LQ}/opening-sky.webp" alt=""><img class="lq-sky lq-hung" alt="" hidden></div>
        <div class="lq-chrome"><img src="${LQ}/chrome.webp" alt=""></div>
        <img class="lq-hand" src="${LQ}/handwriting.webp" alt="">
      </div></div>
    </section>
    <section class="lq-works"><p class="v-kicker">On view this week</p><div class="v-cards">${LQ_WORKS.slice(0, 3).map(([id, title, by]) => `<article class="v-card"><button type="button" class="lq-work" data-work="${id}" aria-label="Hang ${title} in the window"><span class="lq-arch"><img src="${LQ}/${id}.svg" alt=""></span></button><span class="lq-row"><span><b>${title}</b><span class="v-meta">by ${by}</span></span><a href="#v" class="lq-go" aria-label="${title}, by ${by}"><i class="lq-fill" aria-hidden="true"></i><span aria-hidden="true">→</span></a></span></article>`).join("")}</div></section>
    <section class="lq-water"><p class="v-kicker">The water</p><figure class="lq-pool"><img alt="A still sea at dusk under a soft pink sky" src="${LQ}/opening-sky.webp"></figure><p class="v-caption">Stir it with the pointer, or a held finger.</p></section>
    <section class="v-quote"><p>A website is a living thing. It should move like one.</p></section>
    <footer class="v-foot"><span>Living Exhibition</span><span>Projects and studios are fictional.</span></footer>`,
  intro: (p, tl) => {
    const all2 = (sel: string) => all(p.win, sel);
    const ink = one(p.win, ".lq-ink");
    const chrome = one(p.win, ".lq-chrome");
    const sky = one(p.win, ".lq-sky:not(.lq-hung)");
    const opening = one(p.win, ".lq-opening");
    const pill = p.btn;
    const brand = all2(".v-brand span");
    // The chrome pours in from the seam, the way the poster's sculpture forms.
    const pour = pourReveal(chrome, { origin: [0.42, 0.62], duration: 1.5, from: 1.06 });
    const flood = { p: 0 };
    const box = pill.getBoundingClientRect();
    const circle = box.width ? ((box.width - box.height) / box.width) * 100 : 0;
    tl.from(brand, { y: 10, clipPath: "inset(0% 0% 100% 0%)", duration: 0.7, ease: "power3.out", stagger: 0.08 }, 0)
      .from(p.nav.filter((n) => n.tagName === "A"), { autoAlpha: 0, y: -8, duration: 0.5, ease: "power3.out", stagger: 0.07 }, 0.1)
      // The ink floods out from the seam to the frame's right edge, its front a slow wave.
      .fromTo(flood, { p: 0 }, { p: 1, duration: 1.1, ease: "power1.inOut", onUpdate: () => (ink.style.clipPath = lqInk(flood.p, tl.time())), onComplete: () => ink.style.removeProperty("clip-path") }, 0.2)
      .add(pour.timeline, 0.1)
      // The window opens onto the sky as the chrome settles.
      .fromTo(opening, { clipPath: "circle(0% at 41% 36%)" }, { clipPath: "circle(75% at 41% 36%)", duration: 1.2, ease: "power2.inOut" }, 1.0)
      .fromTo(sky, { scale: 1.14 }, { scale: 1, duration: 1.6, ease: "power2.out" }, 1.0)
      .from(p.kicker, { autoAlpha: 0, y: 10, duration: 0.6, ease: "power3.out" }, 0.9)
      .fromTo(all2(".lq-word"), { y: 28, clipPath: "inset(0% 0% 100% 0%)" }, { y: 0, clipPath: "inset(0% 0% -20% 0%)", duration: 0.85, ease: "power3.out", stagger: 0.1 }, 1.1)
      .from(p.sub, { autoAlpha: 0, y: 12, duration: 0.7, ease: "power3.out" }, 1.5)
      // The pill grows out of the circle around its arrow, which appears first.
      .fromTo(pill, { autoAlpha: 0, scale: 0.6, clipPath: `inset(0% 0% 0% ${circle}% round 999px)` }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: "back.out(2)", transformOrigin: "100% 50%" }, 1.6)
      .to(pill, { clipPath: "inset(0% 0% 0% 0% round 999px)", duration: 0.85, ease: "expo.inOut" }, 1.85)
      .from(one(pill, ".lq-pill-label"), { autoAlpha: 0, x: -12, duration: 0.5, ease: "power3.out" }, 2.2)
      // Written on, left to right, once the chrome it sits on has settled.
      .fromTo(one(p.win, ".lq-hand"), { clipPath: "inset(-5% 100% -5% 0%)" }, { clipPath: "inset(-5% 0% -5% 0%)", duration: 1.3, ease: "power1.inOut" }, 2.0);
    return () => {
      pour.revert();
      ink.style.removeProperty("clip-path");
      gsap.set([opening, sky, ...brand, ...all2(".lq-word, .lq-hand, .lq-pill-label"), ...p.nav, p.kicker, p.sub, pill], { clearProps: "transform,opacity,visibility,clipPath" });
    };
  },
  wire: (p) => {
    // The sky drifts a little with the pointer, as if the window were deep. Mouse only.
    const skies = all(p.win, ".lq-frame .lq-sky");
    const toX = gsap.quickTo(skies, "xPercent", { duration: 1.2, ease: "power3.out" });
    const toY = gsap.quickTo(skies, "yPercent", { duration: 1.2, ease: "power3.out" });
    const drift = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || prefersReducedMotion()) return;
      const box = p.win.getBoundingClientRect();
      toX(((e.clientX - box.left) / box.width - 0.5) * -6);
      toY(((e.clientY - box.top) / box.height - 0.5) * -4);
    };
    p.win.addEventListener("pointermove", drift);
    // The works pour into view through a wobbling blob as they scroll in, one after another.
    const arches = all(p.win, ".lq-arch");
    const pours = arches.map((a, i) => {
      const r = pourReveal(a, { origin: [0.5, 0.95], duration: 1.1, from: 1.1 });
      r.timeline.pause(0);
      return { r, i };
    });
    const shown = onView(p.cardsSection, p.win, () => pours.forEach(({ r, i }) => gsap.delayedCall(i * 0.18, () => r.timeline.play())), "top 75%");
    // Choose a work and the page glides up to the sculpture, and the work pours into its window. The same
    // work again, or Escape, lets the sky back.
    const hung = one<HTMLImageElement>(p.win, ".lq-hung");
    const echo = one(p.win, ".lq-echo");
    let hanging = "";
    let into: ReturnType<typeof pourReveal> | undefined;
    const sky = () => {
      into?.revert();
      into = undefined;
      hanging = "";
      echo.textContent = "";
      gsap.to(hung, { autoAlpha: 0, duration: 0.5, ease: "power2.out", onComplete: () => void (hung.hidden = true) });
    };
    const hang = (e: Event) => {
      const work = e.currentTarget as HTMLElement;
      const id = work.dataset.work!;
      if (id === hanging) return sky();
      into?.revert();
      hanging = id;
      hung.src = `${LQ}/${id}.svg`;
      hung.hidden = false;
      gsap.set(hung, { autoAlpha: 1 });
      echo.textContent = `Now in the window: ${work.closest(".v-card")?.querySelector("b")?.textContent ?? ""}`;
      // The window's own liquid: the work pours in through a blob from the window's foot. Built now, paused,
      // so the work starts hidden; it plays once the page has glided up to the window.
      into = pourReveal(hung, { origin: [0.5, 0.92], duration: 1.1, from: 1.12 });
      const pourIn = into.timeline.pause(0);
      scrollWin(p.win, one(p.win, ".lq-hero"), { duration: 0.9, ease: "power3.inOut" }, () => void pourIn.play());
    };
    const works = all(p.win, ".lq-work");
    works.forEach((w) => w.addEventListener("click", hang));
    const escape = (e: KeyboardEvent) => e.key === "Escape" && hanging && sky();
    p.win.addEventListener("keydown", escape);
    // The water: the picture ripples under the hand, and one stroke pours across it as it scrolls in.
    const water = liquidImage(one<HTMLImageElement>(p.win, ".lq-pool img"), { touch: true, clip: p.win });
    water.uniforms.uStrength.value = 0.1;
    let gone = false;
    const stirred = onView(one(p.win, ".lq-water"), p.win, () => water.view.ready.then((drawn) => {
      if (drawn && !gone) water.pour({ duration: 1.8 });
    }), "top 55%");
    return [
      () => {
        gone = true;
        p.win.removeEventListener("pointermove", drift);
        gsap.killTweensOf([...skies, hung]);
        gsap.set(skies, { clearProps: "transform" });
        shown.kill();
        pours.forEach(({ r }) => r.revert());
        works.forEach((w) => w.removeEventListener("click", hang));
        p.win.removeEventListener("keydown", escape);
        into?.revert();
        stirred.kill();
        water.revert();
      },
      cta(p, p.cardsSection, { duration: 1.4, ease: "power3.inOut" }),
      jelly(p.btn, { highlight: "rgb(255 255 255 / 0.4)", touch: true }),
      ...all(p.win, ".v-links a").map((a) => beadUnderline(a, { bead: 5, thickness: 1, touch: true })),
      ...all(p.win, ".lq-go").map((a) => pourFill(a, one(a, ".lq-fill"), { touch: true })),
      scrubStatement(p.quote, { by: "words", scroller: p.win, scrub: 1.2 }),
      pressFeedback(p.btn, { squash: 0.97, ink: 0.15 }),
    ];
  },
});

/* ---------- Immersive ---------- */

// Orion, in the -1 to 1 box: its stars with their brightness, and the lines between them.
const ORION_STARS: Array<[number, number, number]> = [
  [-0.42, 0.78, 1], [0.38, 0.7, 0.75], // Betelgeuse, Bellatrix
  [-0.12, 0.05, 0.6], [0.0, 0.0, 0.65], [0.12, -0.05, 0.6], // the belt
  [-0.36, -0.72, 0.7], [0.46, -0.66, 1], // Saiph, Rigel
  [-0.02, 0.98, 0.35], [0.03, -0.32, 0.4], // head, sword
];
const ORION_LINES: Array<[number, number]> = [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 7], [1, 7], [3, 8]];
/** Orion as points: a bright knot for each star, a faint thread along each line, and stray dust around them. */
function orionShape(count = 5000) {
  const out: number[] = [];
  const random = (() => {
    let s = 41;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  const gauss = () => (random() + random() + random() - 1.5) * 0.8;
  const push = (x: number, y: number) => out.push(x, y, (random() - 0.5) * 0.1);
  const stars = Math.round(count * 0.5);
  const weight = ORION_STARS.reduce((sum, [, , b]) => sum + b, 0);
  ORION_STARS.forEach(([x, y, b]) => {
    const n = Math.round((stars * b) / weight);
    for (let i = 0; i < n; i++) push(x + gauss() * 0.035 * (0.6 + b), y + gauss() * 0.035 * (0.6 + b));
  });
  const thread = Math.round((count * 0.38) / ORION_LINES.length);
  ORION_LINES.forEach(([a, b]) => {
    const [x1, y1] = ORION_STARS[a]!;
    const [x2, y2] = ORION_STARS[b]!;
    for (let i = 0; i < thread; i++) {
      const k = random();
      push(x1 + (x2 - x1) * k + gauss() * 0.006, y1 + (y2 - y1) * k + gauss() * 0.006);
    }
  });
  while (out.length / 3 < count) push((random() - 0.5) * 2.2, (random() - 0.5) * 2.2);
  return new Float32Array(out);
}
/** The same chart, drawn: the poster without WebGL and under reduced motion. */
const ORION_SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.1 -1.1 2.2 2.2"><g transform="scale(1,-1)"><g stroke="#e8ecf7" stroke-opacity=".45" stroke-width=".008">${ORION_LINES.map(([a, b]) => `<line x1="${ORION_STARS[a]![0]}" y1="${ORION_STARS[a]![1]}" x2="${ORION_STARS[b]![0]}" y2="${ORION_STARS[b]![1]}"/>`).join("")}</g>${ORION_STARS.map(([x, y, s]) => `<circle cx="${x}" cy="${y}" r="${0.018 + s * 0.022}" fill="#e8ecf7"/>`).join("")}</g></svg>`,
)}`;

/** A painted body of the sky, as a data URL a WebGL texture can read: planets, a moon, nebulae, a galaxy. */
function skyPicture(kind: string, seed: number): string {
  const c = document.createElement("canvas");
  [c.width, c.height] = [640, 480];
  const x = c.getContext("2d")!;
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  x.fillStyle = "#05060d";
  x.fillRect(0, 0, 640, 480);
  for (let i = 0; i < 260; i++) {
    x.fillStyle = `rgba(232,236,247,${0.2 + r() * 0.7})`;
    x.fillRect(r() * 640, r() * 480, r() < 0.9 ? 1 : 2, r() < 0.9 ? 1 : 2);
  }
  const glow = (cx: number, cy: number, rad: number, color: string) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(5,6,13,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 640, 480);
  };
  const sphere = (cx: number, cy: number, rad: number, light: string, dark: string) => {
    const g = x.createRadialGradient(cx - rad * 0.4, cy - rad * 0.4, rad * 0.1, cx, cy, rad);
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, rad, 0, Math.PI * 2);
    x.fill();
  };
  if (kind === "moon") {
    sphere(320, 240, 150, "#f1efe6", "#5d5b57");
    for (let i = 0; i < 18; i++) {
      x.fillStyle = `rgba(60,58,55,${0.15 + r() * 0.25})`;
      x.beginPath();
      x.arc(220 + r() * 200, 140 + r() * 200, 6 + r() * 22, 0, Math.PI * 2);
      x.fill();
    }
  } else if (kind === "saturn") {
    x.save();
    x.translate(320, 240);
    x.rotate(-0.35);
    x.strokeStyle = "rgba(243,194,107,0.55)";
    x.lineWidth = 18;
    x.beginPath();
    x.ellipse(0, 0, 230, 60, 0, Math.PI, Math.PI * 2);
    x.stroke();
    sphere(0, 0, 110, "#f6dfa8", "#8a5a24");
    x.beginPath();
    x.ellipse(0, 0, 230, 60, 0, 0, Math.PI);
    x.stroke();
    x.restore();
  } else if (kind === "nebula" || kind === "veil") {
    const tints = kind === "nebula" ? ["rgba(255,120,170,0.55)", "rgba(120,140,255,0.5)", "rgba(243,194,107,0.4)"] : ["rgba(90,220,210,0.45)", "rgba(160,110,255,0.45)", "rgba(255,150,120,0.35)"];
    for (let i = 0; i < 14; i++) glow(140 + r() * 360, 100 + r() * 280, 80 + r() * 160, tints[i % 3]!);
    glow(320, 240, 60, "rgba(255,255,255,0.7)");
  } else if (kind === "galaxy") {
    for (let i = 0; i < 2600; i++) {
      const arm = i % 2;
      const t = r() * 5.5;
      const rad = t * 38;
      const a = t + arm * Math.PI + (r() - 0.5) * 0.5;
      x.fillStyle = `rgba(${200 + r() * 55},${200 + r() * 40},255,${0.25 + r() * 0.5})`;
      x.fillRect(320 + Math.cos(a) * rad * 1.3, 240 + Math.sin(a) * rad * 0.55, 1.6, 1.6);
    }
    glow(320, 240, 80, "rgba(255,240,210,0.9)");
  } else {
    // A planet with bands, clipped to its disc.
    sphere(320, 240, 140, ["#9ec5ff", "#ffb48a", "#c8f0d8"][seed % 3]!, "#1b2240");
    x.save();
    x.beginPath();
    x.arc(320, 240, 140, 0, Math.PI * 2);
    x.clip();
    x.globalAlpha = 0.22;
    for (let i = 0; i < 6; i++) {
      x.fillStyle = i % 2 ? "#ffffff" : "#05060d";
      x.fillRect(180, 150 + i * 30, 280, 10);
    }
    x.restore();
  }
  return c.toDataURL("image/jpeg", 0.86);
}
const IM_TONIGHT: Array<[string, string, string]> = [
  ["moon", "The Moon", "Rises 18:42 · 3 days past full"],
  ["saturn", "Saturn", "South at 21:10 · rings open"],
  ["nebula", "The Orion Nebula", "After midnight · bring the big scope"],
];
const IM_FLIGHT = ["galaxy", "nebula", "planet", "veil", "moon", "saturn", "planet", "galaxy", "veil", "planet"];

// Deep and slow: dust drifts into a constellation that parts around the pointer, and a scroll flies a camera
// through a spiral of the sky's pictures, leaning with the mouse. Space Grotesk on a night-blue field.
const immersive = vibe("immersive", {
  copy: { brand: "", links: ["", ""], kicker: "", head: "", sub: "", cta: "", cards: [], quote: "", foot: "" },
  lenis: { lerp: 0.06 },
  move: { duration: 1.8, ease: "power2.inOut" },
  nav: [".v-cards", ".im-flight"],
  page: `<header class="v-nav"><b class="v-brand"><i class="im-dot" aria-hidden="true"></i>Halcyon Observatory</b><span class="v-links"><a href="#v">Tonight</a><a href="#v">The flight</a></span></header>
    <section class="v-hero im-hero">
      <div class="im-copy"><p class="v-kicker">Open nights · every clear Friday</p><h3 class="v-head"><span class="im-line">Look up.</span> <span class="im-line">Keep looking.</span></h3><p class="v-sub">A public observatory on the ridge above town. Bring a coat. We bring the telescopes.</p><button type="button" class="v-btn">Plan a visit</button></div>
      <figure class="im-sky" aria-label="The constellation Orion, drawn in points of light"><img data-poster alt="" src="${ORION_SVG}"></figure>
    </section>
    <section class="im-tonight"><p class="v-kicker">Tonight’s sky</p><div class="v-cards">${IM_TONIGHT.map(([kind, name, meta]) => `<article class="v-card"><span class="v-art"><img data-sky="${kind}" alt="${name}"></span><b>${name}</b><span class="v-meta">${meta}</span></article>`).join("")}</div></section>
    <section class="im-flight"><div class="im-pin"><figure class="im-view" aria-label="A flight through ten pictures of the night sky"><img data-poster alt=""></figure><p class="v-caption">Scroll to fly. Move the mouse to look around.</p></div></section>
    <section class="v-quote"><p>Every photon you see tonight left its star before you were born.</p></section>
    <footer class="v-foot"><span>Halcyon Observatory</span><span>Ridge Road · Fridays from dusk</span></footer>`,
  intro: (p, tl) => {
    const lines = all(p.win, ".im-line");
    tl.from(p.nav, { autoAlpha: 0, duration: 1, ease: "power2.out", stagger: 0.12 }, 0)
      .from(p.kicker, { autoAlpha: 0, y: 10, duration: 1, ease: "power3.out" }, 0.3)
      .fromTo(lines, { yPercent: 100, clipPath: "inset(0% 0% 100% 0%)" }, { yPercent: 0, clipPath: "inset(0% 0% -10% 0%)", duration: 1.2, ease: "expo.out", stagger: 0.16 }, 0.5)
      .from(p.sub, { autoAlpha: 0, y: 12, duration: 1, ease: "power3.out" }, 1.0)
      .from(p.btn, { autoAlpha: 0, y: 10, duration: 0.9, ease: "power3.out" }, 1.2);
    return () => gsap.set([...lines, ...p.nav, p.kicker, p.sub, p.btn], { clearProps: "transform,opacity,visibility,clipPath" });
  },
  wire: (p, layer) => {
    // The pictures are painted here, in the browser, so the flight's textures and the cards share them.
    const pictures = new Map<string, string>();
    const picture = (kind: string, seed: number) => {
      const key = `${kind}-${seed}`;
      if (!pictures.has(key)) pictures.set(key, skyPicture(kind, seed));
      return pictures.get(key)!;
    };
    all(p.win, "[data-sky]").forEach((img, i) => ((img as HTMLImageElement).src = picture(img.dataset.sky!, i + 1)));
    const flightImages = IM_FLIGHT.map((kind, i) => picture(kind, i + 4));
    one<HTMLImageElement>(p.win, ".im-view img").src = flightImages[0]!;
    // Hero: dust scattered across the frame gathers into Orion, then parts around the pointer.
    const sky = one(p.win, ".im-sky");
    const dust = particleMorph(sky, { shapes: [scatterShape(5000, 1.2), orionShape(5000)], count: 5000, size: 2, fill: 0.84, poster: one<HTMLImageElement>(sky, "img"), clip: p.win });
    const push = pointerPush(dust, { touch: true, strength: 0.8 });
    let gone = false;
    const gather = () =>
      dust.view.ready.then((drawn) => {
        if (!drawn || gone) return;
        dust.uniforms.uShape.value = 0;
        dust.to(1, { duration: 3.2, ease: "power2.inOut" });
      });
    gather();
    const replay = layer.querySelector(".v-replay");
    replay?.addEventListener("click", gather);
    // The flight: the page scrolls a camera down a spiral of the sky's pictures while the view holds still.
    const view = one(p.win, ".im-view");
    const ride = flight(view, { images: flightImages, fog: 22, poster: one<HTMLImageElement>(view, "img"), clip: p.win });
    const travel = scrollFlight(ride, { trigger: one(p.win, ".im-flight"), scroller: p.win, start: "top top", end: "bottom bottom", scrub: 1 });
    const lean = pointerLean(ride);
    return [
      () => {
        gone = true;
        replay?.removeEventListener("click", gather);
        travel();
        lean();
        ride.revert();
        push();
        dust.revert();
      },
      cta(p, one(p.win, ".v-cards"), { duration: 1.8, ease: "power2.inOut" }),
      revealOnScroll(p.cards, { scroller: p.win, y: 30, duration: 1.4, stagger: 0.18, ease: "power3.out" }),
      ...p.cards.map((c) => imageZoom(c, { image: one<HTMLElement>(c, ".v-art img"), scale: 1.08, duration: 1.4, touch: true })),
      scrubStatement(p.quote, { by: "words", scroller: p.win, scrub: 1.4 }),
      ...all(p.win, ".v-links a").map((a) => underlineSweep(a, { touch: true })),
      pressFeedback(p.btn, { squash: 0.97, ink: 0.15 }),
    ];
  },
});

/** The title tears: magenta and cyan copies jump out of register in sliced bands, then snap back. */
function tear(ghosts: HTMLElement[], head: HTMLElement) {
  const slice = () => `inset(${gsap.utils.random(0, 70, 1)}% 0 ${gsap.utils.random(0, 70, 1)}% 0)`;
  return gsap
    .timeline()
    .to(ghosts, { keyframes: [0, 1, 2, 3, 4].map(() => ({ autoAlpha: 1, x: () => gsap.utils.random(-14, 14, 1), clipPath: slice, duration: 0.06 })), ease: "steps(1)" })
    .to(head, { keyframes: { x: [3, -4, 2, 0], skewX: [-6, 4, -2, 0] }, duration: 0.3, ease: "steps(4)" }, 0)
    .set(ghosts, { autoAlpha: 0, x: 0, clipPath: "inset(0% 0 0% 0)" });
}

export const VIBE_STAGES: Record<string, StageDef> = {
  calm,
  playful,
  luxury,
  snappy,
  glitchy,
  printed,
  liquid,
  immersive,
};
