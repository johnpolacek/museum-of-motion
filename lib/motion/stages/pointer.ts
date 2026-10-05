// Interactive stages for the Pointer and Drag exhibits.
// Each mounts real controls inside the stage and wires the animaxxing recipe to them, unchanged, from
// lib/motion/recipes. Nothing loops: the stage waits for the visitor, so it shows a hint instead of a scrub.
import { gsap, SplitText } from "../gsap";
import { live, play, type StageDef } from "../stage-core";
import { directionalFill, imageZoom, textRoll, underlineSweep } from "../recipes/hover-effects";
import { hoverPreview } from "../recipes/media-effects";
import { cursorFollower, dragTrack, imageTrail, magnetic, momentumHover, proximity, spotlight, swipeDismiss, tilt } from "../recipes/pointer-effects";
import { sortable } from "../recipes/sortable";
import { COUNT_WORDS } from "../../exhibits";
import { morphToggle } from "../recipes/svg-effects";
import { pressFeedback } from "../recipes/press-feedback";
import { shake } from "../recipes/accents";
import { dialogMotion, disclosure, enterExit, menuOverlay, stateButton, tabIndicator } from "../recipes/component-motion";
import { captureLayout, captureShared, playShared } from "../recipes/layout-flip";
import { burstFrom, rain } from "../recipes/physics-effects";
import { blastOff } from "../recipes/blast-off";
import { dragGrid, dragLoop, flickCards } from "../recipes/endless-drag";
import { attachParticleEffect, type ParticleEffectDefinition } from "../recipes/particles/attach";
import { ignite, marquee as runners, reactor, resolve, slipstream } from "../recipes/particles/effects";

/* ---------- Shared art ---------- */

const NAMES = ["Line mask", "Characters", "Word slide", "Scramble", "Speak-in", "Weight wave", "Letter wave", "Marquee", "Curtain"];
/** Field and figure colors for posters, all from the site's three. */
const TONES: [string, string][] = [
  ["#0b0b0b", "#2130ff"],
  ["#ffffff", "#0b0b0b"],
  ["#1a27d9", "#ffffff"],
  ["#0b0b0b", "#ffffff"],
  ["#ffffff", "#2130ff"],
  ["#2a38ff", "#0b0b0b"],
];
const two = (n: number) => String(n).padStart(2, "0");

/** A small poster in the site's type: a numeral and rings. Inline, so it uses the page font. */
function poster(n: number, i: number, attrs = "") {
  const [bg, fg] = TONES[i % TONES.length];
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" ${attrs}><rect width="400" height="300" fill="${bg}"/><g fill="none" stroke="${fg}" stroke-width="2" opacity="0.45"><circle cx="300" cy="140" r="90"/><circle cx="300" cy="140" r="56"/></g><text x="24" y="270" fill="${fg}" font-family="var(--font-archivo), Arial, sans-serif" font-weight="800" font-size="190" font-stretch="75%" letter-spacing="-6">${two(n)}</text></svg>`;
}
/** The same poster as an image URL, for recipes that take <img>. Images cannot reach the page font. */
const posterUrl = (n: number, i: number) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(poster(n, i, 'xmlns="http://www.w3.org/2000/svg"').replace("var(--font-archivo), ", ""))}`;

const all = (root: ParentNode, sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
const one = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;

/* ---------- Hover effects ---------- */

const labelRoll = play(["Label roll"], ["roll"], "Hover or tab to a button.", (text) =>
  live(text, `<div class="btns">${["Start", "View the collection", "Play"].map((l) => `<button type="button" class="pill">${l}</button>`).join("")}</div>`, (layer) =>
    all(layer, ".pill").map((b) => textRoll(b)),
  ),
);

const underline = play(["Underline sweep"], ["sweep"], "Hover or tab to a link.", (text) =>
  live(
    text,
    `<nav class="sweeps" aria-label="Sample">${["Collection", "Exhibits", "Recipes", "About"].map((l) => `<button type="button" class="sweep">${l}</button>`).join("")}</nav>`,
    (layer) => all(layer, ".sweep").map((a) => underlineSweep(a)),
  ),
);

const zoom = play(["Zoom"], ["zoom"], "Hover or tab to a card.", (text) =>
  live(
    text,
    `<div class="cards">${[1, 10, 40]
      .map((n, i) => `<article class="card"><button type="button" class="card-hit"><span class="frame"><span data-zoom-image>${poster(n, i)}</span></span><span class="card-title">${NAMES[i]}</span></button></article>`)
      .join("")}</div>`,
    (layer) => all(layer, ".card").map((c) => imageZoom(c)),
  ),
);

/* ---------- Directional fill ---------- */

const fillTiles = play(["Directional fill"], ["fill"], "Move the mouse across the tiles, in and out from any side. Tab or tap one.", (text) =>
  live(
    text,
    `<nav class="fills" aria-label="Sample">${["Collection", "Exhibits", "Recipes", "About"].map((l) => `<button type="button" class="fill-tile"><span class="fill-tile-fill" aria-hidden="true"></span><span>${l}</span></button>`).join("")}</nav>`,
    (layer) => all(layer, ".fill-tile").map((t) => directionalFill(t, one(t, ".fill-tile-fill"), { focusFrom: "left" })),
  ),
);

/* ---------- Spotlight ---------- */

const spot = play(["Spotlight"], ["spot"], "Move the mouse over the poster. Press and hold on touch. Tab to open it all.", (text) =>
  live(
    text,
    `<div class="spot" tabindex="0" aria-label="Poster with a hidden layer"><div class="spot-base"><b>Every way<br>a page<br>can move.</b></div><div class="spot-reveal"><b>Every way<br>a page<br>can move.</b></div></div>`,
    (layer) => [spotlight(one(layer, ".spot"), one(layer, ".spot-reveal"), { radius: 110 })],
  ),
);

/* ---------- Press feedback ---------- */

const press = play(["Press feedback"], ["press"], "Press a button with the mouse, a finger, or Enter and Space.", (text) =>
  live(
    text,
    `<div class="btns">${["Send", "Add to cart", "Play"].map((l) => `<button type="button" class="pill big press">${l}</button>`).join("")}</div>`,
    (layer) => all(layer, ".press").map((b) => pressFeedback(b, { ink: 0.45 })),
  ),
);

/* ---------- Shake ---------- */

const shakeForm = play(["Shake"], ["shake"], "Sign in with any password. Only “motion” works.", (text) =>
  live(
    text,
    `<form class="signin" novalidate><label class="lab" for="shake-pass">Password</label><div class="signin-row"><input id="shake-pass" type="password" autocomplete="off" aria-describedby="shake-error"><button type="submit" class="pill">Sign in</button></div><div id="shake-error" class="lab signin-error" aria-live="polite"></div></form>`,
    (layer) => {
      const form = one<HTMLFormElement>(layer, "form");
      const input = one<HTMLInputElement>(layer, "input");
      const error = one(layer, ".signin-error");
      const submit = (event: SubmitEvent) => {
        event.preventDefault();
        const right = input.value.trim().toLowerCase() === "motion";
        // The message and the state arrive with the shake: it never speaks alone.
        input.setAttribute("aria-invalid", String(!right));
        error.textContent = right ? "Signed in." : "That password is wrong.";
        if (!right) shake(one(layer, ".signin-row"));
      };
      form.addEventListener("submit", submit);
      return [() => form.removeEventListener("submit", submit), () => gsap.killTweensOf(one(layer, ".signin-row"))];
    },
  ),
);

/* ---------- State button ---------- */

const stateBtn = play(["Success", "Error"], ["success", "error"], "Press Send. The request takes a moment.", (text, p) =>
  live(
    text,
    `<div class="btns"><button type="button" class="pill big state"><span data-state-label>Send</span></button></div>`,
    (layer) => {
      const button = one(layer, ".state");
      const sb = stateButton(button);
      let timer = 0;
      let busy = false;
      const send = () => {
        if (busy) return;
        busy = true;
        sb.loading();
        timer = window.setTimeout(() => {
          const done = p.variation === "error" ? sb.error("Not sent. Try again.") : sb.success("Sent");
          done.eventCallback("onComplete", () => (busy = false));
        }, 1400);
      };
      button.addEventListener("click", send);
      return [() => button.removeEventListener("click", send), () => clearTimeout(timer), sb.revert];
    },
  ),
);

/* ---------- Hover preview ---------- */

const preview = play(["Hover preview"], ["preview"], "Move the mouse over the list. Touch shows the list alone.", (text) =>
  live(
    text,
    `<ul class="works">${NAMES.slice(0, 6)
      .map((n, i) => `<li><button type="button" data-preview="${posterUrl(i + 1, i)}">${n}</button></li>`)
      .join("")}</ul><div class="preview"></div>`,
    (layer) => [hoverPreview(one(layer, ".works"), one(layer, ".preview"))],
  ),
);

/* ---------- Pointer effects ---------- */

const magnet = play(["Magnetic"], ["magnetic"], "Bring the mouse near a button.", (text) =>
  live(text, `<div class="btns">${["Start", "Explore", "Play"].map((l) => `<button type="button" class="pill big"><span data-magnetic-inner>${l}</span></button>`).join("")}</div>`, (layer) =>
    all(layer, ".pill").map((b) => magnetic(b)),
  ),
);

const tiltCards = play(["Tilt"], ["tilt"], "Move the mouse across a card.", (text) =>
  live(
    text,
    `<div class="cards">${[42, 43, 44].map((n, i) => `<div class="card tilt-card"><span class="frame">${poster(n, i)}</span><span class="card-title">${NAMES[i]}</span></div>`).join("")}</div>`,
    (layer) => all(layer, ".tilt-card").map((c) => tilt(c, { max: 10 })),
  ),
);

const follower = play(["Cursor follower"], ["follow"], "Move the mouse. Hover a name to see its label.", (text) =>
  live(
    text,
    `<div class="cursor" aria-hidden="true"></div><div class="cursor-label" aria-hidden="true"><span data-cursor-label-track></span></div>
     <ul class="works">${NAMES.slice(0, 4).map((n) => `<li><button type="button" data-cursor-text="View exhibit">${n}</button></li>`).join("")}</ul>`,
    (layer) => [cursorFollower(one(layer, ".cursor"), { label: one<HTMLElement>(layer, ".cursor-label") })],
  ),
);

const momentum = play(["Momentum hover"], ["momentum"], "Swipe the mouse through the stickers.", (text) =>
  live(
    text,
    `<div class="stickers">${["★", "●", "▲", "■", "◆", "✳"].map((g, i) => `<span data-momentum-item><span data-momentum-target class="sticker s${i}">${g}</span></span>`).join("")}</div>`,
    (layer) => [momentumHover(one(layer, ".stickers"))],
  ),
);

const dock = play(["Proximity"], ["dock"], "Run the mouse along the dock.", (text) =>
  live(
    text,
    `<nav class="dock" aria-label="Sample dock">${Array.from({ length: 9 }, (_, i) => `<button type="button" data-proximity-item aria-label="Exhibit ${i + 38}"><span data-proximity-target class="tile">${i + 38}</span></button>`).join("")}</nav>`,
    (layer) => [proximity(one(layer, ".dock"), { axis: "x", scale: 1.8, lift: 16, radius: 180 })],
  ),
);

const trail = play(["Image trail"], ["trail"], "Move the mouse across the stage.", (text) =>
  live(
    text,
    `<div class="trail-layer"></div><p class="lab trail-cue">Move here</p>`,
    (layer) => {
      const images = Array.from({ length: 8 }, (_, i) => {
        const img = new Image();
        img.alt = "";
        img.src = posterUrl(i + 10, i);
        return img;
      });
      return [imageTrail(layer, one(layer, ".trail-layer"), images)];
    },
    "trail",
  ),
);

/* ---------- Icon morph ---------- */

const ICONS: [string, string, string][] = [
  ["Menu", "M4 7h16M4 12h16M4 17h16", "M6 6l12 12M12 12l0 0M18 6L6 18"],
  ["Play", "M7 5l12 7-12 7z", "M7 5h4v14H7zM13 5h4v14h-4z"],
  ["Add", "M12 5v14M5 12h14", "M12 12v0M5 12h14"],
];

const iconMorph = play(["Icon morph"], ["morph"], "Click or press an icon.", (text) =>
  live(
    text,
    `<div class="btns">${ICONS.map(([label, d]) => `<button type="button" class="icon-btn" aria-pressed="false" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg></button>`).join("")}</div>`,
    (layer) =>
      all(layer, ".icon-btn").flatMap((btn, i) => {
        const morph = morphToggle(one<SVGPathElement>(btn, "path"), ICONS[i][2]);
        const click = () => {
          const on = btn.getAttribute("aria-pressed") !== "true";
          btn.setAttribute("aria-pressed", String(on));
          morph.set(on);
        };
        btn.addEventListener("click", click);
        return [() => btn.removeEventListener("click", click), morph.revert];
      }),
  ),
);

/* ---------- Component motion ---------- */

const menu = play(
  ["Top", "Bottom", "Left", "Right"],
  ["top", "bottom", "left", "right"],
  "Open the menu. Escape or Close returns.",
  (text, p) =>
    live(
      text,
      `<button type="button" class="pill big menu-open" aria-expanded="false" aria-controls="stage-menu">Menu</button>
       <div class="menu-panel" id="stage-menu"><button type="button" class="pill menu-close">Close</button><nav aria-label="Sample menu">${NAMES.slice(0, 5).map((n) => `<a href="#">${n}</a>`).join("")}</nav></div>`,
      (layer) => {
        const opener = one(layer, ".menu-open");
        const panel = one(layer, ".menu-panel");
        const m = menuOverlay(panel, { from: p.variation as "top" });
        const open = () => {
          opener.setAttribute("aria-expanded", "true");
          m.open().eventCallback("onComplete", () => one<HTMLElement>(panel, ".menu-close").focus());
        };
        const close = () => {
          opener.setAttribute("aria-expanded", "false");
          m.close().eventCallback("onComplete", () => opener.focus());
        };
        const key = (e: KeyboardEvent) => e.key === "Escape" && opener.getAttribute("aria-expanded") === "true" && close();
        const stop = (e: Event) => e.preventDefault();
        opener.addEventListener("click", open);
        one(panel, ".menu-close").addEventListener("click", close);
        // On the whole stage: Escape works mid-open too, before focus has moved into the panel.
        layer.addEventListener("keydown", key);
        all(panel, "a").forEach((a) => a.addEventListener("click", stop));
        return [
          () => {
            opener.removeEventListener("click", open);
            layer.removeEventListener("keydown", key);
            all(panel, "a").forEach((a) => a.removeEventListener("click", stop));
          },
          m.revert,
        ];
      },
    ),
);

const enterAndExit = play(["Interruptible"], ["enter-exit"], "Open, then close. Change your mind halfway.", (text) =>
  live(
    text,
    `<button type="button" class="pill big ee-toggle" aria-expanded="false">Open</button><div class="ee-panel">${NAMES.slice(0, 5).map((n) => `<span class="ee-item">${n}</span>`).join("")}</div>`,
    (layer) => {
      const toggle = one(layer, ".ee-toggle");
      const panel = one(layer, ".ee-panel");
      const items = all(panel, ".ee-item");
      gsap.set(panel, { autoAlpha: 0 });
      // The recipe's example: items spring in and tumble out, and a reversal gets out of the way.
      const ee = enterExit(
        (tl) =>
          tl
            .fromTo(panel, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 })
            .fromTo(items, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "back.out(2)", stagger: 0.05 }, "<0.1"),
        (tl) =>
          tl
            .to(items, { y: () => 260, rotation: () => gsap.utils.random(-30, 30), autoAlpha: 0, duration: 0.6, ease: "power2.in", stagger: 0.03 })
            .to(panel, { autoAlpha: 0, duration: 0.2 }, "-=0.2"),
        { easeReverse: "power3.in" },
      );
      const click = () => {
        const opening = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", String(opening));
        toggle.textContent = opening ? "Close" : "Open";
        if (opening) ee.open();
        else ee.close();
      };
      toggle.addEventListener("click", click);
      return [() => toggle.removeEventListener("click", click), ee.revert, () => gsap.set(panel, { clearProps: "opacity,visibility" })];
    },
  ),
);

const dialog = play(
  ["Center", "Top", "Bottom", "Left", "Right"],
  ["center", "top", "bottom", "left", "right"],
  "Open the dialog. Escape closes it too.",
  (text, p) =>
    live(
      text,
      `<button type="button" class="pill big dlg-open">Open dialog</button>
       <dialog class="stage-dialog ${p.variation === "center" ? "" : `drawer drawer-${p.variation}`}" aria-labelledby="stage-dlg-title"><h2 id="stage-dlg-title">Dialog</h2><p>Native &lt;dialog&gt;, animated in and out. Focus and Escape stay the browser's.</p><button type="button" class="pill dlg-close">Close</button></dialog>`,
      (layer) => {
        const opener = one(layer, ".dlg-open");
        const dlg = one<HTMLDialogElement>(layer, "dialog");
        const d = dialogMotion(dlg, { placement: p.variation as "center" });
        const open = () => d.open();
        const close = () => d.close();
        opener.addEventListener("click", open);
        one(dlg, ".dlg-close").addEventListener("click", close);
        return [
          () => {
            opener.removeEventListener("click", open);
            if (dlg.open) dlg.close();
          },
          d.revert,
        ];
      },
    ),
);

const accordion = play(["Disclosure"], ["disclosure"], "Open and close the sections.", (text) =>
  live(
    text,
    `<div class="acc">${[
      ["What it does", "Grows a panel from nothing to its content height, then lets CSS take the height back."],
      ["What drives it", "Its button. The panel stays hidden to everyone while closed."],
      ["Reduced motion", "Opens and closes at once."],
    ]
      .map(
        ([q, a], i) =>
          `<div class="acc-item"><button type="button" class="acc-btn" aria-expanded="false" aria-controls="acc-${i}">${q}<span aria-hidden="true">+</span></button><div class="acc-panel" id="acc-${i}" hidden><p>${a}</p></div></div>`,
      )
      .join("")}</div>`,
    (layer) =>
      all(layer, ".acc-item").flatMap((item) => {
        const btn = one(item, ".acc-btn");
        const panel = one(item, ".acc-panel");
        const d = disclosure(panel);
        const click = () => {
          const opening = btn.getAttribute("aria-expanded") !== "true";
          btn.setAttribute("aria-expanded", String(opening));
          if (opening) {
            panel.hidden = false;
            d.open();
          } else {
            d.close().eventCallback("onComplete", () => (panel.hidden = true));
          }
        };
        btn.addEventListener("click", click);
        return [() => btn.removeEventListener("click", click), d.revert];
      }),
  ),
);

const tabs = play(["Tab indicator"], ["tabs"], "Pick a tab, by click or arrow keys.", (text) => {
  const TABS = ["Time", "Scroll", "Pointer", "Drag"];
  return live(
    text,
    `<div class="tabbed"><div class="tablist" role="tablist" aria-label="Groups">${TABS.map((t, i) => `<button type="button" role="tab" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${t}</button>`).join("")}<span class="tab-indicator" aria-hidden="true"></span></div><p class="tab-panel" role="tabpanel">Plays once the page starts it: entrances, exits, loops.</p></div>`,
    (layer) => {
      const list = one(layer, ".tablist");
      const buttons = all(list, "[role=tab]");
      const panel = one(layer, ".tab-panel");
      const notes = ["Plays once the page starts it: entrances, exits, loops.", "Scroll position or scroll speed drives it.", "Hover, click, or key sets it off.", "The hand moves it directly."];
      const ind = tabIndicator(one(layer, ".tab-indicator"), list);
      const select = (i: number, focus = false) => {
        buttons.forEach((b, j) => {
          b.setAttribute("aria-selected", String(i === j));
          b.tabIndex = i === j ? 0 : -1;
        });
        panel.textContent = notes[i];
        ind.moveTo(buttons[i]);
        if (focus) buttons[i].focus();
      };
      const click = (e: Event) => {
        const i = buttons.indexOf(e.currentTarget as HTMLElement);
        select(i);
      };
      const key = (e: KeyboardEvent) => {
        const i = buttons.indexOf(document.activeElement as HTMLElement);
        if (i < 0) return;
        if (e.key === "ArrowRight") select((i + 1) % buttons.length, true);
        if (e.key === "ArrowLeft") select((i + buttons.length - 1) % buttons.length, true);
      };
      buttons.forEach((b) => b.addEventListener("click", click));
      list.addEventListener("keydown", key);
      ind.moveTo(buttons[0]);
      return [
        () => {
          buttons.forEach((b) => b.removeEventListener("click", click));
          list.removeEventListener("keydown", key);
        },
        ind.revert,
      ];
    },
  );
});

/* ---------- and 55 Layout Flip ---------- */

const GROUPED: [string, string][] = [
  ["Line mask", "time"], ["Marquee", "time"], ["Parallax", "scroll"], ["Pinned scene", "scroll"], ["Magnetic", "pointer"],
  ["Tilt", "pointer"], ["Drag track", "drag"], ["Card stack", "drag"], ["Rain", "time"],
];

const layoutFlip = play(["Layout Flip"], ["flip"], "Filter the tiles.", (text) =>
  live(
    text,
    `<div class="filters" role="group" aria-label="Filter">${["all", "time", "scroll", "pointer", "drag"].map((f, i) => `<button type="button" class="pill" aria-pressed="${i === 0}" data-filter="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join("")}</div>
     <ul class="tiles">${GROUPED.map(([n, g]) => `<li class="tile-card" data-group="${g}">${n}</li>`).join("")}</ul>`,
    (layer) => {
      const tiles = all(layer, ".tile-card");
      const buttons = all(layer, "[data-filter]");
      const click = (e: Event) => {
        const f = (e.currentTarget as HTMLElement).dataset.filter!;
        buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === f)));
        // Capture, change the layout, play: hidden tiles use display none so they can leave.
        const flip = captureLayout(tiles);
        tiles.forEach((t) => (t.style.display = f === "all" || t.dataset.group === f ? "" : "none"));
        flip.play();
      };
      buttons.forEach((b) => b.addEventListener("click", click));
      return [() => buttons.forEach((b) => b.removeEventListener("click", click))];
    },
  ),
);

const shared = play(["Shared element"], ["shared"], "Open a poster. Close it to send it home.", (text) =>
  live(
    text,
    `<ul class="thumbs">${[54, 55, 56, 57].map((n, i) => `<li><button type="button" class="thumb" data-n="${n}" data-i="${i}" aria-label="Open poster ${n}">${poster(n, i)}</button></li>`).join("")}</ul>
     <div class="detail" hidden><div class="detail-art"></div><button type="button" class="pill detail-close">Close</button></div>`,
    (layer) => {
      const detail = one(layer, ".detail");
      const holder = one(layer, ".detail-art");
      let from: HTMLElement | null = null;
      const open = (e: Event) => {
        from = e.currentTarget as HTMLElement;
        // Same flip id on both, set before the capture, so Flip pairs the thumbnail with the large poster.
        holder.dataset.flipId = from.dataset.flipId = `poster-${from.dataset.n}`;
        const state = captureShared(from);
        holder.innerHTML = from.innerHTML;
        detail.hidden = false;
        gsap.set(from, { autoAlpha: 0 });
        playShared(state, holder, { duration: 0.7, ease: "power3.inOut" });
        one<HTMLElement>(detail, ".detail-close").focus();
      };
      const close = () => {
        if (!from) return;
        const back = from;
        const state = captureShared(holder);
        detail.hidden = true;
        gsap.set(back, { autoAlpha: 1 });
        playShared(state, back, { duration: 0.6, ease: "power3.inOut" });
        back.focus();
        from = null;
      };
      const thumbs = all(layer, ".thumb");
      thumbs.forEach((t) => t.addEventListener("click", open));
      one(detail, ".detail-close").addEventListener("click", close);
      return [() => thumbs.forEach((t) => t.removeEventListener("click", open)), () => gsap.set(thumbs, { clearProps: "opacity,visibility,transform" })];
    },
  ),
);

/* ---------- Particles, confetti, blast-off ---------- */

const PARTICLES: Record<string, ParticleEffectDefinition> = { marquee: runners, reactor, resolve, slipstream, ignite };

const particles = play(
  ["Marquee", "Reactor", "Resolve", "Slipstream", "Ignite"],
  ["marquee", "reactor", "resolve", "slipstream", "ignite"],
  "Hover, focus, or press the button. Click it to blast.",
  (text, p) => {
    const effect = PARTICLES[p.variation] ?? runners;
    const bleed = effect.bleed;
    return live(
      text,
      `<div class="particle-btn" data-particle-button><canvas aria-hidden="true" style="left:-${bleed}px; top:-${bleed}px"></canvas><button type="button" class="pill big">Continue</button></div>`,
      (layer) => {
        const root = one(layer, ".particle-btn");
        const button = one(root, "button");
        const controls = attachParticleEffect(root, one<HTMLCanvasElement>(root, "canvas"), button, effect);
        controls.enter(0.1);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const click = () => {
          controls.blast();
          clearTimeout(timer);
          timer = setTimeout(() => {
            controls.enter(0);
          }, 1400);
        };
        button.addEventListener("click", click);
        return [() => button.removeEventListener("click", click), () => clearTimeout(timer), controls.destroy];
      },
    );
  },
);

const confetti = play(
  ["Confetti", "Emoji", "Rain"],
  ["confetti", "emoji", "rain"],
  "Press the button.",
  (text, p) =>
    p.variation === "rain"
      ? live(text, `<div class="rain-layer" aria-hidden="true"></div><button type="button" class="pill big rain-btn">Make it rain</button>`, (layer) => {
          // Rain falls inside the stage: the skill's rain, from above its top edge to below its bottom.
          const sky = one(layer, ".rain-layer");
          const button = one(layer, ".rain-btn");
          const pieces = ["#ffffff", "#0b0b0b", "#9aa2ff"].map((c) => {
            const s = document.createElement("span");
            s.className = "confetto";
            s.style.background = c;
            return s;
          });
          let runs: Array<{ stop: () => void }> = [];
          const click = () => runs.push(rain(sky, { pieces: [...pieces, "✨", "★"], count: 48, period: 1.4 }));
          button.addEventListener("click", click);
          return [() => button.removeEventListener("click", click), () => (runs.forEach((r) => r.stop()), (runs = []))];
        })
      : live(text, `<button type="button" class="pill big burst-btn">Celebrate</button>`, (layer) => {
      // The recipe's layer is fixed to the viewport, so pieces can fly past the stage.
      const physics = document.createElement("div");
      physics.className = "physics-layer";
      physics.setAttribute("aria-hidden", "true");
      document.body.appendChild(physics);
      const button = one(layer, ".burst-btn");
      const pieces =
        p.variation === "emoji"
          ? ["🎉", "✨", "💫", "⭐"]
          : ["#ffffff", "#0b0b0b", "#9aa2ff"].map((c) => {
              const s = document.createElement("span");
              s.className = "confetto";
              s.style.background = c;
              return s;
            });
      const click = () => burstFrom(physics, button, { pieces, count: 36 });
      button.addEventListener("click", click);
      return [() => button.removeEventListener("click", click), () => physics.remove()];
        }),
);

const blast = play(["Blast-off"], ["blast"], "Press a button. Reset brings the hero back.", (text) =>
  live(
    text,
    `<div class="mini-hero"><h3 class="mh-title">Every way a page can move.</h3><p class="mh-sub">${COUNT_WORDS} effects, each shown on its own.</p><div class="mh-btns"><button type="button" class="pill go">Start</button><button type="button" class="pill go">Explore</button></div><button type="button" class="pill mh-reset" hidden>Reset</button></div>`,
    (layer) => {
      const root = one(layer, ".mini-hero");
      const heading = one(root, ".mh-title");
      const sub = SplitText.create(one(root, ".mh-sub"), { type: "words" });
      const words = sub.words as HTMLElement[];
      const gos = all(root, ".go");
      const reset = one(root, ".mh-reset");
      let run: ReturnType<typeof blastOff> | null = null;
      const fire = (e: Event) => {
        if (run) return;
        const pressed = e.currentTarget as HTMLElement;
        run = blastOff({ root, heading, words, pressed, others: gos.filter((g) => g !== pressed) });
        run.timeline.eventCallback("onComplete", () => {
          reset.hidden = false;
          reset.focus();
        });
      };
      const back = () => {
        run?.revert();
        run = null;
        reset.hidden = true;
        gos[0].focus();
      };
      gos.forEach((g) => g.addEventListener("click", fire));
      reset.addEventListener("click", back);
      return [
        () => gos.forEach((g) => g.removeEventListener("click", fire)),
        () => run?.revert(),
        () => sub.revert(),
      ];
    },
  ),
);

/* ---------- Sortable ---------- */

const sortList = play(["Sortable"], ["sort"], "Drag a handle to reorder. Or Tab to a handle: Space, arrows, Space.", (text) =>
  live(
    text,
    `<p id="sort-help" hidden>Press Space to pick up, arrow keys to move, Space to drop, Escape to cancel.</p><ol class="sorts" aria-label="Exhibits to see first">${NAMES.slice(0, 5)
      .map((n) => `<li data-sortable-item><button type="button" class="sort-handle" data-sortable-handle aria-describedby="sort-help" aria-label="Move ${n}"><span aria-hidden="true">⠿</span></button><span data-sortable-name>${n}</span></li>`)
      .join("")}</ol>`,
    (layer) => [sortable(one(layer, ".sorts")).revert],
  ),
);

/* ---------- Swipe to dismiss ---------- */

const NOTES = ["Line mask is back on view", "Two new exhibits this week", "Your tour starts at noon", "The gift shop is open late"];

const swipe = play(["Swipe to dismiss"], ["swipe"], "Drag a note sideways, or flick it. Tab to one and press Delete.", (text) =>
  live(
    text,
    `<ul class="swipes" aria-label="Notes">${NOTES.map((n) => `<li class="swipe-note" tabindex="0" data-swipe><span>${n}</span><button type="button" class="swipe-x" data-swipe-dismiss aria-label="Dismiss ${n}">×</button></li>`).join("")}</ul><button type="button" class="pill swipe-reset" hidden>Bring them back</button>`,
    (layer) => {
      const reset = one<HTMLButtonElement>(layer, ".swipe-reset");
      let swipes: ReturnType<typeof swipeDismiss>[] = [];
      let left = NOTES.length;
      const build = () => {
        left = NOTES.length;
        swipes = all(layer, ".swipe-note").map((note) =>
          swipeDismiss(note, {
            onDismiss: () => {
              left -= 1;
              // Focus moves on to the next note, or to the reset when none are left.
              const next = all(layer, ".swipe-note").find((n) => getComputedStyle(n).display !== "none");
              if (left === 0) {
                reset.hidden = false;
                reset.focus();
              } else if (document.activeElement === document.body) next?.focus();
            },
          }),
        );
      };
      const again = () => {
        swipes.forEach((s) => s.revert());
        reset.hidden = true;
        build();
        all(layer, ".swipe-note")[0]?.focus();
      };
      build();
      reset.addEventListener("click", again);
      return [() => reset.removeEventListener("click", again), () => swipes.forEach((s) => s.revert())];
    },
  ),
);

/* ---------- Drag ---------- */

const cardsHtml = (from: number, n: number, cls = "drag-card") =>
  Array.from({ length: n }, (_, i) => `<div class="${cls}" tabindex="0" aria-label="Poster ${from + i}">${poster(from + i, i)}</div>`).join("");

const track = play(["Snap", "Free"], ["snap", "free"], "Drag or throw the row. It stops at its ends.", (text, p) =>
  live(text, `<div class="drag-viewport"><div class="drag-track">${cardsHtml(60, 8)}</div></div>`, (layer) => [
    dragTrack(one(layer, ".drag-viewport"), one(layer, ".drag-track"), { snap: p.variation === "snap" }).revert,
  ]),
);

const loop = play(["Snap", "Drift"], ["snap", "drift"], "Drag, throw, or wheel sideways. It never ends.", (text, p) =>
  live(text, `<div class="loop-viewport"><div class="loop-track">${cardsHtml(61, 6)}</div></div>`, (layer) => [
    dragLoop(one(layer, ".loop-viewport"), one(layer, ".loop-track"), { snap: true, drift: p.variation === "drift" ? 40 : 0 }).revert,
  ]),
);

const grid = play(["Wrapping grid"], ["grid"], "Drag in any direction. It wraps both ways.", (text) =>
  live(text, `<div class="grid-viewport"><ul class="grid">${Array.from({ length: 12 }, (_, i) => `<li class="grid-tile" tabindex="0">${poster(62 + i, i)}</li>`).join("")}</ul></div>`, (layer) => [
    dragGrid(one(layer, ".grid-viewport"), one(layer, ".grid"), { columns: 4, capture: "x" }).revert,
  ]),
);

const deck = play(["Card stack"], ["deck"], "Drag or flick the front card, or use the buttons.", (text) =>
  live(
    text,
    `<section class="flick" aria-roledescription="carousel" aria-label="Posters" tabindex="0"><ul class="flick-stack">${Array.from({ length: 6 }, (_, i) => `<li class="flick-card">${poster(63 - i, i)}</li>`).join("")}</ul><div class="flick-btns"><button type="button" class="pill" data-flick-prev>Previous</button><button type="button" class="pill" data-flick-next>Next</button></div></section>`,
    (layer) => {
      const root = one(layer, ".flick");
      const f = flickCards(root, one(root, ".flick-stack"));
      const prev = () => f.prev();
      const next = () => f.next();
      one(root, "[data-flick-prev]").addEventListener("click", prev);
      one(root, "[data-flick-next]").addEventListener("click", next);
      return [
        () => {
          one(root, "[data-flick-prev]").removeEventListener("click", prev);
          one(root, "[data-flick-next]").removeEventListener("click", next);
        },
        f.revert,
      ];
    },
  ),
);

export const POINTER_STAGES: Record<string, StageDef> = {
  "label-roll": labelRoll,
  "underline-sweep": underline,
  zoom,
  "directional-fill": fillTiles,
  "press-feedback": press,
  shake: shakeForm,
  "hover-preview": preview,
  magnetic: magnet,
  tilt: tiltCards,
  spotlight: spot,
  "cursor-follower": follower,
  "momentum-hover": momentum,
  proximity: dock,
  "image-trail": trail,
  "icon-morph": iconMorph,
  "menu-overlay": menu,
  interruptible: enterAndExit,
  dialog,
  disclosure: accordion,
  "tab-indicator": tabs,
  "state-button": stateBtn,
  "layout-flip": layoutFlip,
  "shared-element": shared,
  particles,
  physics: confetti,
  "blast-off": blast,
  "drag-track": track,
  "endless-loop": loop,
  "wrapping-grid": grid,
  "card-stack": deck,
  sortable: sortList,
  "swipe-to-dismiss": swipe,
};
