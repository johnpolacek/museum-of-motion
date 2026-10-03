# Recipe: image planes

A WebGL plane that draws an `<img>` in its exact box, following it through scroll, resize, transforms, and smooth scrollers. The real `<img>` stays in the page as the accessible content and fallback: it turns transparent after the stage prepares its plane, and it returns the moment WebGL is missing, the image cannot be read, the context is lost, or the plane reverts. Both representations respect CSS visibility. The default shaders carry the [uniform effects](uniform-effects.md); with no effect attached, the plane draws the plain image.

Lifecycle: the framework controller builds a plane once its image is mounted, awaits `ready` (within its initialization deadline) before an intro that depends on it, and calls `revert` on unmount after reverting the plane's effects. Planes hold the [WebGL stage](webgl-stage.md) while they exist.

Dependencies: `gsap`, `ogl`, `webgl-stage.ts` from this skill.

## Images need CORS

WebGL cannot read an image the browser treats as cross-origin without permission. Same-origin, `data:`, and `blob:` images work. For a CDN, serve `Access-Control-Allow-Origin` and mark the image `crossorigin="anonymous"` in the markup; the plane otherwise loads a second, CORS-mode copy of `currentSrc`, which fetches the file again. An image that stays unreadable keeps its DOM rendering, and `ready` resolves `false`.

```ts
import gsap from "gsap";
import { Mesh, Plane, Program, Texture, type OGLRenderingContext } from "ogl";
import { holdStage, type Stage, type StageLayer, type StageOptions } from "./webgl-stage";

export type Uniform<T> = { value: T };

export type PlaneUniforms = {
  uTexture: Uniform<Texture | null>;
  /** The image box in CSS pixels from the viewport's top left: left, top, width, height. */
  uRect: Uniform<number[]>;
  uViewport: Uniform<number[]>;
  /** Texture scale for `object-fit: cover` or `contain`. */
  uUvScale: Uniform<number[]>;
  /** 1 while `object-fit: contain` leaves transparent bands. */
  uContain: Uniform<number>;
  /** Pointer in plane coordinates: 0 to 1, from the bottom left. */
  uMouse: Uniform<number[]>;
  /** Hover lens strength; 0 at rest. */
  uHover: Uniform<number>;
  /** Scroll bend in CSS pixels; 0 at rest. */
  uVelocity: Uniform<number>;
  /** Wipe: 0 hides the image, 1 shows it whole. */
  uProgress: Uniform<number>;
  /** Seconds, from GSAP's ticker. */
  uTime: Uniform<number>;
};

export type ImagePlaneOptions = {
  /** Replacement shaders. Keep `uRect`, `uViewport`, and `uTexture`, and write premultiplied color. */
  vertex?: string;
  fragment?: string;
  /** Extra uniforms for replacement shaders. */
  uniforms?: Record<string, Uniform<unknown>>;
  /** Grid cells per side for vertex effects. Defaults to 12 on coarse pointers, else 24. */
  segments?: number;
  /** Used only if this plane creates the stage. */
  stage?: StageOptions;
};

export type ImagePlane = {
  readonly image: HTMLImageElement;
  /** Tween these with GSAP; they survive a context loss and restore. */
  readonly uniforms: PlaneUniforms & Record<string, Uniform<unknown>>;
  /** False when the page keeps the plain image: no WebGL, reduced motion, an unreadable image, or after revert. */
  readonly webgl: boolean;
  /** True after a prepared frame (which may be hidden by CSS visibility); false for the DOM fallback. */
  readonly ready: Promise<boolean>;
  /** True while the canvas owns the rendering, including an intentionally hidden plane. */
  live(): boolean;
  revert(): void;
};

export const VERTEX = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;
uniform vec4 uRect;
uniform vec2 uViewport;
uniform float uVelocity;
varying vec2 vUv;

void main() {
  vUv = uv;
  // Plane space (-0.5 to 0.5, y up) to CSS pixels from the viewport's top left.
  vec2 pixel = uRect.xy + vec2(position.x + 0.5, 0.5 - position.y) * uRect.zw;
  // Scroll wave: the middle of the image bends furthest.
  pixel.y += sin(uv.x * 3.14159265) * uVelocity;
  vec2 clip = pixel / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

export const FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uUvScale;
uniform float uContain;
uniform vec2 uMouse;
uniform float uHover;
uniform float uProgress;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  // Hover: a lens that magnifies toward the pointer.
  vec2 toMouse = vUv - uMouse;
  float lens = (1.0 - smoothstep(0.0, 0.45, length(toMouse))) * uHover;
  vec2 uv = (vUv - toMouse * lens * 0.25 - 0.5) * uUvScale + 0.5;
  float inside = mix(1.0, step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0), uContain);
  vec4 color = texture2D(uTexture, clamp(uv, 0.0, 1.0));
  // Wipe: top to bottom behind a noisy edge.
  float edge = 0.15;
  float front = uProgress * (1.0 + edge);
  float depth = (1.0 - vUv.y) * (1.0 - edge) + noise(vUv * 6.0) * edge;
  float alpha = color.a * inside * (1.0 - smoothstep(front - edge, front, depth));
  gl_FragColor = vec4(color.rgb * alpha, alpha);
}
`;

/** Resolves once the image has pixels; false if it fails or the signal aborts. */
function loaded(image: HTMLImageElement, signal: AbortSignal): Promise<boolean> {
  if (image.complete) return Promise.resolve(image.naturalWidth > 0);
  return new Promise((resolve) => {
    image.addEventListener("load", () => resolve(true), { once: true, signal });
    image.addEventListener("error", () => resolve(false), { once: true, signal });
    signal.addEventListener("abort", () => resolve(false), { once: true });
  });
}

/** False when drawing the image taints a canvas, which WebGL would refuse. */
function readable(image: HTMLImageElement): boolean {
  try {
    const context = document.createElement("canvas").getContext("2d");
    context?.drawImage(image, 0, 0, 1, 1);
    context?.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}

/** The image itself when readable, else a CORS-mode copy, else null. */
async function textureSource(image: HTMLImageElement, signal: AbortSignal): Promise<HTMLImageElement | null> {
  if (!(await loaded(image, signal))) return null;
  // Decode off the main thread so the texture upload does not.
  await image.decode().catch(() => {});
  if (readable(image)) return image;
  if (image.crossOrigin !== null || signal.aborted) return null;
  const copy = new Image();
  copy.crossOrigin = "anonymous";
  copy.src = image.currentSrc || image.src;
  signal.addEventListener("abort", () => copy.removeAttribute("src"), { once: true });
  if (!(await loaded(copy, signal))) return null;
  await copy.decode().catch(() => {});
  return readable(copy) ? copy : null;
}

const coarse = () => window.matchMedia("(pointer: coarse)").matches;

export function imagePlane(
  image: HTMLImageElement,
  { vertex = VERTEX, fragment = FRAGMENT, uniforms: extra = {}, segments, stage: stageOptions }: ImagePlaneOptions = {},
): ImagePlane {
  const uniforms: ImagePlane["uniforms"] = {
    uTexture: { value: null },
    uRect: { value: [0, 0, 1, 1] },
    uViewport: { value: [1, 1] },
    uUvScale: { value: [1, 1] },
    uContain: { value: 0 },
    uMouse: { value: [0.5, 0.5] },
    uHover: { value: 0 },
    uVelocity: { value: 0 },
    uProgress: { value: 1 },
    uTime: { value: 0 },
    ...extra,
  };
  let settle: (live: boolean) => void = () => {};
  const ready = new Promise<boolean>((resolve) => (settle = resolve));
  const hold = holdStage(stageOptions);
  const aborter = new AbortController();
  const opacity = [image.style.getPropertyValue("opacity"), image.style.getPropertyPriority("opacity")] as const;
  let live = false;
  let done = false;
  let active = false;
  let prepared = false;
  let source: HTMLImageElement | undefined;
  let fit = "fill";
  let gl: OGLRenderingContext | undefined;
  let mesh: Mesh | undefined;
  let program: Program | undefined;
  let geometry: Plane | undefined;
  let texture: Texture | undefined;
  let remove: (() => void) | undefined;
  let observer: IntersectionObserver | undefined;

  const showImage = () => {
    if (opacity[0]) image.style.setProperty("opacity", opacity[0], opacity[1]);
    else image.style.removeProperty("opacity");
  };

  const layer: StageLayer = {
    build(context: OGLRenderingContext, stage: Stage) {
      gl = context;
      try {
        const cells = segments ?? (coarse() ? 12 : 24);
        geometry = new Plane(context, { widthSegments: cells, heightSegments: cells });
        texture = new Texture(context, { image: source, generateMipmaps: false, minFilter: context.LINEAR });
        uniforms.uTexture.value = texture;
        program = new Program(context, { vertex, fragment, uniforms, transparent: true, depthTest: false, depthWrite: false });
        if (!context.getProgramParameter(program.program, context.LINK_STATUS) && !context.isContextLost()) {
          throw new Error("image plane shaders failed to link");
        }
        mesh = new Mesh(context, { geometry, program });
        mesh.visible = false;
        mesh.setParent(stage.scene);
      } catch (error) {
        layer.dispose(false);
        throw error;
      }
    },
    update(stage: Stage) {
      if (!mesh || !source) return;
      const box = image.getBoundingClientRect();
      prepared = active && box.width > 0 && box.height > 0;
      // The canvas is outside the image's ancestors, so follow their visibility explicitly.
      mesh.visible = prepared && getComputedStyle(image).visibility === "visible";
      if (!prepared) return;
      const rect = uniforms.uRect.value;
      rect[0] = box.left;
      rect[1] = box.top;
      rect[2] = box.width;
      rect[3] = box.height;
      uniforms.uViewport.value[0] = stage.width;
      uniforms.uViewport.value[1] = stage.height;
      // object-fit, centered; object-position is not reproduced.
      const ratio = box.width / box.height / (source.naturalWidth / source.naturalHeight);
      const scale = uniforms.uUvScale.value;
      if (fit === "cover") [scale[0], scale[1]] = ratio > 1 ? [1, 1 / ratio] : [ratio, 1];
      else if (fit === "contain") [scale[0], scale[1]] = ratio > 1 ? [ratio, 1] : [1, 1 / ratio];
      else [scale[0], scale[1]] = [1, 1];
      uniforms.uContain.value = fit === "contain" ? 1 : 0;
      uniforms.uTime.value = gsap.ticker.time;
    },
    rendered() {
      if (live || !mesh || !prepared) return;
      // A successful frame can be intentionally hidden by an ancestor. Resolve readiness
      // then too, so the controller can await it before revealing that ancestor.
      // Hide the DOM before the first visible frame, including wipe intros.
      live = true;
      image.style.setProperty("opacity", "0");
      settle(true);
    },
    dispose(lost: boolean) {
      mesh?.setParent(null);
      if (!lost && gl && !gl.isContextLost()) {
        if (program) {
          // OGL caches every uniform location it sets; prune them for a long-lived stage.
          const cache = gl.renderer.state.uniformLocations;
          program.uniformLocations?.forEach((location) => cache.delete(location));
          gl.deleteShader(program.vertexShader);
          gl.deleteShader(program.fragmentShader);
          program.remove();
        }
        geometry?.remove();
        if (texture) gl.deleteTexture(texture.texture);
      }
      mesh = program = geometry = texture = gl = undefined;
      prepared = false;
      uniforms.uTexture.value = null;
      if (live) {
        live = false;
        showImage();
      }
      settle(false);
    },
  };

  const plane: ImagePlane = {
    image,
    uniforms,
    get webgl() {
      return !!hold && !done;
    },
    ready,
    live: () => live,
    revert() {
      if (done) return;
      done = true;
      aborter.abort();
      observer?.disconnect();
      remove?.();
      hold?.release();
      gsap.killTweensOf(Object.values(uniforms));
      showImage();
      settle(false);
    },
  };
  if (!hold) {
    settle(false);
    return plane;
  }

  textureSource(image, aborter.signal)
    .then((readableSource) => {
      if (done) return;
      if (!readableSource) {
        plane.revert();
        return;
      }
      source = readableSource;
      fit = getComputedStyle(image).objectFit;
      remove = hold.stage.add(layer);
      if (hold.stage.lost()) settle(false);
      // Draw a little before the image enters the viewport; stop once it is well clear.
      observer = new IntersectionObserver(
        (entries) => {
          active = entries[entries.length - 1]?.isIntersecting ?? false;
          hold.stage.setActive(layer, active);
        },
        { rootMargin: "25%" },
      );
      observer.observe(image);
    })
    .catch((error) => {
      plane.revert();
      console.error(error);
    });

  return plane;
}
```

The plane follows computed `visibility`, including inheritance from a hidden wrapper. A measurable hidden image can resolve `ready` after a successful stage frame without drawing; the controller can then reveal its wrapper without a readiness deadlock. Use wrapper `visibility` for framework gates.

Other CSS paint is not reproduced: ancestor clipping, `border-radius`, filters, and CSS opacity need a replacement shader, and `object-position` is always centered. Keep images out of WebGL when these features are essential. A responsive image that switches `currentSrc` keeps its first texture; rebuild the plane if the switch matters. One owner per target: the plane owns the image's inline `opacity` and restores the value it found, so never hide the image through its own inline `opacity` (use `visibility` on a wrapper or in a class the framework removes). Effects that change the image's transform conflict with its plane too.

## Wiring

```ts
// Example: planes for every marked image, with effects, and cleanup in reverse.
const planes = [...document.querySelectorAll<HTMLImageElement>("img[data-webgl]")].map((image) => imagePlane(image));
const effects = planes.map((plane) => [hoverDistortion(plane), scrollWave(plane)]);
// On unmount:
effects.flat().forEach((revert) => revert());
planes.forEach((plane) => plane.revert());
```

## Controller contract

| Phase | Call |
|---|---|
| initial state | None: the `<img>` is the no-script, no-WebGL, and reduced-motion state. |
| intro | `imagePlane(image)` once the image is mounted; await `ready` within the framework's deadline if the intro needs the plane. |
| settled | Nothing; the plane draws while within a quarter viewport of the screen. |
| outro | Effects such as a wipe exit; the plane keeps drawing. |
| unmount | Revert effects, then `revert()`: frees the program, shaders, buffers, and texture, disconnects the observer, releases the stage, and restores the image's `opacity`. |

A lost context shows the `<img>` at once; the restore rebuilds the plane from its retained source and keeps every uniform value.
