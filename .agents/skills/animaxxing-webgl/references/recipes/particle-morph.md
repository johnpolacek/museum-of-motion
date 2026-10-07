# Recipe: particle morph

Thousands of points on the GPU that GSAP moves between shapes: a word, a logo, a sphere, a scatter. One uniform, `uShape`, runs from 0 to the last shape's index; each point leaves on its own short delay and swirls on the way, so a morph reads as a flock rather than a slide. `uScatter` blows the points apart, `uSpin` turns the shape in depth, and `pointerPush` parts them around the pointer. It is a [framed view](framed-views.md): a poster shows the resting shape until the first drawn frame, and whenever WebGL cannot draw.

Lifecycle: the framework controller builds the morph once its element is mounted, tweens `uShape` in its intro or on input, attaches `pointerPush`, and reverts effects before the morph on unmount.

Dependencies: `gsap`, `ogl`, `framed-views.ts` from this skill. This is not the `animaxxing` particle field: that draws a few hundred particles on a 2D canvas around an element; this draws tens of thousands as one GPU draw call.

## Shapes

A shape is a `Float32Array` of x, y, z triplets inside a box from -1 to 1, y up. The morph resamples every shape to `count` points, so shapes of any size mix. Build them from text, an image's ink, or math. `textShape` and `imageShape` read pixels from a 2D canvas, so an image must be same-origin or CORS-readable.

```ts
import gsap from "gsap";
import { Geometry, Mesh, Program, Transform, type OGLRenderingContext } from "ogl";
import { framedView, type FramedView, type Uniform, type ViewFrame } from "./framed-views";
import type { StageOptions } from "./webgl-stage";

export type Teardown = () => void;
export type PointShape = Float32Array;

/** Points sampled from pixels whose ink passes `threshold`, scaled into the -1 to 1 box, keeping the aspect. */
function inkPoints(context: CanvasRenderingContext2D, width: number, height: number, test: (data: Uint8ClampedArray, i: number) => boolean, depth: number) {
  const data = context.getImageData(0, 0, width, height).data;
  const points: number[] = [];
  const scale = 2 / Math.max(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!test(data, (y * width + x) * 4)) continue;
      points.push((x - width / 2) * scale, (height / 2 - y) * scale, (Math.random() - 0.5) * depth);
    }
  }
  return new Float32Array(points);
}

/** The filled outline of `text` in `font`, such as `"800 160px Archivo"`. Load the font first. */
export function textShape(text: string, { font = "700 160px sans-serif", depth = 0.08 }: { font?: string; depth?: number } = {}): PointShape {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.font = font;
  const metrics = context.measureText(text);
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? "160");
  canvas.width = Math.ceil(metrics.width) + 8;
  canvas.height = Math.ceil(size * 1.25);
  context.font = font;
  context.textBaseline = "middle";
  context.fillText(text, 4, canvas.height / 2);
  return inkPoints(context, canvas.width, canvas.height, (data, i) => data[i + 3]! > 128, depth);
}

/** The opaque, dark pixels of an image: a logo or a silhouette. The image must be loaded and readable. */
export function imageShape(image: HTMLImageElement, { size = 240, threshold = 0.5, depth = 0.08 }: { size?: number; threshold?: number; depth?: number } = {}): PointShape {
  const canvas = document.createElement("canvas");
  const ratio = image.naturalWidth / image.naturalHeight;
  canvas.width = ratio >= 1 ? size : Math.round(size * ratio);
  canvas.height = ratio >= 1 ? Math.round(size / ratio) : size;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return inkPoints(context, canvas.width, canvas.height, (data, i) => {
    const light = (data[i]! + data[i + 1]! + data[i + 2]!) / 765;
    return data[i + 3]! > 128 && light < threshold;
  }, depth);
}

/** Points evenly spread on a sphere's surface. */
export function sphereShape(count = 4000, radius = 0.9): PointShape {
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const ring = Math.sqrt(1 - y * y);
    const angle = i * 2.39996;
    points.set([Math.cos(angle) * ring * radius, y * radius, Math.sin(angle) * ring * radius], i * 3);
  }
  return points;
}

/** Loose dust: a soft cloud, densest in the middle, `stretch` times wider than tall to fill a wide element. */
export function scatterShape(count = 4000, spread = 1, stretch = 1.6): PointShape {
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // A random direction, at a distance that thins toward the edge.
    const z = Math.random() * 2 - 1;
    const angle = Math.random() * Math.PI * 2;
    const ring = Math.sqrt(1 - z * z);
    const reach = Math.pow(Math.random(), 0.6) * spread;
    points.set([Math.cos(angle) * ring * reach * stretch, Math.sin(angle) * ring * reach, z * reach], i * 3);
  }
  return points;
}

/** `count` points from `shape`, shuffled so a morph pairs points across the whole shape. */
function resample(shape: PointShape, count: number): Float32Array {
  const source = shape.length / 3;
  const out = new Float32Array(count * 3);
  if (!source) return out;
  const order = Array.from({ length: source }, (_, i) => i);
  for (let i = source - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  for (let i = 0; i < count; i++) {
    const from = order[i % source]! * 3;
    out[i * 3] = shape[from]!;
    out[i * 3 + 1] = shape[from + 1]!;
    out[i * 3 + 2] = shape[from + 2]!;
  }
  return out;
}

export type ParticleMorphOptions = {
  /** One to four shapes; `uShape` runs from 0 to the last index. */
  shapes: PointShape[];
  /** Points drawn. Defaults to 6000 on fine pointers, 3000 on coarse ones. */
  count?: number;
  /** Point size in CSS pixels. */
  size?: number;
  /** Share of the element each shape fills, fitted by its own width and height. */
  fill?: number;
  /** Point color. Defaults to the element's computed `color`. */
  color?: string;
  poster?: HTMLImageElement | null;
  stage?: StageOptions;
};

export type ParticleMorph = {
  readonly view: FramedView;
  /** Tween these with GSAP; they survive a context loss and restore. */
  readonly uniforms: {
    /** 0 is the first shape, 1 the second, and so on. */
    uShape: Uniform<number>;
    /** How far points blow apart, in box units; 0 at rest. */
    uScatter: Uniform<number>;
    /** Turn around the vertical axis, in radians. */
    uSpin: Uniform<number>;
    /** Pointer in box units, and how hard it pushes; 0 at rest. */
    uPointer: Uniform<number[]>;
    uPush: Uniform<number>;
  };
  readonly webgl: boolean;
  /** Morphs to shape `index`. Reduced motion and no WebGL complete at once. */
  to(index: number, vars?: gsap.TweenVars): gsap.core.Timeline;
  revert(): void;
};

const VERTEX = /* glsl */ `
attribute vec3 position;
attribute vec3 shape1;
attribute vec3 shape2;
attribute vec3 shape3;
attribute vec3 random;
uniform float uShape;
uniform float uScatter;
uniform float uSpin;
uniform vec2 uPointer;
uniform float uPush;
uniform float uSize;
uniform float uDpr;
uniform vec2 uScale;
uniform vec4 uFit;
uniform float uTime;
varying float vFade;

/** Progress of step k for this point: each leaves on its own delay. */
float step01(float k) {
  return smoothstep(0.0, 1.0, clamp((uShape - k) * 1.6 - random.x * 0.6, 0.0, 1.0));
}

void main() {
  float a = step01(0.0);
  float b = step01(1.0);
  float c = step01(2.0);
  // Each shape is scaled to fit the element on its own, so a wide word and a round sphere both fill it.
  vec3 p = mix(mix(mix(position * uFit.x, shape1 * uFit.y, a), shape2 * uFit.z, b), shape3 * uFit.w, c);
  // Mid-flight, each point swirls off the straight line and back.
  float flight = sin(a * 3.14159) + sin(b * 3.14159) + sin(c * 3.14159);
  p += (random - 0.5) * flight * 0.9;
  p += (random - 0.5) * uScatter * 2.0;
  // A slow shimmer keeps a resting shape alive without moving it anywhere.
  p += vec3(sin(uTime * 1.3 + random.y * 6.28), cos(uTime * 1.1 + random.z * 6.28), 0.0) * 0.004;
  float s = sin(uSpin);
  float co = cos(uSpin);
  p = vec3(p.x * co + p.z * s, p.y, -p.x * s + p.z * co);
  vec2 away = p.xy - uPointer;
  float reach = exp(-dot(away, away) * 12.0);
  p.xy += normalize(away + 0.0001) * reach * uPush * 0.35;
  float perspective = 1.0 / (1.0 + p.z * 0.35);
  vFade = clamp(perspective, 0.4, 1.0);
  gl_Position = vec4(p.xy * uScale * perspective, 0.0, 1.0);
  gl_PointSize = uSize * uDpr * perspective;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
varying float vFade;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float alpha = (1.0 - smoothstep(0.25, 0.5, d)) * vFade;
  gl_FragColor = vec4(uColor * alpha, alpha);
}
`;

/** CSS color to linear 0 to 1 RGB, through a 1-pixel canvas. */
function rgb(color: string): number[] {
  const context = document.createElement("canvas").getContext("2d")!;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r! / 255, g! / 255, b! / 255];
}

export function particleMorph(
  host: HTMLElement,
  { shapes, count, size = 2.2, fill = 0.8, color, poster, stage }: ParticleMorphOptions,
): ParticleMorph {
  const total = count ?? (window.matchMedia("(pointer: coarse)").matches ? 3000 : 6000);
  const uniforms = { uShape: { value: 0 }, uScatter: { value: 0 }, uSpin: { value: 0 }, uPointer: { value: [9, 9] }, uPush: { value: 0 } };
  // Sampled once, so a context restore rebuilds the same points.
  const sets = shapes.slice(0, 4).map((shape) => resample(shape, total));
  while (sets.length < 4) sets.push(sets[sets.length - 1] ?? new Float32Array(total * 3));
  const random = new Float32Array(total * 3).map(() => Math.random());
  /** Each shape's half width and half height, for fitting it to the element. */
  const bounds = sets.map((set) => {
    let x = 0.05;
    let y = 0.05;
    for (let i = 0; i < set.length; i += 3) {
      x = Math.max(x, Math.abs(set[i]!));
      y = Math.max(y, Math.abs(set[i + 1]!));
    }
    return [x, y] as const;
  });

  const draw = (gl: OGLRenderingContext) => {
    const scene = new Transform();
    const geometry = new Geometry(gl, {
      position: { size: 3, data: sets[0]! },
      shape1: { size: 3, data: sets[1]! },
      shape2: { size: 3, data: sets[2]! },
      shape3: { size: 3, data: sets[3]! },
      random: { size: 3, data: random },
    });
    const own = { uSize: { value: size }, uDpr: { value: 1 }, uScale: { value: [1, 1] }, uFit: { value: [1, 1, 1, 1] }, uTime: { value: 0 }, uColor: { value: rgb(color ?? getComputedStyle(host).color) } };
    const program = new Program(gl, { vertex: VERTEX, fragment: FRAGMENT, uniforms: { ...uniforms, ...own }, transparent: true, depthTest: false, depthWrite: false });
    const points = new Mesh(gl, { mode: gl.POINTS, geometry, program });
    points.setParent(scene);
    return {
      scene,
      update({ width, height, dpr, time }: ViewFrame) {
        own.uDpr.value = dpr;
        own.uTime.value = time;
        // Box units map to half the shorter side; each shape then scales to fit the element by its own bounds.
        const short = Math.min(width, height);
        own.uScale.value[0] = short / width;
        own.uScale.value[1] = short / height;
        bounds.forEach(([x, y], k) => (own.uFit.value[k] = (fill * Math.min(width / x, height / y)) / short));
      },
    };
  };

  const view = framedView(host, { draw, poster, stage });
  const last = Math.max(0, shapes.length - 1);

  return {
    view,
    uniforms,
    get webgl() {
      return view.webgl;
    },
    to(index, vars = {}) {
      const value = gsap.utils.clamp(0, last, index);
      // Reduced motion never holds the stage, so it lands here too.
      const instant = !view.webgl;
      // A timeline, so callbacks attached after an instant morph still run.
      return gsap.timeline().to(uniforms.uShape, { value, duration: 1.6, ease: "power2.inOut", overwrite: true, ...vars, ...(instant ? { duration: 0, delay: 0 } : {}) });
    },
    revert() {
      gsap.killTweensOf([uniforms.uShape, uniforms.uScatter, uniforms.uSpin, uniforms.uPush, uniforms.uPointer.value]);
      view.revert();
    },
  };
}

export type PointerPushOptions = {
  /** Push strength at full; points part this far around the pointer. */
  strength?: number;
  /** Seconds the push takes to follow the pointer. */
  follow?: number;
  /** A finger or pen held on the element pushes like the mouse. It claims the element's touch gestures. */
  touch?: boolean;
};

/** Points part around the mouse and close again on leave. Touch and pen push only with `touch`. */
export function pointerPush(morph: ParticleMorph, { strength = 1, follow = 0.3, touch = false }: PointerPushOptions = {}): Teardown {
  if (!morph.webgl) return () => {};
  const surface = morph.view.host;
  const { uPointer, uPush } = morph.uniforms;
  const toX = gsap.quickTo(uPointer.value, "0", { duration: follow, ease: "power3" });
  const toY = gsap.quickTo(uPointer.value, "1", { duration: follow, ease: "power3" });
  const aborter = new AbortController();
  const on = { signal: aborter.signal };
  const previousTouchAction = surface.style.touchAction;
  if (touch) surface.style.touchAction = "none";
  let finger = -1;

  /** Pointer to box units: one unit is half the element's shorter side, as the shader draws it. */
  const aim = (event: PointerEvent, jump = false) => {
    const box = surface.getBoundingClientRect();
    const short = Math.min(box.width, box.height);
    const x = (event.clientX - box.left - box.width / 2) / (short / 2);
    const y = -(event.clientY - box.top - box.height / 2) / (short / 2);
    toX(x, jump ? x : undefined);
    toY(y, jump ? y : undefined);
  };
  const press = (down: boolean) => gsap.to(uPush, { value: down ? strength : 0, duration: down ? 0.4 : 0.9, ease: down ? "power3.out" : "power2.out", overwrite: true });

  surface.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "mouse") return;
    aim(event, true);
    press(true);
  }, on);
  surface.addEventListener("pointermove", (event) => (event.pointerType === "mouse" || event.pointerId === finger) && aim(event), on);
  surface.addEventListener("pointerleave", (event) => event.pointerType === "mouse" && press(false), on);
  if (touch) {
    surface.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      finger = event.pointerId;
      aim(event, true);
      press(true);
    }, on);
    const lift = (event: PointerEvent) => {
      if (event.pointerId !== finger) return;
      finger = -1;
      press(false);
    };
    document.addEventListener("pointerup", lift, on);
    document.addEventListener("pointercancel", lift, on);
  }
  return () => {
    aborter.abort();
    gsap.killTweensOf([uPush, uPointer.value]);
    uPush.value = 0;
    surface.style.touchAction = previousTouchAction;
  };
}
```

The morph draws in the element's computed `color` unless `color` is set, so it follows the page's palette; it adds no color of its own. Points blend over whatever the page shows behind the element.

The shimmer is a few thousandths of the box and never travels, so a resting shape holds still to the eye and needs no pause control. Anything that keeps a shape moving, such as a looping `uSpin`, is ambient motion: give it the framework's pause control.

## Budgets

- One draw call for every point. 6000 points is light on a desktop GPU; phones default to 3000. Point size costs more than count: large soft points overdraw.
- `textShape` and `imageShape` read pixels once on the CPU when called. Build shapes once and keep them; the morph samples them again only on creation.

## Wiring

```ts
// Example: dust gathers into the brand's name, then a button scatters it into a sphere.
await document.fonts.ready;
const morph = particleMorph(document.querySelector<HTMLElement>("#dust")!, {
  shapes: [scatterShape(), textShape("Motion", { font: "800 180px Archivo" }), sphereShape()],
});
const push = pointerPush(morph);
morph.to(1, { duration: 2.2 });
document.querySelector("#next")!.addEventListener("click", () => morph.to(2));
// On unmount:
push();
morph.revert();
```

## Controller contract

| Phase | Call |
|---|---|
| initial state | None: the poster is the initial state. Start `uShape` where the poster's shape is. |
| intro | `particleMorph(host, options)` once mounted; await `view.ready` if the intro depends on it; `to(index)` to gather the shape. |
| settled | `pointerPush` answers input; `to(index)` on the page's own controls. |
| outro | `to(index)` or tween `uScatter` up to blow the shape away. |
| unmount | Revert `pointerPush`, then `revert()`. |
