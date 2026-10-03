# Recipe: WebGL stage

One renderer and one fixed canvas per document. Recipes attach layers to it and detach them; the canvas exists only while something holds it. The stage caps pixel density, stops drawing when no layer is on screen or the tab is hidden, and survives a lost GPU context. Without WebGL, or with reduced motion, `holdStage` returns `null` and nothing is created.

Lifecycle: recipes such as [image planes](image-planes.md) hold the stage themselves; the framework controller only holds it directly to keep the canvas alive across routes (see [Wiring](#wiring)). Every hold ends with `release`; the last release destroys the canvas and frees the GPU context.

Dependencies: `gsap`, `ogl`.

```ts
import gsap from "gsap";
import { Renderer, Transform, type OGLRenderingContext } from "ogl";

/* Swap for the project's helper if it has one. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type StageOptions = {
  /** Highest device pixel ratio drawn. Defaults to 1.5 on coarse pointers, else 2. */
  maxDpr?: number;
  /** Most drawing-buffer pixels; lowers the ratio on large screens. */
  maxPixels?: number;
  /** Stacking of the fixed canvas. It never takes pointer input. */
  zIndex?: number;
};

/** A recipe's drawing on the shared stage. */
export type StageLayer = {
  /** Creates GL resources: on attach, and again after a context restore. Clean up and throw on failure. */
  build(gl: OGLRenderingContext, stage: Stage): void;
  /** Syncs uniforms and visibility to the DOM before each frame. */
  update(stage: Stage): void;
  /** Runs after each drawn frame. */
  rendered?(): void;
  /** Frees GL resources. `lost` means they died with the context: drop references and show the DOM. */
  dispose(lost: boolean): void;
};

export type Stage = {
  readonly canvas: HTMLCanvasElement;
  readonly scene: Transform;
  /** Canvas size in CSS pixels, and the ratio drawn at. */
  width: number;
  height: number;
  dpr: number;
  /** Builds a layer and returns its idempotent removal. */
  add(layer: StageLayer): () => void;
  /** Only active layers keep the stage ticking, such as while on screen. */
  setActive(layer: StageLayer, active: boolean): void;
  lost(): boolean;
};

export type StageHold = { stage: Stage; release: () => void };

let shared: { stage: Stage; holds: number; destroy: () => void } | undefined;
let unsupported = false;

/** Holds the document's stage, creating it on first use. Options apply only on creation. */
export function holdStage(options: StageOptions = {}): StageHold | null {
  if (typeof window === "undefined" || unsupported || prefersReducedMotion()) return null;
  if (!shared) {
    const created = createStage(options);
    if (!created) {
      unsupported = true;
      return null;
    }
    shared = { ...created, holds: 0 };
  }
  const entry = shared;
  entry.holds++;
  let released = false;
  return {
    stage: entry.stage,
    release() {
      if (released) return;
      released = true;
      if (--entry.holds > 0 || shared !== entry) return;
      shared = undefined;
      entry.destroy();
    },
  };
}

function createStage({
  maxDpr = window.matchMedia("(pointer: coarse)").matches ? 1.5 : 2,
  maxPixels = 4_000_000,
  zIndex = 1,
}: StageOptions): { stage: Stage; destroy: () => void } | null {
  const canvas = document.createElement("canvas");
  const attributes = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false };
  // Probe first: OGL's Renderer throws when no context can be created.
  const probe = canvas.getContext("webgl2", attributes) ?? canvas.getContext("webgl", attributes);
  if (!probe) return null;
  const webgl = typeof WebGL2RenderingContext !== "undefined" && probe instanceof WebGL2RenderingContext ? 2 : 1;
  // A new Renderer on the same canvas reuses its context with a fresh state cache.
  const createRenderer = () => new Renderer({ canvas, webgl, ...attributes });
  let renderer = createRenderer();
  const scene = new Transform();
  const layers = new Map<StageLayer, boolean>();
  let ticking = false;
  let lost = false;
  /** A frame threw: the DOM stays in charge until the stage is recreated. */
  let broken = false;

  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("data-webgl-stage", "");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: String(zIndex) });

  const stage: Stage = {
    canvas,
    scene,
    width: 0,
    height: 0,
    dpr: 1,
    add(layer) {
      if (broken) throw new Error("the WebGL stage stopped after a failed frame");
      layers.set(layer, false);
      if (!lost) {
        try {
          layer.build(renderer.gl, stage);
        } catch (error) {
          layers.delete(layer);
          throw error;
        }
      }
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        if (!layers.delete(layer)) return;
        layer.dispose(lost);
        // Clear its pixels now; a sleeping stage would otherwise keep them.
        if (!lost) frame();
        if (!anyActive()) sleep();
      };
    },
    setActive(layer, active) {
      if (!layers.has(layer)) return;
      layers.set(layer, active);
      if (active) wake();
      // A sleeping stage would otherwise keep this layer's last frame on screen.
      else if (!ticking && !anyActive()) frame();
    },
    lost: () => lost,
  };

  const anyActive = () => [...layers.values()].some(Boolean);

  const resize = (force = false) => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr, Math.sqrt(maxPixels / Math.max(1, width * height)));
    if (!force && width === stage.width && height === stage.height && dpr === stage.dpr) return;
    Object.assign(stage, { width, height, dpr });
    renderer.dpr = dpr;
    renderer.setSize(width, height);
    // setSize writes pixel sizes; keep the canvas following the viewport.
    Object.assign(canvas.style, { width: "100%", height: "100%" });
  };

  const frame = () => {
    if (lost || broken) return;
    try {
      layers.forEach((_, layer) => layer.update(stage));
      renderer.render({ scene });
      layers.forEach((_, layer) => layer.rendered?.());
    } catch (error) {
      // Hand every image back to the DOM rather than throw inside GSAP's ticker each frame.
      broken = true;
      sleep();
      layers.forEach((_, layer) => layer.dispose(false));
      // Hide whatever the failed frame presented.
      canvas.style.display = "none";
      console.error(error);
    }
  };
  /** Draws, then sleeps once nothing is active: the final frame clears the last visible layer. */
  const tick = () => {
    frame();
    if (!anyActive()) sleep();
  };
  const wake = () => {
    if (ticking || lost || broken || document.hidden || !anyActive()) return;
    ticking = true;
    gsap.ticker.add(tick);
  };
  const sleep = () => {
    if (!ticking) return;
    ticking = false;
    gsap.ticker.remove(tick);
  };

  const onResize = () => resize();
  // Moving to a screen with another pixel ratio fires no resize event.
  let ratioQuery: MediaQueryList | undefined;
  const onRatio = () => {
    ratioQuery?.removeEventListener("change", onRatio);
    ratioQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    ratioQuery.addEventListener("change", onRatio);
    resize();
  };
  const onVisibility = () => (document.hidden ? sleep() : wake());
  const onLost = (event: Event) => {
    // Without preventDefault the browser never restores the context.
    event.preventDefault();
    lost = true;
    sleep();
    layers.forEach((_, layer) => layer.dispose(true));
  };
  const onRestored = () => {
    if (broken) return;
    lost = false;
    renderer = createRenderer();
    resize(true);
    layers.forEach((_, layer) => {
      try {
        layer.build(renderer.gl, stage);
      } catch {
        layers.delete(layer);
      }
    });
    wake();
  };

  document.body.append(canvas);
  resize(true);
  window.addEventListener("resize", onResize);
  onRatio();
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  const destroy = () => {
    sleep();
    window.removeEventListener("resize", onResize);
    ratioQuery?.removeEventListener("change", onRatio);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", onRestored);
    layers.forEach((_, layer) => layer.dispose(lost));
    layers.clear();
    // Free the GPU context now rather than at garbage collection.
    if (!lost) renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
  };

  return { stage, destroy };
}
```

The canvas covers the viewport above the page at `zIndex` 1, so anything the page stacks above it (a fixed header at `z-index: 10`) still covers the planes; content overlapping an image without its own stacking context sits under them. Raise the page's overlays or lower `zIndex` behind a transparent page to suit the layout. The first holder's options win; pass the same options everywhere or hold the stage once at the root.

## Budgets

- `maxDpr` defaults to 1.5 on coarse pointers and 2 elsewhere; `maxPixels` (4 million) lowers it further on large screens. Match the framework skill's `references/devices.md` tiers.
- Drawing stops whenever no layer is active or the tab is hidden, and a context loss stops it until the restore.
- A frame that throws hides the canvas, hands every image back to the DOM, and refuses new layers until the last hold releases and a new stage is created.
- Each layer is a draw call and a program; keep a page to about a dozen live planes, fewer on phones.

## Wiring

```ts
// Example: the persistent shell holds the stage so the canvas and context outlive each route.
const shellHold = holdStage({ maxDpr: 2 });
// Pages build and revert image planes as they mount and unmount.
// When the shell itself unmounts:
shellHold?.release();
```

For where that hold lives in each router, see the framework skill's `references/transition-archetypes.md`, **Persistent WebGL canvas**.

## Controller contract

| Phase | Call |
|---|---|
| initial state | None: without a hold there is no canvas. |
| intro | Recipes hold the stage as they build. The shell may hold it once to keep it across routes. |
| settled | Nothing; the stage wakes and sleeps with its active layers and the tab. |
| outro | Nothing; layers keep drawing until their recipe reverts. |
| unmount | Each recipe's `revert` removes its layer and releases its hold. The last `release` removes the canvas and frees the context. |

A lost context hands every image back to the DOM; the restore rebuilds each layer from its retained source, without refetching.
