# Recipe: metaballs

Liquid metal on the GPU. Drops are metaballs: each has a field that falls off with distance, the fields add, and wherever the sum passes one, there is liquid. Two drops near each other bridge and merge like mercury. The shader shades the surface as polished metal, reflecting a world made only from the element's own color: lighter above a horizon, darker below, with a dark rim and one hard highlight. It adds no color of its own.

Two builders, both [framed views](framed-views.md):

- `melt`: drops gather from a single bead into a shape, such as a word or a mark, and settle as that shape in liquid metal; `drip` lets it fall apart again.
- `pourStream`: a stream pours down a column as the page scrolls, its head following the reader, and a drop leaves the stream beside each row it reaches.

Lifecycle: the framework controller builds a melt once its element is mounted and plays `form()` in its intro; it builds a stream at settled. It reverts both on unmount.

Dependencies: `gsap`, `ogl`, `framed-views.ts` from this skill.

## The metal

```ts
import gsap from "gsap";
import { Mesh, Program, Texture, Transform, Triangle, type OGLRenderingContext } from "ogl";
import { framedView, type FramedView, type Uniform, type ViewFrame } from "./framed-views";
import type { StageOptions } from "./webgl-stage";

export type Teardown = () => void;
/** A drop: center in the element's CSS pixels, and radius. */
export type Drop = { x: number; y: number; r: number };

const MAX_DROPS = 24;

const VERTEX = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/** Shading shared by both builders: a field in, premultiplied metal out. */
const METAL = /* glsl */ `
uniform vec3 uTint;
uniform vec2 uSize;

// A field of r²/d² gives 1 - 1/f as a paraboloid; its square root rounds each drop like a dome.
float dome(float f) { return sqrt(clamp(1.0 - 1.0 / max(f, 0.001), 0.0, 1.0)); }

vec3 world(vec3 n) {
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  vec3 light = mix(uTint, vec3(1.0), 0.82);
  vec3 dark = mix(uTint, vec3(0.0), 0.86);
  vec3 sky = mix(light, mix(uTint, vec3(1.0), 0.35), smoothstep(0.1, 0.9, r.y + 0.35 * r.x));
  vec3 ground = mix(dark, uTint * 0.8, 1.0 - smoothstep(-0.75, -0.12, r.y));
  return mix(ground, sky, smoothstep(-0.02, 0.02, r.y + 0.12 * sin(r.x * 3.0)));
}

vec4 metal(float f, vec3 n) {
  float cover = smoothstep(0.94, 1.06, f);
  vec3 c = world(n);
  c = mix(c, mix(uTint, vec3(0.0), 0.86), 0.75 * pow(1.0 - n.z, 4.0));
  vec3 light = normalize(vec3(-0.45, 0.6, 0.66));
  c += pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 40.0);
  return vec4(c * cover, cover);
}
`;

/** The surface's normal from the field's slope, sampled `step` pixels apart. */
const NORMAL = /* glsl */ `
vec3 normalAt(vec2 p, float step) {
  float hx = dome(field(p + vec2(step, 0.0))) - dome(field(p - vec2(step, 0.0)));
  float hy = dome(field(p + vec2(0.0, step))) - dome(field(p - vec2(0.0, step)));
  return normalize(vec3(-hx, hy, 0.08));
}
`;

/** CSS color to 0 to 1 RGB, through a 1-pixel canvas. */
function rgb(color: string): number[] {
  const context = document.createElement("canvas").getContext("2d")!;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r! / 255, g! / 255, b! / 255];
}

/** A seeded random, so a shape's drops land in the same places on every visit. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Copies drops into a flat uniform array, padding with empty drops. */
function pack(drops: Drop[], into: number[]) {
  for (let i = 0; i < MAX_DROPS; i++) {
    const d = drops[i];
    into[i * 3] = d?.x ?? -1e4;
    into[i * 3 + 1] = d?.y ?? -1e4;
    into[i * 3 + 2] = d?.r ?? 0;
  }
}

/** The quad and program a drawing renders through. */
function surface(gl: OGLRenderingContext, fragment: string, uniforms: Record<string, Uniform<unknown>>) {
  const scene = new Transform();
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program: new Program(gl, { vertex: VERTEX, fragment, uniforms, transparent: true, depthTest: false, depthWrite: false }) });
  mesh.setParent(scene);
  return scene;
}
```

## melt

The shape is drawn once into a small canvas with `draw`, then blurred: its blurred alpha is a smooth field whose 0.5 contour is the shape's edge. `uForm` blends that field in as the drops arrive, so they merge into exactly the shape. Drops are placed on the shape from a seeded sample of its pixels.

```ts
export type MeltOptions = {
  /** Draws the shape in any opaque color on a transparent canvas of the element's aspect. */
  draw(context: CanvasRenderingContext2D, width: number, height: number): void;
  /** Drops that gather into the shape. */
  drops?: number;
  /** The metal's tint. Defaults to the element's computed `color`. */
  tint?: string;
  /** The element shown until the first drawn frame and without WebGL, such as the live text the melt draws. */
  poster?: HTMLElement | null;
  /** An element the drawing never paints outside, such as a scrolling box. See framed views. */
  clip?: Element | null;
  stage?: StageOptions;
};

export type Melt = {
  readonly view: FramedView;
  /** Tween these with GSAP; they survive a context loss and restore. */
  readonly uniforms: { uForm: Uniform<number> };
  readonly webgl: boolean;
  /** One bead becomes the shape. Completes at once without WebGL. */
  form(vars?: { duration?: number }): gsap.core.Timeline;
  /** The shape lets go and falls apart in drops. Completes at once without WebGL. */
  drip(vars?: { duration?: number }): gsap.core.Timeline;
  revert(): void;
};

const MELT_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uDrops[${MAX_DROPS}];
uniform sampler2D uShape;
uniform float uForm;
uniform float uTime;
varying vec2 vUv;
${METAL}
float field(vec2 p) {
  float f = 0.0;
  for (int i = 0; i < ${MAX_DROPS}; i++) {
    vec2 d = p - uDrops[i].xy;
    f += uDrops[i].z * uDrops[i].z / (dot(d, d) + 0.001);
  }
  // The blurred shape: 0.5 at its edge, so twice it crosses one exactly there.
  return f + uForm * texture2D(uShape, vec2(p.x / uSize.x, 1.0 - p.y / uSize.y)).a * 2.0;
}
${NORMAL}
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  // A slow wobble while the shape is still liquid, gone once it has formed.
  p += vec2(sin(p.y * 0.05 + uTime * 3.0), cos(p.x * 0.04 - uTime * 2.4)) * 1.6 * (1.0 - uForm);
  gl_FragColor = metal(field(p), normalAt(p, 2.5));
}
`;

export function melt(host: HTMLElement, { draw, drops: count = 14, tint, poster = null, clip, stage }: MeltOptions): Melt {
  const n = Math.min(MAX_DROPS, Math.max(1, count));
  const uniforms = { uForm: { value: 0 } };
  const drops: Drop[] = Array.from({ length: n }, () => ({ x: 0, y: 0, r: 0 }));
  /** Where each drop settles: points on the shape, in the element's pixels. */
  let targets: Drop[] = [];
  let width = 1;
  let height = 1;
  let shape: HTMLCanvasElement | undefined;

  /** Draws and blurs the shape at a modest size; the texture is smoothed when scaled up anyway. */
  const paintShape = () => {
    const box = host.getBoundingClientRect();
    [width, height] = [Math.max(1, box.width), Math.max(1, box.height)];
    const scale = Math.min(1, 640 / width);
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const crisp = document.createElement("canvas");
    [crisp.width, crisp.height] = [w, h];
    const c = crisp.getContext("2d", { willReadFrequently: true })!;
    draw(c, w, h);
    const ink = c.getImageData(0, 0, w, h).data;
    const random = seeded(7);
    const inside: Array<[number, number]> = [];
    for (let i = 0; i < 4000 && inside.length < n; i++) {
      const x = Math.floor(random() * w);
      const y = Math.floor(random() * h);
      if (ink[(y * w + x) * 4 + 3]! > 128) inside.push([x / scale, y / scale]);
    }
    const short = Math.min(width, height);
    targets = inside.map(([x, y]) => ({ x, y, r: short * 0.07 }));
    shape = document.createElement("canvas");
    [shape.width, shape.height] = [w, h];
    const soft = shape.getContext("2d")!;
    soft.filter = `blur(${Math.max(2, Math.round(h * 0.03))}px)`;
    soft.drawImage(crisp, 0, 0);
  };

  const build = (gl: OGLRenderingContext) => {
    if (!shape) paintShape();
    const own = {
      uDrops: { value: new Array(MAX_DROPS * 3).fill(0) },
      uShape: { value: new Texture(gl, { image: shape!, generateMipmaps: false, minFilter: gl.LINEAR }) },
      uTint: { value: rgb(tint ?? getComputedStyle(host).color) },
      uSize: { value: [width, height] },
      uTime: { value: 0 },
    };
    return {
      scene: surface(gl, MELT_FRAGMENT, { ...uniforms, ...own }),
      update({ width: w, height: h, time }: ViewFrame) {
        own.uSize.value[0] = w;
        own.uSize.value[1] = h;
        own.uTime.value = time;
        pack(drops, own.uDrops.value);
      },
    };
  };

  const view = framedView(host, { draw: build, poster, clip, stage });

  /** Every drop sits in one bead at the shape's middle, too small to see. */
  const gather = () => {
    const cx = targets.reduce((sum, t) => sum + t.x, 0) / Math.max(1, targets.length);
    const cy = targets.reduce((sum, t) => sum + t.y, 0) / Math.max(1, targets.length);
    drops.forEach((d) => Object.assign(d, { x: cx || width / 2, y: cy || height / 2, r: 0 }));
  };
  if (!shape) paintShape();
  gather();

  return {
    view,
    uniforms,
    get webgl() {
      return view.webgl;
    },
    form({ duration = 1.8 } = {}) {
      const instant = !view.webgl;
      const timeline = gsap.timeline();
      gsap.killTweensOf([...drops, uniforms.uForm]);
      gather();
      uniforms.uForm.value = 0;
      const lead = drops[0]!;
      // A bead swells in the middle, then drops run out to their places, and the shape fills in under them.
      timeline
        .to(lead, { r: (targets[0]?.r ?? 20) * 1.4, duration: instant ? 0 : duration * 0.25, ease: "back.out(2)" }, 0)
        .to(drops, {
          x: (i: number) => targets[i % Math.max(1, targets.length)]?.x ?? lead.x,
          y: (i: number) => targets[i % Math.max(1, targets.length)]?.y ?? lead.y,
          r: (i: number) => targets[i % Math.max(1, targets.length)]?.r ?? 0,
          duration: instant ? 0 : duration * 0.55,
          ease: "power2.inOut",
          stagger: instant ? 0 : { each: (duration * 0.2) / n, from: "random" },
        }, instant ? 0 : duration * 0.15)
        .to(uniforms.uForm, { value: 1, duration: instant ? 0 : duration * 0.45, ease: "power2.in" }, instant ? 0 : duration * 0.5)
        // Formed, the drops shrink into the shape's own surface.
        .to(drops, { r: 0, duration: instant ? 0 : duration * 0.3, ease: "power2.in" }, instant ? 0 : duration * 0.75);
      return timeline;
    },
    drip({ duration = 1.4 } = {}) {
      const instant = !view.webgl;
      const timeline = gsap.timeline();
      gsap.killTweensOf([...drops, uniforms.uForm]);
      drops.forEach((d, i) => Object.assign(d, targets[i % Math.max(1, targets.length)] ?? d, { r: 0 }));
      timeline
        .to(drops, { r: (i: number) => targets[i % Math.max(1, targets.length)]?.r ?? 0, duration: instant ? 0 : duration * 0.2, ease: "power1.out" }, 0)
        .to(uniforms.uForm, { value: 0, duration: instant ? 0 : duration * 0.35, ease: "power2.out" }, 0)
        .to(drops, {
          y: () => height * gsap.utils.random(1.1, 1.4),
          r: 0,
          duration: instant ? 0 : duration * 0.75,
          ease: "power2.in",
          stagger: instant ? 0 : { each: (duration * 0.25) / n, from: "random" },
        }, instant ? 0 : duration * 0.15);
      return timeline;
    },
    revert() {
      gsap.killTweensOf([...drops, uniforms.uForm]);
      view.revert();
    },
  };
}

/** A `draw` for melt that writes `text` in `font`, centered. Load the font first. */
export function drawText(text: string, font: string) {
  return (context: CanvasRenderingContext2D, width: number, height: number) => {
    const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? "100");
    context.font = font;
    // Fit the text to 86% of the width, keeping its proportions.
    const fit = Math.min(1, (width * 0.86) / context.measureText(text).width, (height * 0.8) / size);
    context.font = font.replace(/(\d+(?:\.\d+)?)px/, `${size * fit}px`);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#000";
    context.fillText(text, width / 2, height / 2);
  };
}
```

## pourStream

The stream runs down a narrow column beside a list, its center line wavering a little. Its head follows the reader: as the column scrolls up past a point 60% down the viewport, the stream pours down to meet it, and it climbs back when they scroll up. As the head passes each row, a drop leaves the stream and settles beside it; when the head reaches the bottom, it pools.

```ts
export type PourStreamOptions = {
  /** The rows the stream passes; a drop settles level with each. */
  rows: HTMLElement[];
  /** Half the stream's width, in pixels. */
  width?: number;
  /** How far down the viewport the stream's head sits, as a fraction. */
  lead?: number;
  tint?: string;
  /** The scrolling box the column reads in, when it is not the page; the head follows that box's view, and the drawing stays inside it. */
  scroller?: Element | null;
  stage?: StageOptions;
};

export type PourStream = {
  readonly view: FramedView;
  readonly webgl: boolean;
  revert(): void;
};

const STREAM_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uDrops[${MAX_DROPS}];
uniform float uHead;
uniform float uHalf;
uniform float uPool;
varying vec2 vUv;
${METAL}
float lane(float y) { return uSize.x * 0.32 + uSize.x * 0.08 * sin(y * 0.011); }
float field(vec2 p) {
  // The stream: a ribbon above its head, falling off from its center line.
  float dx = p.x - lane(p.y);
  float above = 1.0 - smoothstep(uHead - uHalf, uHead, p.y);
  float f = uHalf * uHalf / (dx * dx + 1.0) * above;
  // A rounded head where the stream is pouring.
  vec2 h = p - vec2(lane(uHead), uHead - uHalf * 0.6);
  f += uHalf * uHalf * 1.8 / (dot(h, h) + 1.0) * step(1.0, uHead);
  for (int i = 0; i < ${MAX_DROPS}; i++) {
    vec2 d = p - uDrops[i].xy;
    f += uDrops[i].z * uDrops[i].z / (dot(d, d) + 0.001);
  }
  // The pool at the bottom, once the stream arrives: a flattened drop under the lane, clear of the column's edges.
  vec2 q = (p - vec2(lane(uSize.y), uSize.y - uHalf * 3.0)) * vec2(0.7, 1.4);
  return f + uPool * uHalf * uHalf * 3.0 / (dot(q, q) + 1.0);
}
${NORMAL}
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  gl_FragColor = metal(field(p), normalAt(p, 1.5));
}
`;

export function pourStream(column: HTMLElement, { rows, width = 6, lead = 0.6, tint, scroller = null, stage }: PourStreamOptions): PourStream {
  const drops: Drop[] = rows.slice(0, MAX_DROPS).map(() => ({ x: 0, y: 0, r: 0 }));
  const reached = drops.map(() => false);
  const own = { uHead: { value: 0 }, uPool: { value: 0 }, uHalf: { value: width } };
  let pooled = false;

  const draw = (gl: OGLRenderingContext) => {
    const shader = {
      uDrops: { value: new Array(MAX_DROPS * 3).fill(0) },
      uTint: { value: rgb(tint ?? getComputedStyle(column).color) },
      uSize: { value: [1, 1] },
    };
    return {
      scene: surface(gl, STREAM_FRAGMENT, { ...own, ...shader }),
      update({ width: w, height: h }: ViewFrame) {
        shader.uSize.value[0] = w;
        shader.uSize.value[1] = h;
        const box = column.getBoundingClientRect();
        // The head eases toward the reader's line, never past the column's ends.
        const frame = scroller?.getBoundingClientRect() ?? { top: 0, height: window.innerHeight };
        const target = gsap.utils.clamp(0, h, frame.top + frame.height * lead - box.top);
        own.uHead.value += (target - own.uHead.value) * 0.12;
        const lane = (y: number) => w * 0.32 + w * 0.08 * Math.sin(y * 0.011);
        rows.slice(0, MAX_DROPS).forEach((row, i) => {
          const r = row.getBoundingClientRect();
          const y = r.top + r.height / 2 - box.top;
          const drop = drops[i]!;
          // A drop sits beside its row, a stream's width or two right of the line.
          drop.x = lane(y) + width * 2.6;
          drop.y = y;
          const now = own.uHead.value > y;
          if (now === reached[i]) return;
          reached[i] = now;
          gsap.to(drop, now ? { r: width * 1.15, duration: 0.9, ease: "elastic.out(1, 0.45)" } : { r: 0, duration: 0.3, ease: "power2.in" });
        });
        const atEnd = own.uHead.value > h - width * 3;
        if (atEnd !== pooled) {
          pooled = atEnd;
          gsap.to(own.uPool, { value: atEnd ? 1 : 0, duration: atEnd ? 1.2 : 0.4, ease: atEnd ? "elastic.out(1, 0.5)" : "power2.in" });
        }
        pack(drops, shader.uDrops.value);
      },
    };
  };

  const view = framedView(column, { draw, poster: null, clip: scroller, stage });
  return {
    view,
    get webgl() {
      return view.webgl;
    },
    revert() {
      gsap.killTweensOf([...drops, own.uPool]);
      view.revert();
    },
  };
}
```

The stream is decorative: the column is `aria-hidden` and holds nothing a reader needs, and without WebGL it stays empty. Give the column at least twelve times `width` across, so the drops beside the stream and the pool clear its edges, and the rows' full height. It reads the page's scroll each frame, so it follows any smooth scroller without a ScrollTrigger.

## Budgets

- The field is summed per pixel for every drop and again for the surface normal: keep melts to about 16 drops and an element of a few hundred thousand pixels. The column for a stream is narrow, so a long list is cheap.
- `melt` paints and blurs its shape once, at most 640 pixels wide, on the CPU.

## Wiring

```ts
// Example: a title arrives as liquid metal; the index's column pours as the reader scrolls.
await document.fonts.ready;
const title = document.querySelector<HTMLElement>("#hero-title")!;
const metal = melt(title.parentElement!, { draw: drawText("Living", "300 220px Fraunces"), poster: title });
await metal.view.ready;
metal.form();
const stream = pourStream(document.querySelector<HTMLElement>("#index-gutter")!, { rows: [...document.querySelectorAll<HTMLElement>("#index li")] });
// In a box that scrolls on its own, the head follows that box and the drawing stays inside it:
// pourStream(gutter, { rows, scroller: panel });
// On unmount:
stream.revert();
metal.revert();
```

## Controller contract

| Phase | Call |
|---|---|
| initial state | None: the poster or the live text is the initial state; a stream's column is empty. |
| intro | `melt(host, options)` once mounted; await `view.ready` within the deadline; `form()`. |
| settled | `pourStream(column, options)`; it follows scroll on its own and nothing loops. |
| outro | `drip()` to let a melt fall apart. |
| unmount | `revert()` each. |
