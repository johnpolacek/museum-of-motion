# Recipe: scene flight

A camera flies down a spiral of images in real 3D: perspective, depth, and fog. GSAP drives the flight through one uniform, `uTravel`, from 0 in front of the first image to 1 in front of the last, so a timeline, a scroll scrub, or a button can fly it. The pointer leans the camera a little. It is a [framed view](framed-views.md): a poster shows the resting frame until the first drawn frame, and whenever WebGL cannot draw.

Lifecycle: the framework controller builds the flight once its element is mounted, attaches `scrollFlight` or tweens `uTravel` itself, and reverts effects before the flight on unmount.

Dependencies: `gsap`, `gsap/ScrollTrigger`, `ogl`, `framed-views.ts` and `image-planes.ts` from this skill.

## Images

The flight's images are textures only; the page's own copies, if it shows them, stay the content. Pass `<img>` elements or URLs. URLs load with `crossOrigin = "anonymous"`, so CDN images need `Access-Control-Allow-Origin` ([image planes](image-planes.md#images-need-cors)). An image that cannot be read is left out of the flight; with none readable, the poster stays.

```ts
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Camera, Mesh, Plane, Program, Texture, Transform, type OGLRenderingContext } from "ogl";
import { framedView, type FramedView, type Uniform } from "./framed-views";
import { textureSource } from "./image-planes";
import type { StageOptions } from "./webgl-stage";

gsap.registerPlugin(ScrollTrigger);

export type Teardown = () => void;

export type FlightOptions = {
  /** The images along the path, nearest first. */
  images: Array<HTMLImageElement | string>;
  /** Image height, in world units. At the start the camera sees about 2.8 units top to bottom. */
  size?: number;
  /** Distance between images along the path. */
  spacing?: number;
  /** How far images sit from the path's center line. Larger than the image width keeps a clear corridor down the middle. */
  radius?: number;
  /** Turn between neighbors, in radians. The golden angle spreads them evenly. */
  turn?: number;
  /** Vertical field of view, in degrees. */
  fov?: number;
  /** Distance at which images have faded into the dark. */
  fog?: number;
  poster?: HTMLImageElement | null;
  stage?: StageOptions;
};

export type Flight = {
  readonly view: FramedView;
  /** Tween these with GSAP; they survive a context loss and restore. */
  readonly uniforms: {
    /** 0 in front of the first image, 1 in front of the last: the view is never empty. */
    uTravel: Uniform<number>;
    /** Camera lean toward the pointer, -1 to 1 on each axis; 0 at rest. */
    uLean: Uniform<number[]>;
  };
  readonly webgl: boolean;
  revert(): void;
};

const CARD_VERTEX = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
varying vec2 vUv;
varying float vDepth;

void main() {
  vUv = uv;
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vDepth = -view.z;
  gl_Position = projectionMatrix * view;
}
`;

const CARD_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uTexture;
uniform float uFog;
varying vec2 vUv;
varying float vDepth;

void main() {
  vec4 color = texture2D(uTexture, vUv);
  // Fade in out of the far dark, and out as the camera comes alongside, so a passing image never fills the view.
  float far = 1.0 - smoothstep(uFog * 0.45, uFog, vDepth);
  float near = smoothstep(0.5, 2.2, vDepth);
  float alpha = color.a * far * near;
  gl_FragColor = vec4(color.rgb * alpha, alpha);
}
`;

/** Loads a URL as a CORS-readable image, or reads an element; null when unreadable. */
async function cardSource(image: HTMLImageElement | string, signal: AbortSignal) {
  if (typeof image !== "string") return textureSource(image, signal);
  const element = new Image();
  element.crossOrigin = "anonymous";
  element.decoding = "async";
  element.src = image;
  signal.addEventListener("abort", () => element.removeAttribute("src"), { once: true });
  return textureSource(element, signal);
}

export function flight(
  host: HTMLElement,
  { images, size = 1.5, spacing = 3.4, radius = 2.2, turn = 2.39996, fov = 50, fog = 16, poster, stage }: FlightOptions,
): Flight {
  const uniforms = { uTravel: { value: 0 }, uLean: { value: [0, 0] } };
  let sources: HTMLImageElement[] = [];
  // The camera starts back from the first image, so the spiral opens ahead of it.
  const start = 4;

  const draw = (gl: OGLRenderingContext) => {
    const scene = new Transform();
    const camera = new Camera(gl, { fov, near: 0.1, far: fog * 1.5 });
    const geometry = new Plane(gl);
    const fogUniform = { value: fog };
    sources.forEach((source, i) => {
      const texture = new Texture(gl, { image: source, generateMipmaps: false, minFilter: gl.LINEAR });
      const program = new Program(gl, {
        vertex: CARD_VERTEX,
        fragment: CARD_FRAGMENT,
        uniforms: { uTexture: { value: texture }, uFog: fogUniform },
        transparent: true,
        cullFace: false,
        depthTest: false,
        depthWrite: false,
      });
      const card = new Mesh(gl, { geometry, program });
      const angle = i * turn;
      card.scale.set((size * source.naturalWidth) / source.naturalHeight, size, 1);
      card.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.6, -i * spacing);
      // Turn each image a little toward the center line, as if hung along a curved wall.
      card.rotation.y = -Math.cos(angle) * 0.35;
      card.setParent(scene);
    });
    // The flight ends where the last image sits as the first did at the start.
    const end = start - (sources.length - 1) * spacing;
    return {
      scene,
      camera,
      update() {
        const z = start + (end - start) * uniforms.uTravel.value;
        const [x, y] = uniforms.uLean.value;
        camera.position.set(x * 0.6, y * 0.4, z);
        camera.lookAt([x * 0.2, y * 0.15, z - 10]);
      },
    };
  };

  const view = framedView(host, {
    draw,
    poster,
    stage,
    async prepare(signal) {
      const loaded = await Promise.all(images.map((image) => cardSource(image, signal)));
      sources = loaded.filter((source): source is HTMLImageElement => !!source);
      return sources.length > 0;
    },
  });

  return {
    view,
    uniforms,
    get webgl() {
      return view.webgl;
    },
    revert() {
      gsap.killTweensOf([uniforms.uTravel, uniforms.uLean.value]);
      view.revert();
    },
  };
}

export type ScrollFlightOptions = {
  /** Element whose scroll range flies the path. Defaults to the flight's element. */
  trigger?: Element;
  scroller?: Element | Window;
  start?: string;
  end?: string;
  /** Seconds the camera takes to catch the scroll position; true locks it. */
  scrub?: number | boolean;
};

/** Scrolling through the trigger flies the path from start to end. */
export function scrollFlight(
  flight: Flight,
  { trigger, scroller, start = "top top", end = "bottom bottom", scrub = 1 }: ScrollFlightOptions = {},
): Teardown {
  if (!flight.webgl) return () => {};
  const from = flight.uniforms.uTravel.value;
  const tween = gsap.fromTo(
    flight.uniforms.uTravel,
    { value: 0 },
    { value: 1, ease: "none", scrollTrigger: { trigger: trigger ?? flight.view.host, scroller, start, end, scrub } },
  );
  return () => {
    tween.scrollTrigger?.kill();
    tween.kill();
    flight.uniforms.uTravel.value = from;
  };
}

export type PointerLeanOptions = {
  /** Seconds the lean takes to follow the pointer. */
  follow?: number;
  /** Element that takes the pointer. Defaults to the flight's element. */
  target?: HTMLElement;
};

/** The camera leans toward the mouse and settles back on leave. Touch and pen never lean it. */
export function pointerLean(flight: Flight, { follow = 0.8, target }: PointerLeanOptions = {}): Teardown {
  if (!flight.webgl) return () => {};
  const surface = target ?? flight.view.host;
  const lean = flight.uniforms.uLean.value;
  const toX = gsap.quickTo(lean, "0", { duration: follow, ease: "power3" });
  const toY = gsap.quickTo(lean, "1", { duration: follow, ease: "power3" });
  const aborter = new AbortController();
  const on = { signal: aborter.signal };
  surface.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse") return;
      const box = surface.getBoundingClientRect();
      toX(gsap.utils.clamp(-1, 1, ((event.clientX - box.left) / box.width) * 2 - 1));
      toY(gsap.utils.clamp(-1, 1, 1 - ((event.clientY - box.top) / box.height) * 2));
    },
    on,
  );
  surface.addEventListener(
    "pointerleave",
    (event) => {
      if (event.pointerType !== "mouse") return;
      toX(0);
      toY(0);
    },
    on,
  );
  return () => {
    aborter.abort();
    gsap.killTweensOf(lean);
    lean[0] = lean[1] = 0;
  };
}
```

The images are transparent cards sorted back to front each frame, so no depth buffer is needed; images that cross in depth can overlap in the wrong order for a frame. Keep `radius` large enough that neighbors do not overlap, or pass `depth: true` through a replacement drawing with opaque cards.

## Budgets

- Each image is a texture and a draw call. Keep a flight to about 20 images, 12 on phones, and size the sources near their largest drawn size.
- The camera's far plane sits just past `fog`; images beyond it cost nothing to draw.

## Wiring

```ts
// Example: a tall section flies the camera through twelve posters as it scrolls past.
const ride = flight(document.querySelector<HTMLElement>("#tunnel")!, { images: posters });
const effects = [scrollFlight(ride, { trigger: document.querySelector("#tunnel-track")! }), pointerLean(ride)];
// On unmount:
effects.forEach((revert) => revert());
ride.revert();
```

Pin the view with `position: sticky` inside a tall track and pass the track as `trigger`, so the page scrolls the flight while the view stays in place.

## Controller contract

| Phase | Call |
|---|---|
| initial state | None: the poster is the initial state. |
| intro | `flight(host, options)` once mounted; await `view.ready` if the intro depends on it; tween `uTravel` for a fly-in. |
| settled | `scrollFlight` and `pointerLean` answer input; nothing loops on its own. |
| outro | Tween `uTravel` or let the page leave; the view keeps drawing. |
| unmount | Revert `scrollFlight` and `pointerLean`, then `revert()`. |
