# Text stability

Requirements for splitting text in the project's existing typography.

## Stable typography for character animation

Read before any recipe that splits characters, especially `charsRiseIn`. Character wrappers interrupt browser kerning ([GSAP's Tips & Limitations](https://gsap.com/docs/v3/Plugins/SplitText/#tips--limitations)), so `split.revert()` restores natural kerning and can snap text horizontally even when the heading's height holds. `smartWrap` prevents mid-word breaks and masks clip the reveal; neither preserves kerning.

Put stable typography in the target's base CSS, present before first paint and kept after cleanup and under reduced motion:

```html
<h2 class="character-headline">Small idea. Big feeling.</h2>
```

```css
/* Only headlines that use character animation, not all headings or body text. */
.character-headline {
  font-kerning: none;
  text-rendering: optimizeSpeed;
}
```

Tailwind: `[font-kerning:none] [text-rendering:optimizeSpeed]` on the same target. Use the project's own selector. This is permanent typography: never toggle it in a builder, callback, or reduced-motion query. For `speakIn`, scope it to the emphasis elements that receive character splits.

Keep `split.revert()` and the controller's cleanup; retaining wrappers is not the spacing fix. If natural kerning is essential, animate whole words or lines instead (`wordsSlideIn`, `linesMaskIn`) and verify.

### Diagnose the measured change

Change one cause at a time:

| Evidence | Targeted response |
|---|---|
| Characters shift horizontally across split/revert, with fonts ready and the same line breaks | Check computed kerning in both states; use the persistent CSS above. A stable heading box does not rule this out. |
| Font face or metrics change after splitting | Have the controller wait for `document.fonts.ready`, or use `autoSplit`/`onSplit` per the installed GSAP docs; returning the animation from `onSplit` lets the plugin manage re-splits. |
| Joined glyphs such as `fi`/`ffi` differ between states | Inspect ligatures separately. If confirmed, test `font-variant-ligatures: none` on the affected target only, or animate words/lines. The rendering hint does not fix every font and browser. |
| Line membership or heading height changes | Inspect width, white space, tracking, and word grouping. Omit `text-wrap: balance` on split targets (GSAP warns against it) and keep wrapping consistent across states. Use `smartWrap` for chars-only splits; re-split lines on width changes through the controller. |
| Text looks heavier after revert, or glyph edges/descenders clip while masked | Compare computed font properties and readiness first, then inspect glyph ink against each mask; see below. |
| Weight effects jump when pinned widths are removed | Compare pinned widths with the settled font's advances; verify the revert boundary separately. |

### Apparent weight change from clipped glyph ink

Distinct from kerning: `mask: "chars"` with tight negative `letter-spacing` and `line-height` can clip glyph edges and descenders. Removing the masks reveals the whole glyph, which looks heavier without any change in weight or position. The kerning CSS gives masks no extra room.

First compare computed `font-family`, `font-weight`, `font-size`, `font-style`, `font-variation-settings`, `font-feature-settings`, tracking, and line-height on the split characters and restored text, and confirm the intended face actually rendered. If these match, compare captured glyphs and mask overflow before trying `force3D`, layer promotion, or font-smoothing changes.

For confirmed clipping, add a class to the affected split's masks right after creation, before building the reveal:

```ts
// split is the affected headline's character-masked SplitText instance.
for (const mask of split.masks) mask.classList.add("title-char-mask");
// With CSS Modules, pass the scoped token instead: styles.titleCharMask.
```

```css
.title-char-mask {
  /* Example value; tune to the actual glyph ink. */
  padding: 0.15em;
  margin: -0.15em;
}
```

Padding enlarges the clip; the negative margin keeps the layout footprint. Use only the room the font, size, tracking, and line-height need, then remeasure spacing, wrapping, and height. Apply it only to affected masks, never to all wrappers or headings.

Apply the class to each new split (inside `onSplit` with auto re-splitting). [Split entrances](recipes/split-entrances.md) accept it as `charMaskClass`. The class lives on temporary mask nodes and disappears with revert.

Expanded masks can leak ink at the hidden endpoint. Check forward and backward reveals in both travel directions; if a frame leaks, increase only the hidden travel distance, keeping timing.

Measure with the [cleanup checks](verification.md#splittext-cleanup-stability).
