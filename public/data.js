// Museum of Motion: every exhibit is an effect from the Animaxxing skills.
// Descriptions paraphrase each recipe's own summary. `src` is the recipe file; `gl` marks animaxxing-webgl.
// `g` is a notation hint used by the Notation mock: ease or pattern, then a stagger count.
window.GROUPS = [
  { key: 'time', name: 'Time', note: 'Plays once the page starts it: entrances, exits, loops.' },
  { key: 'scroll', name: 'Scroll', note: 'Scroll position or scroll speed drives it.' },
  { key: 'pointer', name: 'Pointer', note: 'Hover, click, or key sets it off.' },
  { key: 'drag', name: 'Drag', note: 'The hand moves it directly, and it keeps going when thrown.' },
];

window.EXHIBITS = [
  // Time
  { name: 'Line mask', group: 'time', builders: 'linesMaskIn, linesMaskOut', src: 'split-entrances', desc: 'Whole lines wipe up from behind masks.', vars: ['Ellipse', 'Highlight'], g: 'p3o:5' },
  { name: 'Characters', group: 'time', builders: 'charsRiseIn, charsCascadeIn, charsFlipIn, charsSpringIn, charsScatterIn, charsFallOut', src: 'split-entrances', desc: 'Letters rise, tip, spring, or scatter into place.', vars: ['Cascade', 'Flip', 'Spring', 'Scatter', 'Fall'], g: 'p3o:9' },
  { name: 'Word slide', group: 'time', builders: 'wordsSlideIn, wordsSlideOut', src: 'split-entrances', desc: 'Words zip together from alternating sides.', g: 'p2o:4' },
  { name: 'Scramble', group: 'time', builders: 'scrambleIn, scrambleOut', src: 'split-entrances', desc: 'Text resolves out of noise.', g: 'noise' },
  { name: 'Speak-in', group: 'time', builders: 'speakIn', src: 'speak-in', desc: 'Display copy arrives word by word, at speaking pace.', g: 'speak' },
  { name: 'Weight wave', group: 'time', builders: 'charsWeightWave', src: 'split-entrances', desc: 'A wave of weight runs through a line.', g: 'dip:7' },
  { name: 'Letter wave', group: 'time', builders: 'startWave', src: 'wave', desc: 'Every few seconds, a small move ripples across a heading.', g: 'ripple' },
  { name: 'Route letters', group: 'time', builders: 'buildPageIntro, buildPageOutro', src: 'route-letters', desc: 'Page items enter and leave with each route, headlines by letter.', g: 'p3o:7' },
  { name: 'Paired entrances', group: 'time', builders: 'fadeIn, riseIn, dropIn, slideIn, scaleIn, popIn, wipeUp, wipeAcross, flipIn, focusIn, weightIn', src: 'motion-vocabulary', desc: 'Eleven matched in and out pairs, from the plainest fade to a weight shift.', vars: ['Fade', 'Rise', 'Drop', 'Slide', 'Scale', 'Pop', 'Wipe up', 'Wipe across', 'Flip', 'Focus', 'Weight'], g: 'p2o:1' },
  { name: 'Image reveal', group: 'time', builders: 'imageReveal', src: 'media-effects', desc: 'A wipe opens the frame while the image settles from a slight zoom.', g: 'p3o:1' },
  { name: 'Line draw', group: 'time', builders: 'drawIn, drawOut', src: 'svg-effects', desc: 'Strokes draw along their length.', g: 'io:3' },
  { name: 'Path follow', group: 'time', builders: 'followPath', src: 'svg-effects', desc: 'A small mark loops along a path.', g: 'orbit' },
  { name: 'Count-up', group: 'time', builders: 'countUp', src: 'counters-and-marquees', desc: 'Figures count to their final value and keep their format.', g: 'p3o:1' },
  { name: 'Marquee', group: 'time', builders: 'marquee', src: 'counters-and-marquees', desc: 'A row scrolls sideways forever and slows on hover.', g: 'saw' },
  { name: 'Logo cycle', group: 'time', builders: 'logoCycle', src: 'counters-and-marquees', desc: 'One cell at a time swaps to the next logo.', g: 'steps' },
  { name: 'Curtain', group: 'time', builders: 'curtain', src: 'page-covers', desc: 'Staggered panels cover the page, then sweep out the far edge.', g: 'io:5' },
  { name: 'Curve cover', group: 'time', builders: 'curveCover', src: 'page-covers', desc: 'A cover sweeps across with its leading edge bowed.', g: 'bow' },
  { name: 'Preloader', group: 'time', builders: 'preloader', src: 'page-covers', desc: 'A count that follows real readiness and never runs backward.', g: 'ready' },
  { name: 'Rain', group: 'time', builders: 'rain', src: 'physics-effects', desc: 'Pieces fall from above under gravity.', g: 'fall:6' },
  { name: 'Shader wipe', group: 'time', builders: 'wipe', src: 'uniform-effects', gl: true, desc: 'An image wipes in or out on the GPU.', g: 'p3o:1' },
  { name: 'Sound cues', group: 'time', builders: 'soundCues', src: 'sound-cues', desc: 'Short sounds tied to motion, off until the visitor turns them on.', g: 'pulse' },
  // Scroll
  { name: 'Scroll reveal', group: 'scroll', builders: 'revealOnScroll', src: 'scroll-effects', desc: 'Items rise in batches as they come into view.', g: 'p2o:4' },
  { name: 'Scrubbed statement', group: 'scroll', builders: 'scrubStatement', src: 'scroll-effects', desc: 'A statement fills in word by word as it is read.', g: 'lin:6' },
  { name: 'Parallax', group: 'scroll', builders: 'parallax', src: 'scroll-effects', desc: 'Layers drift at different rates while their section passes.', g: 'fan' },
  { name: 'Pinned scene', group: 'scroll', builders: 'pinnedScene', src: 'scroll-effects', desc: 'A section holds still while a timeline plays through it.', g: 'pin' },
  { name: 'Horizontal run', group: 'scroll', builders: 'horizontalRun, runDrift', src: 'scroll-effects', desc: 'A pinned track moves sideways as the page scrolls.', vars: ['Drift'], g: 'pin' },
  { name: 'Waypoints', group: 'scroll', builders: 'scrollWaypoints', src: 'scroll-effects', desc: 'One element travels onto a marker in each later section.', g: 'stairs' },
  { name: 'Progress', group: 'scroll', builders: 'scrollProgress', src: 'scroll-effects', desc: 'A rule grows with reading progress.', g: 'lin:1' },
  { name: 'Velocity skew', group: 'scroll', builders: 'velocitySkew', src: 'scroll-effects', desc: 'Things lean with scroll speed and spring back.', g: 'skew' },
  { name: 'Header theme', group: 'scroll', builders: 'navTheme', src: 'scroll-effects', desc: 'The header takes the theme of the section beneath it.', g: 'steps' },
  { name: 'Hide on scroll', group: 'scroll', builders: 'scrollDirection', src: 'scroll-effects', desc: 'The header hides going down and returns going up.', g: 'toggle' },
  { name: 'Smooth scroll', group: 'scroll', builders: 'lenisScroll, smootherScroll', src: 'smooth-scroll', desc: 'Eased page scrolling with Lenis or ScrollSmoother.', vars: ['Lenis', 'ScrollSmoother'], g: 'lag' },
  { name: 'Section pager', group: 'scroll', builders: 'sectionPager', src: 'section-pager', desc: 'Full-screen sections change one at a time on a flick, swipe, or key.', g: 'steps' },
  { name: 'Scrubbed video', group: 'scroll', builders: 'scrubVideo', src: 'media-effects', desc: 'A video follows the scroll, both ways.', g: 'lin:1' },
  { name: 'Frame sequence', group: 'scroll', builders: 'frameSequence', src: 'media-effects', desc: 'An image sequence on a canvas, scrubbed by scroll.', g: 'frames' },
  { name: 'Shape scrub', group: 'scroll', builders: 'morphScrub', src: 'svg-effects', desc: 'A path morphs toward another shape as the page scrolls.', g: 'bow' },
  { name: 'Scroll wave', group: 'scroll', builders: 'scrollWave', src: 'uniform-effects', gl: true, desc: 'Images ripple with scroll speed.', g: 'ripple' },
  // Pointer
  { name: 'Label roll', group: 'pointer', builders: 'textRoll', src: 'hover-effects', desc: 'The label rolls up while a copy rolls in from below.', g: 'swap' },
  { name: 'Underline sweep', group: 'pointer', builders: 'underlineSweep', src: 'hover-effects', desc: 'A line sweeps in from the start and out toward the end.', g: 'sweep' },
  { name: 'Image zoom', group: 'pointer', builders: 'imageZoom', src: 'hover-effects', desc: 'The image scales up slightly while its card is hot.', g: 'p2o:1' },
  { name: 'Hover preview', group: 'pointer', builders: 'hoverPreview', src: 'media-effects', desc: 'One floating image follows the mouse over a list.', g: 'lag' },
  { name: 'Magnetic', group: 'pointer', builders: 'magnetic', src: 'pointer-effects', desc: 'The target leans toward the mouse and settles back.', g: 'field' },
  { name: 'Tilt', group: 'pointer', builders: 'tilt', src: 'pointer-effects', desc: 'A card tilts toward the mouse in 3D.', g: 'skew' },
  { name: 'Cursor follower', group: 'pointer', builders: 'cursorFollower', src: 'pointer-effects', desc: 'An accent trails the mouse beside the native cursor.', g: 'lag' },
  { name: 'Momentum hover', group: 'pointer', builders: 'momentumHover', src: 'pointer-effects', desc: 'Items get knocked along the pointer’s path, then settle.', g: 'el:3' },
  { name: 'Proximity', group: 'pointer', builders: 'proximity', src: 'pointer-effects', desc: 'Items swell as the mouse nears them.', g: 'field' },
  { name: 'Image trail', group: 'pointer', builders: 'imageTrail', src: 'pointer-effects', desc: 'Images spill out along the mouse’s path.', g: 'trail' },
  { name: 'Icon morph', group: 'pointer', builders: 'morphToggle', src: 'svg-effects', desc: 'An icon morphs between two shapes, such as menu and close.', g: 'toggle' },
  { name: 'Menu overlay', group: 'pointer', builders: 'menuOverlay', src: 'component-motion', desc: 'A full-screen panel wipes in, then its links stagger in.', g: 'p3o:5' },
  { name: 'Enter and exit', group: 'pointer', builders: 'enterExit', src: 'component-motion', desc: 'One timeline holds a different entrance and exit, and survives interruption.', g: 'hold' },
  { name: 'Dialog', group: 'pointer', builders: 'dialogMotion', src: 'component-motion', desc: 'A modal scales in over a fading backdrop.', g: 'p2o:2' },
  { name: 'Disclosure', group: 'pointer', builders: 'disclosure', src: 'component-motion', desc: 'An accordion panel grows to its content height.', g: 'io:1' },
  { name: 'Tab indicator', group: 'pointer', builders: 'tabIndicator', src: 'component-motion', desc: 'An underline slides onto the selected tab.', g: 'stairs' },
  { name: 'Layout Flip', group: 'pointer', builders: 'captureLayout', src: 'layout-flip', desc: 'Items slide and resize as a layout filters or reorders.', g: 'io:4' },
  { name: 'Shared element', group: 'pointer', builders: 'captureShared, playShared', src: 'layout-flip', desc: 'A thumbnail morphs into the hero it opens.', g: 'io:1' },
  { name: 'Particles', group: 'pointer', builders: 'attachParticleEffect', src: 'particle-effects', desc: 'Particle treatments for buttons, cards, and links.', vars: ['Marquee', 'Reactor', 'Resolve', 'Slipstream', 'Ignite'], g: 'burst' },
  { name: 'Confetti', group: 'pointer', builders: 'burst, burstFrom', src: 'physics-effects', desc: 'A cone of pieces arcs up and falls away.', g: 'arc:5' },
  { name: 'Blast-off', group: 'pointer', builders: 'blastOff', src: 'blast-off', desc: 'A pressed call to action sends the hero flying.', g: 'burst' },
  { name: 'Hover lens', group: 'pointer', builders: 'hoverDistortion', src: 'uniform-effects', gl: true, desc: 'A lens bends the image under the pointer.', g: 'field' },
  // Drag
  { name: 'Drag track', group: 'drag', builders: 'dragTrack', src: 'pointer-effects', desc: 'Drag a row and throw it. It snaps to the nearest item.', g: 'throw' },
  { name: 'Endless loop', group: 'drag', builders: 'dragLoop', src: 'endless-drag', desc: 'A wrapping loop with snap, wheel, and drift.', g: 'saw' },
  { name: 'Wrapping grid', group: 'drag', builders: 'dragGrid', src: 'endless-drag', desc: 'A grid that wraps on both axes.', g: 'grid' },
  { name: 'Card stack', group: 'drag', builders: 'flickCards', src: 'endless-drag', desc: 'A drag or flick deals the next card to the front.', g: 'throw' },
];

window.EXHIBITS.forEach((e, i) => { e.no = i + 1; });

const REPO = 'https://github.com/johnpolacek/animaxxing-skills/blob/main/skills/';
window.recipeUrl = (e) => e.src === 'motion-vocabulary'
  ? REPO + 'animaxxing/references/motion-vocabulary.md'
  : REPO + (e.gl ? 'animaxxing-webgl' : 'animaxxing') + '/references/recipes/' + e.src + '.md';
window.two = (n) => String(n).padStart(2, '0');
window.byGroup = (key) => window.EXHIBITS.filter((e) => e.group === key);

// The sample drill-in shared by every mock. Facts from split-entrances.md and motion-vocabulary.md.
window.SAMPLE = {
  exhibit: window.EXHIBITS[0],
  text: 'Every way a page can move.',
  fields: [
    ['Builders', 'linesMaskIn, linesMaskOut'],
    ['Needs', 'GSAP, SplitText'],
    ['Phase', 'Intro and outro'],
    ['Motion', 'yPercent 110 to 0, 0.28 s, power3.out, 0.05 s between lines'],
    ['Touch and keyboard', 'Plays with the page. No input needed.'],
    ['Reduced motion', 'Never splits. The text is simply there.'],
    ['Cleanup', 'Reverts the split on completion. Accessible text kept.'],
  ],
};
