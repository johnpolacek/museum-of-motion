# Verification

Automated suite: `motion/` in [animaxxing-skills-test](https://github.com/johnpolacek/animaxxing-skills-test) type-checks every recipe straight from this skill and runs `motion/tests/webgl.spec.ts` against `motion/fixtures/webgl.html` in headless Chromium, drawing through SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`). Run `npx playwright test -c motion/playwright.config.ts webgl` from that repository after changing any recipe. Checks cover lifecycle state, DOM fallbacks, counted GL resources, uniforms, and sampled pixels for wrapper visibility and lens distortion. Keep usage snippets under a `## Wiring` heading or starting with `// Example` so the suite skips them.

Reference demo: none yet. Check visual quality, shader tuning, and frame pacing in the consuming app, alongside the framework skill's checks.

## Portability

- The plane draws the image the page laid out: same box, `object-fit`, and aspect, at any size. No font, color, or layout comes from this skill.
- Swap the fixture's images and CSS for another site's: planes still land on their images' boxes, and every fallback shows that site's own images.
- Tune effect strengths to the imagery; a subtle lens on a busy photo can read as a rendering fault.

## Stage

- Several planes share one `canvas[data-webgl-stage]`: `aria-hidden`, `pointer-events: none`, fixed over the viewport. Releasing the last hold removes it.
- A shell hold keeps the same canvas element across planes that come and go.
- Desktop draws at no more than 2x and within `maxPixels`; a coarse pointer draws at no more than 1.5x.
- With every plane well off screen, the stage draws one clearing frame and stops; scrolling back resumes it. A hidden tab stops drawing until it returns.
- A plane that leaves the screen while the stage sleeps still gets its clearing frame; no ghost stays on the canvas.
- A frame that throws hides the canvas, shows every image, and a plane built afterward resolves `ready` false.

## Planes and fallbacks

- A plane's `uRect` matches its image's box after scroll and resize, and `uViewport` matches the canvas.
- The `<img>` turns transparent after a prepared stage frame; it stays in the accessibility tree and keeps its accessible name while its ancestors are visible.
- A wrapper's `visibility: hidden` leaves no plane pixels on the canvas. Hidden-at-build images still resolve readiness; revealing the wrapper draws correctly without a DOM-image flash. Repeat hide and show after initialization.
- Without WebGL: no canvas, `ready` resolves `false`, and the image's inline style is untouched.
- Reduced motion: no canvas, and wipe timelines complete at once with their callbacks.
- An image served without CORS keeps its DOM rendering, never becomes a texture, and its plane reports `webgl` false; one served with `Access-Control-Allow-Origin` but without `crossorigin` loads a readable copy and draws.
- Lose the context with `WEBGL_lose_context`: every image shows at once and drawing stops. Restore it: planes rebuild (one new program and texture each) and keep their uniform values.
- Revert every plane: GL deletes match creations for textures, programs, shaders, buffers, and vertex arrays, and each image's inline style matches its pre-build state.

## Effects

- Hover: the lens rises to its strength under the mouse and tracks the pointer in plane coordinates; it falls to 0 on leave; touch never raises it; keyboard focus raises it centered and blur lowers it. After revert, input changes nothing.
- The lens changes sampled image pixels and returns to the original rendering at zero strength. Constant `smoothstep` edges in submitted shaders are increasing, as required by GLSL; a permissive software driver alone cannot validate this constraint.
- Wave: scrolling bends the plane within `max` and it straightens to 0 at rest. After revert no ScrollTrigger remains and scrolling changes nothing.
- Wipe: builds hidden at 0, `enter()` ends at 1, an `exit()` mid-way turns back from where it is, and revert restores the starting value.

## Manual checks

- On a real phone at 4x CPU throttling, scroll a page of planes: frame pacing holds, or lower `maxDpr`, `maxPixels`, `segments`, or the number of planes.
- Pinch-zoom, rotate, and show and hide the browser's URL bar: planes stay on their images.
- With a smooth scroller, pass its scroller to `scrollWave` and confirm the planes follow the eased position.
- Navigate several routes with the framework's transitions: one canvas throughout, and no image flashes back before its page unmounts.

## Report

Say which checks ran in a browser and which were static review. SwiftShader can check lifecycle, state, and specific pixels; it does not establish visual quality or hardware GPU performance.
