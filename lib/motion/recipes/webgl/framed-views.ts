// Copied from the animaxxing-webgl skill: references/recipes/framed-views.md. Edit in place; see the recipe for the contract.
import gsap from "gsap";
import { Camera, Mesh, Plane, Program, RenderTarget, Texture, Transform, type OGLRenderingContext } from "ogl";
import { holdStage, type Stage, type StageLayer, type StageOptions } from "./webgl-stage";

export type Uniform<T> = { value: T };

/** The element's box this frame, for drawings that size themselves to it. */
export type ViewFrame = {
  gl: OGLRenderingContext;
  /** CSS pixels. */
  width: number;
  height: number;
  /** The stage's pixel ratio. */
  dpr: number;
  /** Seconds, from GSAP's ticker. */
  time: number;
};

/** What a view draws. Built on attach and again after a context restore. */
export type Drawing = {
  scene: Transform;
  /** A perspective camera's aspect follows the element's box. Omit for shaders that place their own vertices. */
  camera?: Camera;
  /** Syncs uniforms and the camera before each frame. */
  update?(frame: ViewFrame): void;
  /**
   * Frees GL resources outside the scene graph, such as extra render targets. Meshes in `scene` are freed
   * after this runs; clear any uniform that points at a texture freed here.
   */
  dispose?(gl: OGLRenderingContext): void;
};

export type FramedViewOptions = {
  /** Builds the drawing. Throw to keep the poster. */
  draw(gl: OGLRenderingContext): Drawing;
  /** Runs before the first build, such as loading textures. Resolve false to keep the poster. */
  prepare?(signal: AbortSignal): Promise<boolean>;
  /** The resting frame. Defaults to the element's `img[data-poster]`, else its first `<img>`. */
  poster?: HTMLImageElement | null;
  /** A depth buffer for drawings whose surfaces overlap in 3D. */
  depth?: boolean;
  /** Used only if this view creates the stage. */
  stage?: StageOptions;
};

export type FramedView = {
  readonly host: HTMLElement;
  readonly poster: HTMLImageElement | null;
  /** False when the page keeps the poster: no WebGL, reduced motion, failed preparation, or after revert. */
  readonly webgl: boolean;
  /** True after a prepared frame; false for the fallback. */
  readonly ready: Promise<boolean>;
  /** True while the canvas owns the rendering. */
  live(): boolean;
  revert(): void;
};

const COMPOSITE_VERTEX = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;
uniform vec4 uRect;
uniform vec2 uViewport;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec2 pixel = uRect.xy + vec2(position.x + 0.5, 0.5 - position.y) * uRect.zw;
  vec2 clip = pixel / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

const COMPOSITE_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uTexture;
varying vec2 vUv;

void main() {
  // The drawing wrote premultiplied color; pass it through.
  gl_FragColor = texture2D(uTexture, vUv);
}
`;

/** Frees a program's shaders and the uniform locations OGL caches for it, then the program. */
export function freeProgram(gl: OGLRenderingContext, program: Program) {
  const cache = gl.renderer.state.uniformLocations;
  program.uniformLocations?.forEach((location) => cache.delete(location));
  gl.deleteShader(program.vertexShader);
  gl.deleteShader(program.fragmentShader);
  program.remove();
}

/** Frees a render target's framebuffer, textures, and depth buffer. OGL has no remove for these. */
export function freeTarget(gl: OGLRenderingContext, target: RenderTarget) {
  gl.deleteFramebuffer(target.buffer);
  target.textures.forEach((texture) => gl.deleteTexture(texture.texture));
  if (target.depthBuffer) gl.deleteRenderbuffer(target.depthBuffer);
}

/** Frees every mesh under `root`: programs, geometries, and textures held in program uniforms. */
export function freeTree(gl: OGLRenderingContext, root: Transform) {
  const programs = new Set<Program>();
  const geometries = new Set<{ remove(): void }>();
  root.traverse((node) => {
    if (node instanceof Mesh) {
      programs.add(node.program);
      geometries.add(node.geometry);
    }
  });
  const textures = new Set<Texture>();
  programs.forEach((program) => {
    Object.values(program.uniforms).forEach((uniform) => {
      const value = (uniform as Uniform<unknown>).value;
      if (value instanceof Texture) textures.add(value);
    });
    freeProgram(gl, program);
  });
  geometries.forEach((geometry) => geometry.remove());
  textures.forEach((texture) => gl.deleteTexture(texture.texture));
}

export function framedView(
  host: HTMLElement,
  { draw, prepare, poster: posterOption, depth = false, stage: stageOptions }: FramedViewOptions,
): FramedView {
  const poster = posterOption === undefined ? (host.querySelector<HTMLImageElement>("img[data-poster]") ?? host.querySelector("img")) : posterOption;
  let settle: (live: boolean) => void = () => {};
  const ready = new Promise<boolean>((resolve) => (settle = resolve));
  const hold = holdStage(stageOptions);
  const aborter = new AbortController();
  const opacity = poster ? ([poster.style.getPropertyValue("opacity"), poster.style.getPropertyPriority("opacity")] as const) : undefined;
  let live = false;
  let done = false;
  let active = false;
  let prepared = false;
  let gl: OGLRenderingContext | undefined;
  let drawing: Drawing | undefined;
  let target: RenderTarget | undefined;
  let quad: Mesh | undefined;
  let composite: Program | undefined;
  let geometry: Plane | undefined;
  let remove: (() => void) | undefined;
  let observer: IntersectionObserver | undefined;
  const uniforms = { uTexture: { value: null as Texture | null }, uRect: { value: [0, 0, 1, 1] }, uViewport: { value: [1, 1] } };

  const showPoster = () => {
    if (!poster || !opacity) return;
    if (opacity[0]) poster.style.setProperty("opacity", opacity[0], opacity[1]);
    else poster.style.removeProperty("opacity");
  };

  const layer: StageLayer = {
    build(context: OGLRenderingContext, stage: Stage) {
      gl = context;
      try {
        drawing = draw(context);
        target = new RenderTarget(context, { width: 1, height: 1, depth, minFilter: context.LINEAR, magFilter: context.LINEAR });
        uniforms.uTexture.value = target.texture;
        geometry = new Plane(context);
        composite = new Program(context, {
          vertex: COMPOSITE_VERTEX,
          fragment: COMPOSITE_FRAGMENT,
          uniforms,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        });
        if (!context.getProgramParameter(composite.program, context.LINK_STATUS) && !context.isContextLost()) {
          throw new Error("framed view shaders failed to link");
        }
        quad = new Mesh(context, { geometry, program: composite });
        quad.visible = false;
        quad.setParent(stage.scene);
      } catch (error) {
        layer.dispose(false);
        throw error;
      }
    },
    update(stage: Stage) {
      if (!quad || !drawing || !target || !gl) return;
      const box = host.getBoundingClientRect();
      prepared = active && box.width > 0 && box.height > 0;
      // The canvas is outside the element's ancestors, so follow their visibility explicitly.
      quad.visible = prepared && getComputedStyle(host).visibility === "visible";
      if (!prepared) return;
      const rect = uniforms.uRect.value;
      [rect[0], rect[1], rect[2], rect[3]] = [box.left, box.top, box.width, box.height];
      [uniforms.uViewport.value[0], uniforms.uViewport.value[1]] = [stage.width, stage.height];
      const width = Math.max(1, Math.round(box.width * stage.dpr));
      const height = Math.max(1, Math.round(box.height * stage.dpr));
      if (target.width !== width || target.height !== height) target.setSize(width, height);
      if (drawing.camera?.type === "perspective") drawing.camera.perspective({ aspect: box.width / box.height });
      drawing.update?.({ gl, width: box.width, height: box.height, dpr: stage.dpr, time: gsap.ticker.time });
      if (!quad.visible) return;
      // The drawing renders first, into its own target; the stage then draws the quad with the rest.
      gl.renderer.render({ scene: drawing.scene, camera: drawing.camera, target, clear: true });
    },
    rendered() {
      if (live || !quad || !prepared) return;
      live = true;
      poster?.style.setProperty("opacity", "0");
      settle(true);
    },
    dispose(lost: boolean) {
      quad?.setParent(null);
      if (!lost && gl && !gl.isContextLost()) {
        if (drawing) {
          drawing.dispose?.(gl);
          freeTree(gl, drawing.scene);
        }
        if (target) freeTarget(gl, target);
        if (composite) freeProgram(gl, composite);
        geometry?.remove();
      }
      quad = composite = geometry = target = drawing = gl = undefined;
      uniforms.uTexture.value = null;
      prepared = false;
      if (live) {
        live = false;
        showPoster();
      }
      settle(false);
    },
  };

  const view: FramedView = {
    host,
    poster,
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
      showPoster();
      settle(false);
    },
  };
  if (!hold) {
    settle(false);
    return view;
  }

  (prepare ? prepare(aborter.signal) : Promise.resolve(true))
    .then((ok) => {
      if (done) return;
      if (!ok) {
        view.revert();
        return;
      }
      remove = hold.stage.add(layer);
      if (hold.stage.lost()) settle(false);
      // Draw a little before the element enters the viewport; stop once it is well clear.
      observer = new IntersectionObserver(
        (entries) => {
          active = entries[entries.length - 1]?.isIntersecting ?? false;
          hold.stage.setActive(layer, active);
        },
        { rootMargin: "25%" },
      );
      observer.observe(host);
    })
    .catch((error) => {
      view.revert();
      console.error(error);
    });

  return view;
}

