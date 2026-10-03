---
name: animaxxing-webgl
description: "Add GSAP-driven WebGL effects to existing images without restyling: DOM-synced image planes that track each img through scroll and resize, a hover distortion lens, a scroll-velocity wave, and a reveal or exit wipe, all tweened on shader uniforms, on one shared OGL renderer and canvas per document. The real img stays as the accessible content and the fallback when WebGL is missing, the context is lost, the image lacks CORS, or motion is reduced. Use for WebGL image effects, shader hover, uniform tweens, or keeping a canvas alive across routes. Pair with the matching GSAP framework skill for lifecycle timing. Not for 3D scenes, models, or particle systems, DOM-only effects (use animaxxing), branding, or GSAP API questions."
license: MIT
metadata:
  short-description: GSAP-tweened WebGL image planes and shader effects with a DOM fallback
---

# Animaxxing WebGL

Vanilla TypeScript recipes that let GSAP drive WebGL image effects. A plane draws each image in its exact box; GSAP tweens the plane's shader uniforms. The page stays the DOM: the real `<img>` keeps its alt text, layout, and links, and shows itself whenever the plane cannot draw.

Load the matching `gsap-<framework>` skill first (`gsap-vanilla` for plain sites), installing it if missing. It owns **mount → initial state → intro → settled → outro → end state → unmount**, initialization, navigation, recovery, and cleanup timing. Its `references/transition-archetypes.md`, **Persistent WebGL canvas**, covers keeping the canvas alive across routes. DOM-only effects live in the `animaxxing` skill; this skill never requires it.

## Renderer: OGL

The recipes use [OGL](https://github.com/oframe/ogl) 1.x. Measured with esbuild for the classes these recipes use (renderer, program, mesh, plane geometry, texture, scene), minified and gzipped: OGL 1.0.11 is 14.5 KB, three.js r186 is 133 KB, because three's `WebGLRenderer` pulls in most of the library. The recipes need 2D planes in pixel space with custom shaders and nothing else: no lights, materials, loaders, or scene graph. OGL's `Program`, `Mesh`, `Plane`, and `Texture` map one to one onto that. It does not handle context loss, so the stage does: it rebuilds its renderer and every layer on restore.

If the project already ships three.js, port the recipes rather than add OGL: `ShaderMaterial` for `Program` (same uniform objects), `PlaneGeometry` for `Plane`, `Texture` for `Texture`, a `Scene` and any camera with the recipes' pixel-space vertex shader, and `dispose()` calls for the deletes. three.js restores lost contexts itself, so drop the rebuild and keep the DOM fallback.

## Setup and adaptation

- Install `gsap` 3.13 or later and `ogl` 1.x. Read the installed versions and types before trusting these recipes. The effects register `ScrollTrigger` at module scope; drop that if the project registers plugins centrally. Import the modules only from client code.
- Copy the recipes as three modules with these file names: `webgl-stage.ts`, `image-planes.ts`, `uniform-effects.ts`. Each imports the one before it.
- Images need CORS. Same-origin, `data:`, and `blob:` images work; CDN images need `Access-Control-Allow-Origin` and `crossorigin="anonymous"` in the markup ([image planes](references/recipes/image-planes.md#images-need-cors)). Unreadable images keep their DOM rendering.
- Add only requested effects. Effect constants, shader numbers, and the wipe direction are editable defaults; tune them to the surface. The plane draws the image as the page lays it out and adds no color, font, or layout of its own.
- Mark which images get planes, such as `img[data-webgl]`. Keep images that depend on ancestor clipping, `border-radius`, filters, or `object-position` out of WebGL, or add those to a replacement shader.

## Read only what you need

| Task | Reference |
|---|---|
| The shared renderer and canvas, budgets, context loss, pausing, persistence across routes | [WebGL stage](references/recipes/webgl-stage.md) |
| A WebGL plane that tracks an `<img>`; CORS; replacement shaders | [Image planes](references/recipes/image-planes.md) |
| Hover lens, scroll-velocity wave, reveal and exit wipe | [Uniform effects](references/recipes/uniform-effects.md) |
| Keep one canvas across client-side navigation | Matching installed framework skill's `references/transition-archetypes.md`, **Persistent WebGL canvas** |
| Planes an intro depends on; deadlines and recovery | Matching installed framework skill's `references/initialization.md` |
| Phone tiers and pixel budgets | Matching installed framework skill's `references/devices.md` |
| Verify fallbacks, context loss, pausing, and disposal | [Verification](references/verification.md), then the framework's relevant checks |

## Fallback contract

The DOM is the page. A canvas is never required to read, navigate, or operate it.

| Condition | Result |
|---|---|
| JavaScript disabled | Nothing runs; the images are the page. |
| No WebGL | `holdStage` returns `null`; no canvas; planes resolve `ready` false; hover and wave build nothing; wipe timelines finish at once. |
| Reduced motion | The same as no WebGL. On a preference change, the controller tears down and rebuilds. |
| Image not CORS-readable, or fails to load | That image keeps its DOM rendering; other planes are unaffected. |
| Context lost | Every image shows at once; drawing stops. The restore rebuilds each plane from its retained source with its uniform values. |
| A frame throws | The canvas hides, every image shows, the error is logged, and the stage refuses new planes until recreated. |
| Off screen, or tab hidden | The stage stops ticking; nothing draws until an image nears the viewport or the tab returns. |

The `<img>` only turns transparent (`opacity: 0`, still in the accessibility tree and layout) after its plane has drawn a frame in its place.

## Recipe contract

| Framework phase | Effect responsibility |
|---|---|
| initial state | None: the `<img>` is the initial state. A hidden wipe above the fold uses the framework's initial state and deadline. |
| intro | `imagePlane(image)` once mounted; await `ready` only if the intro depends on the plane; wipe `enter()`. |
| settled | Hover and wave answer input; the stage sleeps with no active plane or a hidden tab. |
| outro | Revert hover and wave, then wipe `exit()`. |
| end state | Planes keep drawing; the controller decides the next action. |
| unmount | Revert effects, then planes. The last release removes the canvas and frees the context. |

- Builders never navigate, mount, subscribe to page lifecycle, or decide when they run.
- Every builder returns an idempotent revert. Reverting frees every program, shader, buffer, vertex array, and texture it created, disconnects observers, kills tweens and triggers, removes listeners, restores uniforms, and restores the image's inline `opacity`.
- One owner per target: a plane owns its image's `opacity`, and each effect owns only its uniforms. Do not combine a plane with a DOM effect on the same image's opacity or transform.
- Uniforms are plain `{ value }` objects that survive a context restore. Tween them with GSAP and `overwrite`; never tween OGL objects directly.
- Hover ignores touch and pen and never sticks after a tap; keyboard focus centers the lens. The wave only answers scroll. Nothing loops on its own, so no pause control is required.
