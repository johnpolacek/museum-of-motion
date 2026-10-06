// Vibes: the collection's effects combined into one feeling. Each is a small site with its own look,
// built on one skeleton (nav, hero, button, cards, a statement, a footer) so the vibes compare cleanly.
// The skills supply the parts: revealOnScroll, scrubStatement, parallax, pressFeedback, the hover
// effects, confetti, and Lenis on the window. Each vibe chooses which, and tunes their curves and timing.
import { gsap, prefersReducedMotion, ScrollTrigger, SplitText } from "../gsap";
import { play, type StageDef } from "../stage-core";
import { windowed } from "./scroll";
import { parallax, revealOnScroll, scrubStatement } from "../recipes/scroll-effects";
import { pressFeedback } from "../recipes/press-feedback";
import { imageZoom, textRoll, underlineSweep } from "../recipes/hover-effects";
import { tilt } from "../recipes/pointer-effects";
import { burstFrom } from "../recipes/physics-effects";

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
  /** Builds the page's intro on `tl`. Returns its own undo, such as a split's revert. */
  intro: (page: Page, tl: gsap.core.Timeline) => () => void;
  /** Everything after the intro: scroll, press, hover. Returns teardowns. */
  wire: (page: Page, layer: HTMLElement) => Array<() => void>;
};

const one = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;
const all = (root: ParentNode, sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));

function markup({ brand, links, kicker, head, sub, cta, cards, quote, foot }: Copy) {
  return `<header class="v-nav"><b class="v-brand">${brand}</b><span class="v-links"><a href="#v">${links[0]}</a><a href="#v">${links[1]}</a></span></header>
    <section class="v-hero"><p class="v-kicker">${kicker}</p><h3 class="v-head">${head}</h3><p class="v-sub">${sub}</p><button type="button" class="v-btn"><span data-roll-label>${cta}</span></button></section>
    <section class="v-cards">${cards.map(([t, m]) => `<article class="v-card"><span class="v-art"><i data-parallax="-24"></i></span><b>${t}</b><span class="v-meta">${m}</span></article>`).join("")}</section>
    <section class="v-quote"><p>${quote}</p></section>
    <footer class="v-foot">${foot}</footer>`;
}

/** One vibe, as an exhibit: the page in a scrolling window, its intro, and a Replay control. */
function vibe(key: string, v: Vibe): StageDef {
  return play([key[0]!.toUpperCase() + key.slice(1)], [key], "Scroll the page. Press the button. Replay to see it arrive again.", (text) =>
    windowed(
      text,
      markup(v.copy),
      (win, layer) => {
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
        layer.append(replay);
        return [
          () => {
            replay.removeEventListener("click", again);
            replay.remove();
          },
          ...v.wire(page, layer),
          () => {
            tl?.kill();
            undo();
          },
        ];
      },
      `vibe vibe-${key}`,
    ),
  );
}

/** Splits for an intro, undone by the returned revert. */
const split = (el: HTMLElement, type: string, mask?: "lines" | "words" | "chars") => SplitText.create(el, { type, ...(mask ? { mask } : {}), aria: "auto" });

/* ---------- Calm ---------- */

// Slow and soft: long fades on gentle eases, words that drift up a little, nothing that bounces.
const calm = vibe("calm", {
  copy: {
    brand: "Stillwater",
    links: ["Practice", "Journal"],
    kicker: "Daily practice",
    head: "Breathe out.",
    sub: "Ten quiet minutes, every morning.",
    cta: "Begin",
    cards: [["Morning", "10 min"], ["Evening", "12 min"], ["Sleep", "20 min"]],
    quote: "Nothing to fix. Nowhere to be. Just this breath, and then the next.",
    foot: "Stillwater · a practice",
  },
  intro: (p, tl) => {
    const s = split(p.head, "words");
    tl.from(p.nav, { autoAlpha: 0, duration: 1.2, ease: "sine.out", stagger: 0.15 }, 0)
      .from(p.kicker, { autoAlpha: 0, y: 8, duration: 1.2, ease: "sine.out" }, 0.2)
      .from(s.words, { autoAlpha: 0, y: 20, duration: 1.6, ease: "power2.out", stagger: 0.25 }, 0.4)
      .from(p.sub, { autoAlpha: 0, duration: 1.4, ease: "sine.out" }, 1.0)
      .from(p.btn, { autoAlpha: 0, duration: 1.2, ease: "sine.out" }, 1.4);
    return () => s.revert();
  },
  wire: (p) => [
    revealOnScroll(p.cards, { scroller: p.win, y: 24, duration: 1.2, stagger: 0.2, ease: "power2.out" }),
    scrubStatement(p.quote, { by: "words", scroller: p.win, scrub: 1.2 }),
    parallax(p.cardsSection, { scroller: p.win }),
    pressFeedback(p.btn, { squash: 0.98, ink: 0.12 }),
    ...p.cards.map((c) => imageZoom(c, { image: one<HTMLElement>(c, ".v-art i"), scale: 1.04, duration: 1.2, touch: true })),
  ],
});

/* ---------- Playful ---------- */

// Bouncy and loud: letters pop in on elastic curves at odd angles, cards plop, the button squashes and
// throws confetti, cards tilt under the pointer.
const playful = vibe("playful", {
  copy: {
    brand: "Bloop!",
    links: ["Stickers", "Games"],
    kicker: "New!",
    head: "Make it pop.",
    sub: "Stickers, sounds, and a lot of bounce.",
    cta: "Let's go",
    cards: [["Boing", "level 1"], ["Wobble", "level 2"], ["Kaboom", "level 3"]],
    quote: "Every button deserves a little party.",
    foot: "Bloop! · made for fun",
  },
  intro: (p, tl) => {
    const s = split(p.head, "chars");
    tl.from(p.nav, { autoAlpha: 0, scale: 0, duration: 0.6, ease: "back.out(2.5)", stagger: 0.08 }, 0)
      .from(p.kicker, { autoAlpha: 0, scale: 0, rotation: -25, duration: 0.7, ease: "back.out(3)" }, 0.15)
      .from(s.chars, { autoAlpha: 0, scale: 0, yPercent: 60, rotation: () => gsap.utils.random(-40, 40), duration: 0.9, ease: "elastic.out(1, 0.45)", stagger: 0.05 }, 0.25)
      .from(p.sub, { autoAlpha: 0, y: 20, duration: 0.6, ease: "back.out(2)" }, 0.8)
      .from(p.btn, { autoAlpha: 0, scale: 0, duration: 0.9, ease: "elastic.out(1, 0.4)" }, 1.0);
    return () => s.revert();
  },
  wire: (p, layer) => {
    const confetti = () =>
      burstFrom(one(layer, ".v-burst"), p.btn, {
        pieces: ["#ff4f9a", "#3a5bff", "#1d1145", "#ffffff"].map((c) => {
          const s = document.createElement("span");
          s.className = "confetto";
          s.style.background = c;
          return s;
        }),
        count: 30,
      });
    const burst = document.createElement("div");
    burst.className = "v-burst";
    burst.setAttribute("aria-hidden", "true");
    layer.append(burst);
    p.btn.addEventListener("click", confetti);
    return [
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

// Slow and exact: lines rise from behind masks on long expo curves, a hairline draws, pictures drift
// with parallax and zoom slowly under the pointer, the call to action is an underlined word.
const luxury = vibe("luxury", {
  copy: {
    brand: "Maison Orée",
    links: ["Collection", "Atelier"],
    kicker: "Collection Nº 7",
    head: "Quiet light, finished by hand.",
    sub: "Made in small numbers, to be kept.",
    cta: "Discover",
    cards: [["Aube", "Nº 7.1"], ["Midi", "Nº 7.2"], ["Crépuscule", "Nº 7.3"]],
    quote: "What is made slowly is worn for a lifetime.",
    foot: "Maison Orée · Paris",
  },
  intro: (p, tl) => {
    const s = split(p.head, "lines", "lines");
    tl.from(p.nav, { autoAlpha: 0, duration: 1.6, ease: "power2.out", stagger: 0.2 }, 0)
      .from(p.kicker, { autoAlpha: 0, letterSpacing: "0.6em", duration: 2, ease: "expo.out" }, 0.2)
      .from(s.lines, { yPercent: 110, duration: 1.8, ease: "expo.out", stagger: 0.18 }, 0.5)
      .from(p.sub, { autoAlpha: 0, duration: 1.6, ease: "power2.out" }, 1.4)
      .from(p.btn, { autoAlpha: 0, y: 8, duration: 1.4, ease: "expo.out" }, 1.8);
    return () => s.revert();
  },
  wire: (p) => [
    revealOnScroll(p.cards, { scroller: p.win, y: 12, duration: 1.6, stagger: 0.3, ease: "expo.out" }),
    scrubStatement(p.quote, { by: "words", scroller: p.win, scrub: 1.6 }),
    parallax(p.cardsSection, { scroller: p.win }),
    underlineSweep(p.btn, { touch: true }),
    ...p.cards.map((c) => imageZoom(c, { image: one<HTMLElement>(c, ".v-art i"), scale: 1.08, duration: 1.4, touch: true })),
  ],
});

/* ---------- Snappy ---------- */

// Fast and sure: everything slides a short way in a quarter second, all at once, on a hard ease-out.
// Labels roll on hover; the button answers the press instantly.
const snappy = vibe("snappy", {
  copy: {
    brand: "Tasko",
    links: ["Pricing", "Docs"],
    kicker: "v3 is here",
    head: "Ship it today.",
    sub: "Plans, tasks, done. Fast.",
    cta: "Start free",
    cards: [["Plan", "2 min"], ["Track", "live"], ["Ship", "today"]],
    quote: "Less waiting. More done. Every click answers at once.",
    foot: "Tasko · ship faster",
  },
  intro: (p, tl) => {
    const s = split(p.head, "words");
    tl.from([...p.nav, p.kicker], { autoAlpha: 0, x: -16, duration: 0.25, ease: "power3.out", stagger: 0.02 }, 0)
      .from(s.words, { autoAlpha: 0, x: -24, duration: 0.3, ease: "power4.out", stagger: 0.04 }, 0.05)
      .from([p.sub, p.btn], { autoAlpha: 0, x: -16, duration: 0.25, ease: "power3.out", stagger: 0.03 }, 0.15);
    return () => s.revert();
  },
  wire: (p) => [
    revealOnScroll(p.cards, { scroller: p.win, y: 16, duration: 0.3, stagger: 0.03, ease: "power3.out" }),
    scrubStatement(p.quote, { by: "words", scroller: p.win, scrub: 0.2 }),
    pressFeedback(p.btn, { squash: 0.95, ripple: false }),
    textRoll(p.btn, { touch: true }),
    ...all(p.win, ".v-links a").map((a) => textRoll(a, { touch: true })),
  ],
});

/* ---------- Glitch ---------- */

// Broken on purpose: the headline decodes from noise, things blink on in hard steps, the statement
// scrambles as it scrolls in, and the button jitters under the pointer.
const glitchy = vibe("glitchy", {
  copy: {
    brand: "NULL//SET",
    links: ["Lineup", "Tickets"],
    kicker: "> transmission 04",
    head: "Signal lost.",
    sub: "Decoding the rest of the night.",
    cta: "Enter",
    cards: [["Static", "23:00"], ["Feedback", "01:30"], ["Noise", "03:00"]],
    quote: "The night is a broken signal. Tune in anyway.",
    foot: "NULL//SET · live",
  },
  intro: (p, tl) => {
    const head = p.head.textContent ?? "";
    const kicker = p.kicker.textContent ?? "";
    tl.from(p.nav, { autoAlpha: 0, duration: 0.4, ease: "steps(4)", stagger: 0.1 }, 0)
      .fromTo(p.kicker, { text: "" }, { text: kicker, duration: 0.8, ease: "none" }, 0.1)
      .fromTo(p.head, { scrambleText: { text: "", chars: "01#$%&*/<>", speed: 0.6 } }, { scrambleText: { text: head, chars: "01#$%&*/<>", speed: 0.6 }, duration: 1.4, ease: "none" }, 0.3)
      .from([p.sub, p.btn], { autoAlpha: 0, duration: 0.5, ease: "steps(5)", stagger: 0.15 }, 1.2);
    return () => {
      p.head.textContent = head;
      p.kicker.textContent = kicker;
    };
  },
  wire: (p) => {
    const quote = p.quote.textContent ?? "";
    // The statement decodes as it scrolls into view, and again whenever it comes back.
    const st = ScrollTrigger.create({
      trigger: p.quoteSection,
      scroller: p.win,
      start: "top 75%",
      onEnter: () => gsap.to(p.quote, { scrambleText: { text: quote, chars: "01#$%&*/<>", speed: 0.5 }, duration: 1.2, ease: "none", overwrite: true }),
      onEnterBack: () => gsap.to(p.quote, { scrambleText: { text: quote, chars: "01#$%&*/<>", speed: 0.5 }, duration: 1.2, ease: "none", overwrite: true }),
    });
    const jitter = () => {
      if (prefersReducedMotion()) return;
      gsap.fromTo(p.btn, { x: 0, skewX: 0 }, { keyframes: { x: [-4, 3, -2, 2, 0], skewX: [8, -6, 4, 0, 0] }, duration: 0.3, ease: "steps(5)", overwrite: true });
    };
    p.btn.addEventListener("pointerenter", jitter);
    p.btn.addEventListener("pointerdown", jitter);
    return [
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

export const VIBE_STAGES: Record<string, StageDef> = {
  calm,
  playful,
  luxury,
  snappy,
  glitchy,
};
