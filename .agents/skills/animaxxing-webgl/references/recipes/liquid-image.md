# Recipe: liquid image

An image that behaves like the surface of water: the pointer drags a trail through it that bends the picture, splits its color a little at the edges, and smooths out as the trail fades. `pour()` sweeps one stroke across it for an intro. A small flow map, rendered each frame on the GPU, remembers where the pointer went and how fast. It is a [framed view](framed-views.md) whose poster is the image itself: the `<img>` stays the content and the fallback.

Lifecycle: the framework controller builds the liquid once the image is mounted, may `pour()` in its intro, and calls `revert` on unmount.

Dependencies: `gsap`, `ogl`, `framed-views.ts` and `image-planes.ts` from this skill.

## Why not OGL's Flowmap

OGL ships a `Flowmap` helper. Its shader calls `smoothstep` with its edges reversed, which GLSL leaves undefined, and it needs half-float render targets, which some phones lack. This recipe's flow pass is the same idea in a few lines: 8-bit targets that every WebGL device supports, and increasing edges. 8-bit storage needs one more step: each frame drops half a stored step after fading, so the write rounds down; otherwise a fading value rounds back to the same byte and the trail never quite settles.

```ts
import gsap from "gsap";
import { Mesh, Program, RenderTarget, Texture, Transform, Triangle, type OGLRenderingContext } from "ogl";
import { framedView, freeProgram, freeTarget, type FramedView, type Uniform, type ViewFrame } from "./framed-views";
import { textureSource } from "./image-planes";
import type { StageOptions } from "./webgl-stage";

export type LiquidImageOptions = {
  /** Flow map cells per side. Coarser is softer and cheaper. */
  size?: number;
  /** Trail width, as a share of the image's shorter side. */
  falloff?: number;
  /** Share of the trail left after a second. Lower settles faster. */
  linger?: number;
  /** A finger or pen held on the image drags a trail like the mouse. It claims the image's touch gestures. */
  touch?: boolean;
  /** Element that takes the pointer. Defaults to the image's link or button, else the image. */
  target?: HTMLElement;
  stage?: StageOptions;
};

export type LiquidImage = {
  readonly view: FramedView;
  /** Tween these with GSAP; they survive a context loss and restore. */
  readonly uniforms: {
    /** How far the trail bends the picture. */
    uStrength: Uniform<number>;
    /** Color split along the trail; 0 keeps color whole. */
    uShift: Uniform<number>;
  };
  readonly webgl: boolean;
  /** Sweeps one stroke across the image. Completes at once without WebGL. */
  pour(vars?: { duration?: number; ease?: string; from?: "left" | "right" }): gsap.core.Timeline;
  revert(): void;
};

const FULL_VERTEX = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/** Fades last frame's flow, then stamps the pointer's velocity where it is. Velocity is stored around 0.5. */
const FLOW_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uFlow;
uniform float uKeep;
uniform vec3 uDrain;
uniform float uFalloff;
uniform float uAspect;
uniform vec2 uPointer;
uniform vec2 uVelocity;
uniform float uStamp;
varying vec2 vUv;

void main() {
  vec4 last = texture2D(uFlow, vUv);
  vec3 flow = vec3(last.rg * 2.0 - 1.0, last.b);
  // Fade, then drop half a stored step so the 8-bit write rounds down: at high frame rates a small
  // value times uKeep rounds back to the same byte, and the surface would never come to rest.
  flow = sign(flow) * max(abs(flow) * uKeep - uDrain, 0.0);
  vec2 toPointer = (vUv - uPointer) * vec2(uAspect, 1.0);
  float stamp = (1.0 - smoothstep(0.0, uFalloff, length(toPointer))) * uStamp;
  vec3 mark = vec3(clamp(uVelocity, -1.0, 1.0), clamp(length(uVelocity) * 1.5, 0.0, 1.0));
  flow = mix(flow, mark, stamp);
  gl_FragColor = vec4(flow.rg * 0.5 + 0.5, flow.b, 1.0);
}
`;

const IMAGE_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uTexture;
uniform sampler2D uFlow;
uniform vec2 uUvScale;
uniform float uStrength;
uniform float uShift;
varying vec2 vUv;

void main() {
  vec4 flowSample = texture2D(uFlow, vUv);
  vec2 flow = (flowSample.rg * 2.0 - 1.0) * flowSample.b;
  vec2 at = vUv - flow * uStrength;
  vec2 uv = (at - 0.5) * uUvScale + 0.5;
  vec2 split = flow * uShift;
  vec4 base = texture2D(uTexture, clamp(uv, 0.0, 1.0));
  float red = texture2D(uTexture, clamp(uv + split, 0.0, 1.0)).r;
  float blue = texture2D(uTexture, clamp(uv - split, 0.0, 1.0)).b;
  // The stage blends premultiplied color.
  gl_FragColor = vec4(vec3(red, base.g, blue) * base.a, base.a);
}
`;

export function liquidImage(
  image: HTMLImageElement,
  { size = 128, falloff = 0.22, linger = 0.25, touch = false, target, stage }: LiquidImageOptions = {},
): LiquidImage {
  const uniforms = { uStrength: { value: 0.08 }, uShift: { value: 0.012 } };
  const surface = target ?? image.closest<HTMLElement>("a[href], button") ?? image;
  /** The pointer and the pour both write here; the flow pass reads it each frame. */
  const pen = { x: 0.5, y: 0.5, lastX: 0.5, lastY: 0.5, down: false, gain: 1, velocity: [0, 0] };
  let source: HTMLImageElement | undefined;
  let lastTime = 0;

  const draw = (gl: OGLRenderingContext) => {
    if (!source) throw new Error("liquid image has no readable source");
    const targetOptions = { width: size, height: size, depth: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR };
    let read = new RenderTarget(gl, targetOptions);
    let write = new RenderTarget(gl, targetOptions);
    // Start the flow at rest: velocity 0 is stored as 0.5.
    for (const t of [read, write]) {
      gl.renderer.bindFramebuffer(t);
      gl.clearColor(0.5, 0.5, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.renderer.bindFramebuffer();
    gl.clearColor(0, 0, 0, 0);
    const flowUniforms = {
      uFlow: { value: read.texture },
      uKeep: { value: 1 },
      // Half a byte in storage: velocity is stored as v / 2 + 0.5, strength as is.
      uDrain: { value: [1 / 255, 1 / 255, 0.5 / 255] },
      uFalloff: { value: falloff },
      uAspect: { value: 1 },
      uPointer: { value: [0.5, 0.5] },
      uVelocity: { value: [0, 0] },
      uStamp: { value: 0 },
    };
    const flowGeometry = new Triangle(gl);
    const flowProgram = new Program(gl, { vertex: FULL_VERTEX, fragment: FLOW_FRAGMENT, uniforms: flowUniforms, depthTest: false, depthWrite: false });
    const flowPass = new Mesh(gl, { geometry: flowGeometry, program: flowProgram });

    const scene = new Transform();
    const texture = new Texture(gl, { image: source, generateMipmaps: false, minFilter: gl.LINEAR });
    const imageUniforms = { uTexture: { value: texture }, uFlow: { value: read.texture }, uUvScale: { value: [1, 1] }, ...uniforms };
    const surfaceMesh = new Mesh(gl, {
      geometry: new Triangle(gl),
      program: new Program(gl, { vertex: FULL_VERTEX, fragment: IMAGE_FRAGMENT, uniforms: imageUniforms, depthTest: false, depthWrite: false }),
    });
    surfaceMesh.setParent(scene);
    const fit = getComputedStyle(image).objectFit;

    return {
      scene,
      update({ width, height, time }: ViewFrame) {
        const dt = Math.min(0.1, lastTime ? time - lastTime : 1 / 60);
        lastTime = time;
        // Velocity is how far the pen moved this frame, scaled so a brisk stroke reaches about 1.
        const vx = ((pen.x - pen.lastX) / Math.max(dt, 1 / 240) / 6) * pen.gain;
        const vy = ((pen.y - pen.lastY) / Math.max(dt, 1 / 240) / 6) * pen.gain;
        pen.velocity[0] += (vx - pen.velocity[0]) * 0.5;
        pen.velocity[1] += (vy - pen.velocity[1]) * 0.5;
        pen.lastX = pen.x;
        pen.lastY = pen.y;
        flowUniforms.uKeep.value = Math.pow(linger, dt);
        flowUniforms.uAspect.value = width / height;
        flowUniforms.uPointer.value[0] = pen.x;
        flowUniforms.uPointer.value[1] = pen.y;
        flowUniforms.uVelocity.value[0] = pen.velocity[0]!;
        flowUniforms.uVelocity.value[1] = pen.velocity[1]!;
        flowUniforms.uStamp.value = pen.down && Math.hypot(vx, vy) > 0.002 ? 1 : 0;
        flowUniforms.uFlow.value = read.texture;
        gl.renderer.render({ scene: flowPass, target: write, clear: false });
        [read, write] = [write, read];
        imageUniforms.uFlow.value = read.texture;
        // object-fit, centered, as the image is laid out.
        const ratio = width / height / (source!.naturalWidth / source!.naturalHeight);
        const scale = imageUniforms.uUvScale.value;
        if (fit === "cover") [scale[0], scale[1]] = ratio > 1 ? [1, 1 / ratio] : [ratio, 1];
        else if (fit === "contain") [scale[0], scale[1]] = ratio > 1 ? [ratio, 1] : [1, 1 / ratio];
        else [scale[0], scale[1]] = [1, 1];
      },
      dispose(context: OGLRenderingContext) {
        // The scene is freed next; it must not free the flow textures a second time.
        imageUniforms.uFlow.value = null as unknown as Texture;
        freeProgram(context, flowProgram);
        flowGeometry.remove();
        freeTarget(context, read);
        freeTarget(context, write);
      },
    };
  };

  const view = framedView(image, {
    draw,
    poster: image,
    stage,
    async prepare(signal) {
      source = (await textureSource(image, signal)) ?? undefined;
      return !!source;
    },
  });

  const aborter = new AbortController();
  const on = { signal: aborter.signal };
  const previousTouchAction = surface.style.touchAction;
  let finger = -1;
  let pouring: gsap.core.Timeline | undefined;
  const place = (event: PointerEvent, jump = false) => {
    const box = image.getBoundingClientRect();
    if (!box.width || !box.height) return;
    pen.x = gsap.utils.clamp(0, 1, (event.clientX - box.left) / box.width);
    pen.y = gsap.utils.clamp(0, 1, 1 - (event.clientY - box.top) / box.height);
    if (jump) [pen.lastX, pen.lastY] = [pen.x, pen.y];
  };
  if (view.webgl) {
    if (touch) surface.style.touchAction = "none";
    surface.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse" || pouring?.isActive()) return;
      place(event, true);
      pen.down = true;
    }, on);
    surface.addEventListener("pointermove", (event) => {
      if (pouring?.isActive() || (event.pointerType !== "mouse" && event.pointerId !== finger)) return;
      place(event);
    }, on);
    surface.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse") pen.down = false;
    }, on);
    if (touch) {
      surface.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse") return;
        finger = event.pointerId;
        place(event, true);
        pen.down = true;
      }, on);
      const lift = (event: PointerEvent) => {
        if (event.pointerId !== finger) return;
        finger = -1;
        pen.down = false;
      };
      document.addEventListener("pointerup", lift, on);
      document.addEventListener("pointercancel", lift, on);
    }
  }

  return {
    view,
    uniforms,
    get webgl() {
      return view.webgl;
    },
    pour({ duration = 1.4, ease = "power2.inOut", from = "left" } = {}) {
      const start = from === "left" ? -0.1 : 1.1;
      const stroke = { x: start };
      pouring?.kill();
      // A timeline, so callbacks attached after an instant pour still run.
      pouring = gsap.timeline().to(stroke, {
        x: from === "left" ? 1.1 : -0.1,
        duration: view.webgl ? duration : 0,
        ease,
        onStart() {
          [pen.x, pen.y, pen.lastX, pen.lastY] = [start, 0.5, start, 0.5];
          pen.down = true;
          // A slow, even stroke would barely stir the surface; push it like a brisk hand.
          pen.gain = 4;
        },
        onUpdate() {
          pen.x = stroke.x;
          // A gentle swell, so the stroke reads as a hand rather than a ruler.
          pen.y = 0.5 + Math.sin(stroke.x * Math.PI * 2) * 0.12;
        },
        onComplete() {
          pen.down = false;
          pen.gain = 1;
        },
      });
      return pouring;
    },
    revert() {
      aborter.abort();
      pouring?.kill();
      gsap.killTweensOf([uniforms.uStrength, uniforms.uShift]);
      surface.style.touchAction = previousTouchAction;
      view.revert();
    },
  };
}
```

The trail fades on its own, so the image always returns to rest; nothing loops. The flow pass runs every frame the view draws, which is every frame the image is near the screen; at 128 cells it is a small fraction of the image's own cost.

Keyboard focus does not move a trail: the effect is decorative, and the image reads the same at rest. Keep it off images whose detail must stay legible while the pointer crosses them, such as a chart or a screenshot of text.

## Wiring

```ts
// Example: a hero image takes a trail from the mouse, and a finger with `touch`, after one stroke on arrival.
const hero = liquidImage(document.querySelector<HTMLImageElement>("#hero img")!, { touch: true });
await hero.view.ready;
hero.pour();
// On unmount:
hero.revert();
```

## Controller contract

| Phase | Call |
|---|---|
| initial state | None: the image is the initial state. |
| intro | `liquidImage(image)` once mounted; await `view.ready` within the deadline, then `pour()`. |
| settled | The pointer drags trails that fade to rest. |
| outro | Nothing; the image keeps drawing until revert. |
| unmount | `revert()`: removes listeners, frees the flow targets and passes, releases the stage, and shows the image. |
