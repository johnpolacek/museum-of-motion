// Museum of Motion: every exhibit is an effect recipe from the Animaxxing skills.
// `src` is the recipe file. `gl` marks animaxxing-webgl.

export type GroupKey = "time" | "scroll" | "pointer" | "drag";

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
    key: "time",
    name: "Time",
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
    group: "time",
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
    group: "time",
    builders: "charsRiseIn, charsCascadeIn, charsFlipIn, charsSpringIn, charsScatterIn, charsFallOut",
    src: "split-entrances",
    desc: "Letters rise, tip, spring, or scatter into place.",
    vars: [
      "Cascade",
      "Flip",
      "Spring",
      "Scatter",
      "Fall"
    ]
  },
  {
    name: "Word slide",
    group: "time",
    builders: "wordsSlideIn, wordsSlideOut",
    src: "split-entrances",
    desc: "Words zip together from alternating sides."
  },
  {
    name: "Scramble",
    group: "time",
    builders: "scrambleIn, scrambleOut",
    src: "split-entrances",
    desc: "Text resolves out of noise."
  },
  {
    name: "Glitch",
    group: "time",
    builders: "glitchIn, glitchOut, glitch",
    src: "split-entrances",
    desc: "The signal drops: bands, blocks, and letters jump, then snap clean.",
    vars: [
      "Blocks",
      "Skew",
      "Ghost",
      "Weight",
      "Scanline",
      "Image"
    ]
  },
  {
    name: "Typewriter",
    group: "time",
    builders: "typeIn, typeOut, retype",
    src: "typewriter",
    desc: "Typed one character at a time behind a caret, at a person's uneven pace.",
    vars: [
      "Retype"
    ]
  },
  {
    name: "Speak-in",
    group: "time",
    builders: "speakIn",
    src: "speak-in",
    desc: "Display copy arrives word by word, at speaking pace."
  },
  {
    name: "Weight wave",
    group: "time",
    builders: "charsWeightWave",
    src: "split-entrances",
    desc: "A wave of weight runs through a line."
  },
  {
    name: "Letter wave",
    group: "time",
    builders: "startWave",
    src: "wave",
    desc: "Every few seconds, a small move ripples across a heading."
  },
  {
    name: "Route letters",
    group: "time",
    builders: "buildPageIntro, buildPageOutro",
    src: "route-letters",
    desc: "Page items enter and leave with each route, headlines by letter."
  },
  {
    name: "Paired entrances",
    group: "time",
    builders: "fadeIn, riseIn, dropIn, slideIn, scaleIn, popIn, wipeUp, wipeAcross, flipIn, focusIn, weightIn",
    src: "motion-vocabulary",
    desc: "Eleven matched in and out pairs, from the plainest fade to a weight shift.",
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
    name: "Image reveal",
    group: "time",
    builders: "imageReveal",
    src: "media-effects",
    desc: "A wipe opens the frame while the image settles from a slight zoom."
  },
  {
    name: "Line draw",
    group: "time",
    builders: "drawIn, drawOut",
    src: "svg-effects",
    desc: "Strokes draw along their length."
  },
  {
    name: "Path follow",
    group: "time",
    builders: "followPath",
    src: "svg-effects",
    desc: "A small mark loops along a path."
  },
  {
    name: "Count-up",
    group: "time",
    builders: "countUp",
    src: "counters-and-marquees",
    desc: "Figures count to their final value and keep their format."
  },
  {
    name: "Odometer",
    group: "time",
    builders: "odometer",
    src: "counters-and-marquees",
    desc: "Digit columns roll to each new value, forward when it rises and back when it falls."
  },
  {
    name: "Marquee",
    group: "time",
    builders: "marquee",
    src: "counters-and-marquees",
    desc: "A row scrolls sideways forever and slows on hover."
  },
  {
    name: "Logo cycle",
    group: "time",
    builders: "logoCycle",
    src: "counters-and-marquees",
    desc: "One cell at a time swaps to the next logo."
  },
  {
    name: "Curtain",
    group: "time",
    builders: "curtain",
    src: "page-covers",
    desc: "Staggered panels cover the page, then sweep out the far edge."
  },
  {
    name: "Curve cover",
    group: "time",
    builders: "curveCover",
    src: "page-covers",
    desc: "A cover sweeps across with its leading edge bowed."
  },
  {
    name: "Preloader",
    group: "time",
    builders: "preloader",
    src: "page-covers",
    desc: "A count that follows real readiness and never runs backward."
  },
  {
    name: "Rain",
    group: "time",
    builders: "rain",
    src: "physics-effects",
    desc: "Pieces fall from above under gravity."
  },
  {
    name: "Shader wipe",
    group: "time",
    builders: "wipe",
    src: "uniform-effects",
    desc: "An image wipes in or out on the GPU.",
    gl: true
  },
  {
    name: "Sound cues",
    group: "time",
    builders: "soundCues",
    src: "sound-cues",
    desc: "Short sounds tied to motion, off until the visitor turns them on."
  },
  {
    name: "Scroll reveal",
    group: "scroll",
    builders: "revealOnScroll",
    src: "scroll-effects",
    desc: "Items rise in batches as they come into view."
  },
  {
    name: "Scrubbed statement",
    group: "scroll",
    builders: "scrubStatement",
    src: "scroll-effects",
    desc: "A statement fills in word by word as it is read."
  },
  {
    name: "Parallax",
    group: "scroll",
    builders: "parallax",
    src: "scroll-effects",
    desc: "Layers drift at different rates while their section passes."
  },
  {
    name: "Pinned scene",
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
    name: "Progress",
    group: "scroll",
    builders: "scrollProgress",
    src: "scroll-effects",
    desc: "A rule grows with reading progress."
  },
  {
    name: "Velocity skew",
    group: "scroll",
    builders: "velocitySkew",
    src: "scroll-effects",
    desc: "Things lean with scroll speed and spring back."
  },
  {
    name: "Header theme",
    group: "scroll",
    builders: "navTheme",
    src: "scroll-effects",
    desc: "The header takes the theme of the section beneath it."
  },
  {
    name: "Hide on scroll",
    group: "scroll",
    builders: "scrollDirection",
    src: "scroll-effects",
    desc: "The header hides going down and returns going up."
  },
  {
    name: "Smooth scroll",
    group: "scroll",
    builders: "lenisScroll, smootherScroll",
    src: "smooth-scroll",
    desc: "Eased page scrolling with Lenis or ScrollSmoother.",
    vars: [
      "Lenis",
      "ScrollSmoother"
    ]
  },
  {
    name: "Section pager",
    group: "scroll",
    builders: "sectionPager",
    src: "section-pager",
    desc: "Full-screen sections change one at a time on a flick, swipe, or key."
  },
  {
    name: "Scrubbed video",
    group: "scroll",
    builders: "scrubVideo",
    src: "media-effects",
    desc: "A video follows the scroll, both ways."
  },
  {
    name: "Frame sequence",
    group: "scroll",
    builders: "frameSequence",
    src: "media-effects",
    desc: "An image sequence on a canvas, scrubbed by scroll."
  },
  {
    name: "Shape scrub",
    group: "scroll",
    builders: "morphScrub",
    src: "svg-effects",
    desc: "A path morphs toward another shape as the page scrolls."
  },
  {
    name: "Text on path",
    group: "scroll",
    builders: "pathScrub, pathLoop",
    src: "svg-effects",
    desc: "A line of text rides a curve into place, or turns around a badge.",
    vars: [
      "Badge"
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
    name: "Label roll",
    group: "pointer",
    builders: "textRoll",
    src: "hover-effects",
    desc: "The label rolls up while a copy rolls in from below."
  },
  {
    name: "Underline sweep",
    group: "pointer",
    builders: "underlineSweep",
    src: "hover-effects",
    desc: "A line sweeps in from the start and out toward the end."
  },
  {
    name: "Image zoom",
    group: "pointer",
    builders: "imageZoom",
    src: "hover-effects",
    desc: "The image scales up slightly while its card is hot."
  },
  {
    name: "Directional fill",
    group: "pointer",
    builders: "directionalFill",
    src: "hover-effects",
    desc: "A fill slides in from the side the mouse came from and out the side it leaves."
  },
  {
    name: "Press feedback",
    group: "pointer",
    builders: "pressFeedback",
    src: "press-feedback",
    desc: "A button squashes under the press, springs back, and ripples from the spot pressed."
  },
  {
    name: "Shake",
    group: "pointer",
    builders: "shake",
    src: "motion-vocabulary",
    desc: "A wrong answer shakes its head, with the error spelled out beside it."
  },
  {
    name: "Hover preview",
    group: "pointer",
    builders: "hoverPreview",
    src: "media-effects",
    desc: "One floating image follows the mouse over a list."
  },
  {
    name: "Magnetic",
    group: "pointer",
    builders: "magnetic",
    src: "pointer-effects",
    desc: "The target leans toward the mouse and settles back."
  },
  {
    name: "Tilt",
    group: "pointer",
    builders: "tilt",
    src: "pointer-effects",
    desc: "A card tilts toward the mouse in 3D."
  },
  {
    name: "Spotlight",
    group: "pointer",
    builders: "spotlight",
    src: "pointer-effects",
    desc: "A circle follows the mouse and uncovers a second layer."
  },
  {
    name: "Cursor follower",
    group: "pointer",
    builders: "cursorFollower",
    src: "pointer-effects",
    desc: "An accent trails the mouse beside the native cursor."
  },
  {
    name: "Momentum hover",
    group: "pointer",
    builders: "momentumHover",
    src: "pointer-effects",
    desc: "Items get knocked along the pointer’s path, then settle."
  },
  {
    name: "Proximity",
    group: "pointer",
    builders: "proximity",
    src: "pointer-effects",
    desc: "Items swell as the mouse nears them."
  },
  {
    name: "Image trail",
    group: "pointer",
    builders: "imageTrail",
    src: "pointer-effects",
    desc: "Images spill out along the mouse’s path."
  },
  {
    name: "Icon morph",
    group: "pointer",
    builders: "morphToggle",
    src: "svg-effects",
    desc: "An icon morphs between two shapes, such as menu and close."
  },
  {
    name: "Menu overlay",
    group: "pointer",
    builders: "menuOverlay",
    src: "component-motion",
    desc: "A full-screen panel wipes in, then its links stagger in."
  },
  {
    name: "Enter and exit",
    group: "pointer",
    builders: "enterExit",
    src: "component-motion",
    desc: "One timeline holds a different entrance and exit, and survives interruption."
  },
  {
    name: "Dialog",
    group: "pointer",
    builders: "dialogMotion",
    src: "component-motion",
    desc: "A modal scales in over a fading backdrop."
  },
  {
    name: "Disclosure",
    group: "pointer",
    builders: "disclosure",
    src: "component-motion",
    desc: "An accordion panel grows to its content height."
  },
  {
    name: "Tab indicator",
    group: "pointer",
    builders: "tabIndicator",
    src: "component-motion",
    desc: "An underline slides onto the selected tab."
  },
  {
    name: "State button",
    group: "pointer",
    builders: "stateButton",
    src: "component-motion",
    desc: "A button spins while it waits, then draws a check, or shakes and tries again.",
    vars: [
      "Error"
    ]
  },
  {
    name: "Layout Flip",
    group: "pointer",
    builders: "captureLayout",
    src: "layout-flip",
    desc: "Items slide and resize as a layout filters or reorders."
  },
  {
    name: "Shared element",
    group: "pointer",
    builders: "captureShared, playShared",
    src: "layout-flip",
    desc: "A thumbnail morphs into the hero it opens."
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
    name: "Confetti",
    group: "pointer",
    builders: "burst, burstFrom",
    src: "physics-effects",
    desc: "A cone of pieces arcs up and falls away."
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
    desc: "Drag a handle to reorder a list; neighbors slide aside to make room."
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
