// Exhibits whose stage performs live, on a loop. The rest show their sample text at rest for now.
// Keep in step with STAGES in ./stage.ts, which holds the builders; this list stays import-free for server code.
export const LIVE_STAGES = new Set([
  "line-mask",
  "characters",
  "word-slide",
  "scramble",
  "speak-in",
  "weight-wave",
  "letter-wave",
  "route-letters",
  "paired-entrances",
  "image-reveal",
  "line-draw",
  "path-follow",
  "count-up",
  "marquee",
  "logo-cycle",
  "curtain",
  "curve-cover",
  "preloader",
  "rain",
  "sound-cues",
]);
