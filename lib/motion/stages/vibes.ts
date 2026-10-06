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
  /** Lenis feel for the window, such as a heavier `lerp` for a slower scroll. */
  lenis?: { lerp?: number; wheelMultiplier?: number };
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
function cta(p: Page, target: HTMLElement, move: { duration: number; ease: string; delay?: number }, then?: () => void): () => void {
  const go = () => {
    const y = target.getBoundingClientRect().top - p.win.getBoundingClientRect().top + p.win.scrollTop - 24;
    gsap.to(p.win, {
      scrollTo: { y, autoKill: true },
      duration: prefersReducedMotion() ? 0 : move.duration,
      delay: prefersReducedMotion() ? 0 : (move.delay ?? 0),
      ease: move.ease,
      overwrite: true,
      onComplete: then,
    });
  };
  p.btn.addEventListener("click", go);
  return () => {
    p.btn.removeEventListener("click", go);
    gsap.killTweensOf(p.win);
  };
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

/** One vibe, as an exhibit: the page in a scrolling window, its intro, and a Replay control. */
function vibe(key: string, v: Vibe): StageDef {
  return play([key[0]!.toUpperCase() + key.slice(1)], [key], "Scroll the page. Press the button. Replay to see it arrive again.", (text) =>
    windowed(
      text,
      markup(v.copy, v.extra),
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
      v.lenis,
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
  // A breathing guide and slow-fading color fields, both ambient, with one pause. A heavy, slow scroll,
  // and a soft dot that drifts after the pointer.
  extra: `<section class="v-breathe"><div class="v-orb" aria-hidden="true"></div><p class="v-orb-say">Breathe in</p></section>
    <section class="v-fields" aria-hidden="true"><i></i><i></i><i></i></section>
    <p class="v-ambient"><button type="button" class="v-pause">Pause</button></p>
    <i class="v-soft-cursor" aria-hidden="true"></i>`,
  lenis: { lerp: 0.045 },
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
    (() => {
      const orb = one(p.win, ".v-orb");
      const say = one(p.win, ".v-orb-say");
      // Four seconds in, a beat held, four seconds out: the pace of a calm breath.
      const breath = gsap
        .timeline({ repeat: -1, defaults: { ease: "sine.inOut" } })
        .call(() => (say.textContent = "Breathe in"))
        .fromTo(orb, { scale: 0.55 }, { scale: 1, duration: 4 })
        .call(() => (say.textContent = "Hold"))
        .to({}, { duration: 1.2 })
        .call(() => (say.textContent = "Breathe out"))
        .to(orb, { scale: 0.55, duration: 4 });
      const fields = all(p.win, ".v-fields i");
      gsap.set(fields.slice(1), { opacity: 0 });
      const drift = gsap.timeline({ repeat: -1 });
      fields.forEach((f, i) => {
        const next = fields[(i + 1) % fields.length]!;
        drift.to(next, { opacity: 1, duration: 2.4, ease: "sine.inOut" }, "+=2").set(f, { opacity: 0 });
      });
      // Begin: a slow glide down to the guide, and a fresh breath from the start.
      const begin = cta(p, one(p.win, ".v-breathe"), { duration: 2.2, ease: "sine.inOut" }, () => breath.restart());
      const loops = ambient(one(p.win, ".v-pause"), [breath, drift]);
      return () => {
        begin();
        loops();
      };
    })(),
    cursorFollower(one(p.win, ".v-soft-cursor"), { touch: p.win }),
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
  // Stickers to fling, a heap of shapes to shake, and headline letters that hop when touched.
  extra: `<section class="v-play"><p class="v-play-head">Grab a sticker. Throw it.</p><div class="v-stickers">${["★", "♥", "☺", "✿", "⚡", "●"]
    .map((s, i) => `<span class="v-sticker s${i}">${s}</span>`)
    .join("")}</div></section>
    <section class="v-heap"><div class="v-heap-box"></div><button type="button" class="v-shake">Shake it</button></section>`,
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
    // Letters hop when the pointer or a finger finds them.
    const hop = (e: PointerEvent) => {
      const letter = e.target as HTMLElement;
      if (letter.parentElement !== p.head || prefersReducedMotion()) return;
      gsap.fromTo(letter, { y: 0 }, { y: -22, rotation: gsap.utils.random(-12, 12), duration: 0.18, ease: "power2.out", yoyo: true, repeat: 1, overwrite: true });
    };
    p.head.addEventListener("pointerover", hop);
    // Stickers drag and throw, bounded by their section; the one held grows and leans.
    const area = one(p.win, ".v-play");
    const stickers = Draggable.create(all(p.win, ".v-sticker"), {
      type: "x,y",
      bounds: area,
      inertia: true,
      zIndexBoost: true,
      onPress(this: Draggable) {
        gsap.to(this.target, { scale: 1.2, rotation: gsap.utils.random(-15, 15), duration: 0.2, ease: "back.out(3)" });
      },
      onRelease(this: Draggable) {
        gsap.to(this.target, { scale: 1, duration: 0.4, ease: "elastic.out(1, 0.4)" });
      },
    });
    // A heap of shapes falls in once its box scrolls into view; the button throws it back up.
    const heap = pile(one(p.win, ".v-heap-box"), {
      pieces: [
        ["#ff4f9a", 46, "50%"],
        ["#3a5bff", 38, "50%"],
        ["#1d1145", 30, "30%"],
        ["#ffffff", 42, "50%"],
      ].map(([c, s, r]) => {
        const el = document.createElement("span");
        Object.assign(el.style, { background: String(c), width: `${s}px`, height: `${s}px`, borderRadius: String(r), border: "3px solid #1d1145" });
        return el;
      }),
    });
    const landed = onView(one(p.win, ".v-heap"), p.win, () => heap.drop(22));
    // Let's go: confetti first, then a quick hop down to the stickers.
    const go = cta(p, area, { duration: 0.8, ease: "back.inOut(1.4)", delay: 0.5 });
    const shake = () => heap.shake();
    one(p.win, ".v-shake").addEventListener("click", shake);
    return [
      () => {
        go();
        p.head.removeEventListener("pointerover", hop);
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
  // A picture uncovered slowly from the middle as it scrolls in, a pinned gallery that moves sideways,
  // and a spotlight that finds the detail.
  extra: `<section class="v-curtain"><div class="v-curtain-img"><i></i></div><p class="v-caption">The atelier, at first light</p></section>
    <section class="v-run"><div class="v-run-track">${["Aube", "Midi", "Soir", "Nuit", "Aube"].map((n, i) => `<figure class="v-panel p${i}"><i></i><figcaption>${n}</figcaption></figure>`).join("")}</div></section>
    <section class="v-detail"><div class="v-spot" tabindex="0" aria-label="The clasp, in detail"><div class="v-spot-base"><p>The clasp</p></div><div class="v-spot-reveal"><p>18k gold, hand chased</p></div></div><p class="v-caption">Hold a finger or move the pointer over it</p></section>`,
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
    (() => {
      // Scrubbed: the picture opens from a slit in the middle and settles from a slight zoom.
      const box = one(p.win, ".v-curtain-img");
      const tween = gsap.fromTo(
        box,
        { clipPath: "inset(0% 48% 0% 48%)" },
        { clipPath: "inset(0% 0% 0% 0%)", ease: "power2.inOut", scrollTrigger: { trigger: box, scroller: p.win, start: "top 90%", end: "center 55%", scrub: 1.2 } },
      );
      const zoom = gsap.fromTo(one(box, "i"), { scale: 1.25 }, { scale: 1, ease: "none", scrollTrigger: { trigger: box, scroller: p.win, start: "top 90%", end: "bottom top", scrub: 1.2 } });
      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        zoom.scrollTrigger?.kill();
        zoom.kill();
        gsap.set([box, one(box, "i")], { clearProps: "all" });
      };
    })(),
    // Discover: a long, slow glide to the picture.
    cta(p, one(p.win, ".v-curtain"), { duration: 2.4, ease: "expo.inOut" }),
    horizontalRun(one(p.win, ".v-run"), one(p.win, ".v-run-track"), { scroller: p.win, scrub: 1.2 }).revert,
    spotlight(one(p.win, ".v-spot"), one(p.win, ".v-spot-reveal"), { radius: 70, follow: 0.6, touch: true }),
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
  // Plans that switch instantly under a sliding indicator, a button that answers with a check, a task
  // list to reorder, and numbers that count up the moment they arrive.
  extra: `<section class="v-plans"><div class="v-tablist" role="tablist" aria-label="Billing">${["Monthly", "Yearly", "Team"].map((t, i) => `<button type="button" role="tab" aria-selected="${i === 0}">${t}</button>`).join("")}<span class="v-tab-ind" aria-hidden="true"></span></div><p class="v-price"><b>$8</b> per month</p><button type="button" class="v-state"><span data-state-label>Upgrade</span></button></section>
    <section class="v-tasks"><p class="v-kicker">Today, drag to reorder</p><p id="v-sort-help" hidden>Press Space to pick up, arrow keys to move, Space to drop.</p><ol class="v-sort">${["Write the brief", "Review designs", "Ship v3", "Reply to Sam"].map((n) => `<li data-sortable-item><button type="button" class="v-handle" data-sortable-handle aria-describedby="v-sort-help" aria-label="Move ${n}">⠿</button><span data-sortable-name>${n}</span></li>`).join("")}</ol></section>
    <section class="v-stats">${[["42", "teams"], ["1.2", "s to plan"], ["99", "% on time"]].map(([n, l]) => `<p><b data-count="${n}">0</b><span>${l}</span></p>`).join("")}</section>`,
  intro: (p, tl) => {
    const s = split(p.head, "words");
    tl.from([...p.nav, p.kicker], { autoAlpha: 0, x: -16, duration: 0.25, ease: "power3.out", stagger: 0.02 }, 0)
      .from(s.words, { autoAlpha: 0, x: -24, duration: 0.3, ease: "power4.out", stagger: 0.04 }, 0.05)
      .from([p.sub, p.btn], { autoAlpha: 0, x: -16, duration: 0.25, ease: "power3.out", stagger: 0.03 }, 0.15);
    return () => s.revert();
  },
  wire: (p) => [
    (() => {
      const list = one(p.win, ".v-tablist");
      const tabs = all(list, "[role=tab]");
      const price = one(p.win, ".v-price b");
      const prices = ["$8", "$80", "$24"];
      const ind = tabIndicator(one(p.win, ".v-tab-ind"), list, { duration: 0.2 });
      ind.moveTo(tabs[0]!);
      const pick = (e: Event) => {
        const i = tabs.indexOf(e.currentTarget as HTMLElement);
        tabs.forEach((t, j) => t.setAttribute("aria-selected", String(i === j)));
        ind.moveTo(tabs[i]!);
        price.textContent = prices[i]!;
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
      const sorter = sortable(one(p.win, ".v-sort"), { lift: 1.02 });
      const counts = all(p.win, "[data-count]");
      const counted = onView(one(p.win, ".v-stats"), p.win, () =>
        counts.forEach((el) => {
          const to = Number(el.dataset.count);
          const decimals = el.dataset.count!.includes(".") ? 1 : 0;
          gsap.fromTo({ v: 0 }, { v: 0 }, { v: to, duration: prefersReducedMotion() ? 0 : 0.6, ease: "power3.out", onUpdate() {
            el.textContent = (this.targets()[0] as { v: number }).v.toFixed(decimals);
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
  // A countdown that ticks in broken steps, a flickering marquee, nav that scrambles under the pointer,
  // pictures that tear on hover, and a trail of symbols behind the pointer or finger.
  extra: `<section class="v-count"><p class="v-kicker">> doors open in</p><p class="v-clock">00:59:59</p></section>
    <section class="v-marquee" aria-hidden="true"><div class="v-marquee-track">${"SIGNAL LOST // NO CARRIER // TUNE IN // ".repeat(4)}</div></section>
    <p class="v-ambient"><button type="button" class="v-pause">Pause</button></p>`,
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
  wire: (p, layer) => {
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
    const CHARS = "01#$%&*/<>";
    // Nav links scramble when the pointer finds them.
    const links = all(p.win, ".v-links a");
    const scrambleLink = (e: Event) => {
      const a = e.currentTarget as HTMLElement;
      if (prefersReducedMotion()) return;
      gsap.to(a, { scrambleText: { text: a.dataset.text ?? a.textContent ?? "", chars: CHARS, speed: 0.8 }, duration: 0.5, overwrite: true });
    };
    links.forEach((a) => {
      a.dataset.text = a.textContent ?? "";
      a.addEventListener("pointerenter", scrambleLink);
    });
    // Pictures tear on hover: the art jumps sideways in hard steps.
    const tears = p.cards.map((c) => {
      const art = one(c, ".v-art i");
      const tear = () => !prefersReducedMotion() && gsap.fromTo(art, { x: 0, skewX: 0 }, { keyframes: { x: [12, -18, 6, -4, 0], skewX: [-14, 10, -6, 2, 0] }, duration: 0.35, ease: "steps(5)", overwrite: true });
      c.addEventListener("pointerenter", tear);
      c.addEventListener("pointerdown", tear);
      return () => {
        c.removeEventListener("pointerenter", tear);
        c.removeEventListener("pointerdown", tear);
        gsap.set(art, { clearProps: "transform" });
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
    // Enter: a jump to the countdown in six hard steps.
    const enter = cta(p, one(p.win, ".v-count"), { duration: 0.45, ease: "steps(6)" });
    // A trail of symbols behind the pointer, or a finger dragging over the page.
    // Over the whole stage, outside the scrolling page, so it lines up with the pointer at any scroll.
    const glyphs = document.createElement("div");
    glyphs.className = "v-glyphs";
    glyphs.setAttribute("aria-hidden", "true");
    layer.append(glyphs);
    let last = 0;
    const trail = (e: PointerEvent) => {
      if (prefersReducedMotion() || (e.pointerType !== "mouse" && e.buttons === 0) || e.timeStamp - last < 45) return;
      last = e.timeStamp;
      const g = document.createElement("span");
      g.textContent = CHARS[Math.floor(Math.random() * CHARS.length)]!;
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
        enter();
        loops();
        gsap.killTweensOf(clock);
        p.win.removeEventListener("pointermove", trail);
        glyphs.remove();
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

export const VIBE_STAGES: Record<string, StageDef> = {
  calm,
  playful,
  luxury,
  snappy,
  glitchy,
};
