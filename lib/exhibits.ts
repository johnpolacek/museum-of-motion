// Museum of Motion: every exhibit is an effect recipe from the Animaxxing skills.
// `src` is the recipe file. `gl` marks animaxxing-webgl.

export type GroupKey = "type" | "play" | "scroll" | "pointer" | "drag";

export type Exhibit = {
  name: string;
  group: GroupKey;
  builders: string;
  src: string;
  desc: string;
  vars?: string[];
  gl?: boolean;
};

export const GROUPS: { key: GroupKey; name: string; note: string }[] = [
  {
    key: "type",
    name: "Type",
    note: "Letters, words, and numbers perform: they split, scramble, swell, and count."
  },
  {
    key: "play",
    name: "Play",
    note: "Plays once the page starts it: entrances, exits, loops."
  },
  {
    key: "scroll",
    name: "Scroll",
    note: "Scroll position or scroll speed drives it."
  },
  {
    key: "pointer",
    name: "Pointer",
    note: "Hover, click, or key sets it off."
  },
  {
    key: "drag",
    name: "Drag",
    note: "The hand moves it directly, and it keeps going when thrown."
  }
];

const DATA: Exhibit[] = [
  {
    name: "Line mask",
    group: "type",
    builders: "linesMaskIn, linesMaskOut",
    src: "split-entrances",
    desc: "Whole lines wipe up from behind masks.",
    vars: [
      "Ellipse",
      "Highlight"
    ]
  },
  {
    name: "Characters",
    group: "type",
    builders: "charsImplodeIn, charsExplodeOut, charsRiseIn, charsCascadeIn, charsFlipIn, charsSpringIn, charsScatterIn, charsFallOut",
    src: "split-entrances",
    desc: "Letters slam together from all around and blow apart, or rise, tip, spring, and scatter.",
    vars: [
      "Rise",
      "Cascade",
      "Flip",
      "Spring",
      "Scatter",
      "Fall"
    ]
  },
  {
    name: "Word slide",
    group: "type",
    builders: "wordsSlideIn, wordsSlideOut",
    src: "split-entrances",
    desc: "Words zip together from alternating sides."
  },
  {
    name: "Scramble",
    group: "type",
    builders: "scrambleIn, scrambleOut",
    src: "split-entrances",
    desc: "Text resolves out of noise."
  },
  {
    name: "Glitch",
    group: "type",
    builders: "glitchIn, glitchOut",
    src: "split-entrances",
    desc: "The signal drops: bands, blocks, and letters jump, then snap clean.",
    vars: [
      "Blocks",
      "Skew",
      "Ghost",
      "Weight",
      "Scanline"
    ]
  },
  {
    name: "Type and speak",
    group: "type",
    builders: "typeIn, typeOut, retype, speakIn",
    src: "typewriter",
    desc: "Text written out over time: typed one character at a time behind a caret at a person's uneven pace, or spoken in word by word.",
    vars: [
      "Retype",
      "Speak"
    ]
  },


  {
    name: "Wave",
    group: "type",
    builders: "charsWeightWave, startWave",
    src: "split-entrances",
    desc: "A wave runs through a line: letters gain weight and let it go, or every few seconds a small move ripples across a heading.",
    vars: [
      "All",
      "Hop",
      "Breathe",
      "Lean",
      "Lighten",
      "Shear",
      "Squash",
      "Twist"
    ]
  },


  {
    name: "Route letters",
    group: "type",
    builders: "buildPageIntro, buildPageOutro",
    src: "route-letters",
    desc: "A whole page arrives and leaves at once: the headline by letter, the rest as blocks."
  },
  {
    name: "Text on path",
    group: "type",
    builders: "pathLoop",
    src: "svg-effects",
    desc: "A line of text rides a curve into place, or turns around a badge.",
    vars: [
      "Badge"
    ]
  },
  {
    name: "Count",
    group: "type",
    builders: "countUp, odometer",
    src: "counters-and-marquees",
    desc: "Figures count to their final value and keep their format, or digit columns roll to each new value, forward when it rises and back when it falls.",
    vars: [
      "Odometer"
    ]
  },


  {
    name: "Enter and exit",
    group: "play",
    builders: "fadeIn, riseIn, dropIn, slideIn, scaleIn, popIn, wipeUp, wipeAcross, flipIn, focusIn, weightIn",
    src: "motion-vocabulary",
    desc: "Eleven ways to arrive and leave, from a plain fade to a weight shift.",
    vars: [
      "Fade",
      "Rise",
      "Drop",
      "Slide",
      "Scale",
      "Pop",
      "Wipe up",
      "Wipe across",
      "Flip",
      "Focus",
      "Weight"
    ]
  },
  {
    name: "Reveal",
    group: "play",
    builders: "imageReveal",
    src: "media-effects",
    desc: "A wipe opens a frame while what is inside settles from a slight zoom: an image, a video, any block."
  },
  {
    name: "Path",
    group: "play",
    builders: "drawIn, drawOut, followPath",
    src: "svg-effects",
    desc: "Strokes draw along their length, or a small mark loops along a path.",
    vars: [
      "Dot",
      "Arrow"
    ]
  },


  {
    name: "Marquee",
    group: "play",
    builders: "marquee",
    src: "counters-and-marquees",
    desc: "A row scrolls sideways forever and slows on hover."
  },
  {
    name: "Cycle",
    group: "play",
    builders: "logoCycle",
    src: "counters-and-marquees",
    desc: "One cell at a time swaps to the next item in the pool: logos, names, figures, anything."
  },
  {
    name: "Curtain",
    group: "play",
    builders: "curtain, curveCover",
    src: "page-covers",
    desc: "A cover sweeps over the page while it changes underneath: staggered panels, tilted, titled, or one curved edge.",
    vars: [
      "Tilt",
      "Title",
      "Curve"
    ]
  },
  {
    name: "Shader",
    group: "play",
    builders: "wipe, dissolve, pixelate, ripple, glitch",
    src: "uniform-effects",
    desc: "An image comes and goes on the GPU: wiped, dissolved, pixelated, rippled, or glitched.",
    vars: [
      "Dissolve",
      "Pixelate",
      "Ripple",
      "Glitch"
    ],
    gl: true
  },
  {
    name: "Timeline",
    group: "play",
    builders: "gsap.timeline, drawIn",
    src: "motion-vocabulary",
    desc: "One master timeline nests five parts, placed with labels and overlaps. Play it, scrub it, reverse it, or jump to a label."
  },
  {
    name: "Scroll reveal",
    group: "scroll",
    builders: "revealOnScroll, scrubStatement",
    src: "scroll-effects",
    desc: "Things arrive as they scroll into view, and leave on the way back: cards rise, pop, zoom, or tilt, and a statement fills in word by word.",
    vars: [
      "Plop",
      "Zoom",
      "Tilt",
      "Words",
      "Letters"
    ]
  },
  {
    name: "Parallax",
    group: "scroll",
    builders: "parallax",
    src: "scroll-effects",
    desc: "Layers drift at different rates while their section passes."
  },
  {
    name: "Pinned",
    group: "scroll",
    builders: "pinnedScene",
    src: "scroll-effects",
    desc: "A section holds still while a timeline plays through it."
  },
  {
    name: "Stacking cards",
    group: "scroll",
    builders: "stackCards",
    src: "scroll-effects",
    desc: "Cards pin one over another into a deck, then leave together."
  },
  {
    name: "Zoom-through",
    group: "scroll",
    builders: "zoomThrough",
    src: "scroll-effects",
    desc: "A word grows until you pass through it into the image, or a window opens to full bleed.",
    vars: [
      "Clip"
    ]
  },
  {
    name: "Horizontal run",
    group: "scroll",
    builders: "horizontalRun, runDrift",
    src: "scroll-effects",
    desc: "A pinned track moves sideways as the page scrolls.",
    vars: [
      "Drift"
    ]
  },
  {
    name: "Waypoints",
    group: "scroll",
    builders: "scrollWaypoints",
    src: "scroll-effects",
    desc: "One element travels onto a marker in each later section."
  },
  {
    name: "Header",
    group: "scroll",
    builders: "navTheme, scrollDirection, headerShrink, headerSection",
    src: "scroll-effects",
    desc: "The header follows the page. It takes the theme of the section beneath it, hides going down, shrinks to a slim bar, or names the section you are in.",
    vars: [
      "Hide",
      "Both",
      "Shrink",
      "Section"
    ]
  },
  {
    name: "Section pager",
    group: "scroll",
    builders: "sectionPager",
    src: "section-pager",
    desc: "Full-screen sections change one at a time on a flick, swipe, or key, each chapter performing its entrance as it covers the last.",
    vars: [
      "Stack",
      "Loop"
    ]
  },
  {
    name: "Scroll wave",
    group: "scroll",
    builders: "scrollWave",
    src: "uniform-effects",
    desc: "Images ripple with scroll speed.",
    gl: true
  },
  {
    name: "Link hover",
    group: "pointer",
    builders: "textRoll, underlineSweep, directionalFill, imageZoom",
    src: "hover-effects",
    desc: "Links and cards answer the pointer: a label rolls, a line sweeps, a fill follows the side you came from, or the picture leans in.",
    vars: [
      "Underline",
      "Fill",
      "Zoom"
    ]
  },
  {
    name: "Feedback",
    group: "pointer",
    builders: "pressFeedback, shake, stateButton",
    src: "component-motion",
    desc: "A control answers what you did: it squashes and ripples under the press, shakes at a wrong answer, or spins, then shows how a request went.",
    vars: [
      "Shake",
      "Success",
      "Error"
    ]
  },
  {
    name: "Cursor",
    group: "pointer",
    builders: "cursorFollower, hoverPreview, imageTrail, spotlight",
    src: "pointer-effects",
    desc: "Something follows the mouse: an accent beside the cursor, a preview over a list, a trail of images, or a light that uncovers a second layer.",
    vars: [
      "Preview",
      "Trail",
      "Spotlight"
    ]
  },
  {
    name: "Attract",
    group: "pointer",
    builders: "magnetic, tilt, proximity, momentumHover",
    src: "pointer-effects",
    desc: "Things answer the mouse's nearness: a button leans in, a card tilts, a dock swells, or stickers get knocked along its path.",
    vars: [
      "Tilt",
      "Proximity",
      "Momentum"
    ]
  },
  {
    name: "Icon morph",
    group: "pointer",
    builders: "morphToggle",
    src: "svg-effects",
    desc: "An icon morphs between two shapes, such as menu and close."
  },
  {
    name: "Open and close",
    group: "pointer",
    builders: "menuOverlay, dialogMotion, disclosure, enterExit",
    src: "component-motion",
    desc: "Panels come and go: a full-screen menu, a dialog that grows out of its button, a drawer, an accordion, and an open that turns back if you change your mind halfway.",
    vars: [
      "Dialog",
      "Drawer",
      "Disclosure",
      "Interruptible"
    ]
  },
  {
    name: "Tab indicator",
    group: "pointer",
    builders: "tabIndicator",
    src: "component-motion",
    desc: "An underline slides onto the selected tab."
  },
  {
    name: "Flip",
    group: "pointer",
    builders: "captureLayout, captureShared, playShared",
    src: "layout-flip",
    desc: "Flip records where things were and animates them to where they are: tiles sliding as a layout filters, or a thumbnail morphing into the hero it opens.",
    vars: [
      "Shared"
    ]
  },
  {
    name: "Particles",
    group: "pointer",
    builders: "attachParticleEffect",
    src: "particle-effects",
    desc: "Particle treatments for buttons, cards, and links.",
    vars: [
      "Marquee",
      "Reactor",
      "Resolve",
      "Slipstream",
      "Ignite"
    ]
  },
  {
    name: "Physics",
    group: "pointer",
    builders: "burst, burstFrom, rain",
    src: "physics-effects",
    desc: "Pieces thrown under gravity: a cone of confetti arcs up and falls away, or it rains from above.",
    vars: [
      "Emoji",
      "Rain"
    ]
  },
  {
    name: "Blast-off",
    group: "pointer",
    builders: "blastOff",
    src: "blast-off",
    desc: "A pressed call to action sends the hero flying."
  },
  {
    name: "Hover lens",
    group: "pointer",
    builders: "hoverDistortion",
    src: "uniform-effects",
    desc: "A lens bends the image under the pointer.",
    gl: true
  },
  {
    name: "Drag track",
    group: "drag",
    builders: "dragTrack",
    src: "pointer-effects",
    desc: "Drag a row and throw it. It snaps to the nearest item."
  },
  {
    name: "Endless loop",
    group: "drag",
    builders: "dragLoop",
    src: "endless-drag",
    desc: "A wrapping loop with snap, wheel, and drift."
  },
  {
    name: "Wrapping grid",
    group: "drag",
    builders: "dragGrid",
    src: "endless-drag",
    desc: "A grid that wraps on both axes."
  },
  {
    name: "Card stack",
    group: "drag",
    builders: "flickCards",
    src: "endless-drag",
    desc: "A drag or flick deals the next card to the front."
  },
  {
    name: "Sortable",
    group: "drag",
    builders: "sortable",
    src: "sortable",
    desc: "Drag a handle to reorder a list, and its neighbors slide aside to make room."
  },
  {
    name: "Swipe to dismiss",
    group: "drag",
    builders: "swipeDismiss",
    src: "pointer-effects",
    desc: "Throw an item sideways and the list closes up behind it."
  }
];

export const EXHIBITS = DATA.map((e, i) => ({
  ...e,
  no: i + 1,
  slug: e.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
}));

export type NumberedExhibit = (typeof EXHIBITS)[number];

const REPO = "https://github.com/johnpolacek/animaxxing-skills/blob/main/skills/";

export const recipeUrl = (e: Exhibit) =>
  e.src === "motion-vocabulary"
    ? REPO + "animaxxing/references/motion-vocabulary.md"
    : REPO + (e.gl ? "animaxxing-webgl" : "animaxxing") + "/references/recipes/" + e.src + ".md";

export const two = (n: number) => String(n).padStart(2, "0");

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
/** 1 to 99 in words, capitalized: "Seventy-six". */
export const inWords = (n: number) => {
  const words = n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The collection's size, spelled out for copy. */
export const COUNT_WORDS = inWords(EXHIBITS.length);

/** An exhibit's two-digit number, by slug. */
export const numberOf = (slug: string) => two(EXHIBITS.find((e) => e.slug === slug)?.no ?? 0);

export const byGroup = (key: GroupKey) => EXHIBITS.filter((e) => e.group === key);

export const groupName = (key: GroupKey) => GROUPS.find((g) => g.key === key)!.name;

// Full spec sheets. Facts from split-entrances.md and motion-vocabulary.md.
export const SPECS: Record<string, [string, string][]> = {
  "line-mask": [
    ["Needs", "GSAP, SplitText"],
    ["Phase", "Intro and outro"],
    ["Motion", "yPercent 110 to 0, 0.28 s, power3.out, 0.05 s between lines"],
    ["Touch and keyboard", "Plays with the page. No input needed."],
    ["Reduced motion", "Never splits. The text is simply there."],
    ["Cleanup", "Reverts the split on completion. Accessible text kept."],
  ],
};
