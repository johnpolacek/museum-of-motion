# Motion brief: Museum of Motion

Read this before adding or changing any animation.

## Personality: kinetic poster

The type is alive. The site is a poster giving a performance: letters stretch, swell, and settle. Motion is bold, precise, and a little springy.

## Principles

1. **Type is the actor.** Archivo's weight axis (100 to 900) and width axis (62 to 125) do most of the work. Prefer a change in weight or width over a plain fade.
2. **Arrive with bounce, leave clean.** Entrances overshoot slightly and settle. Exits are quick and straight, with no overshoot.
3. **Show, then rest.** Every element performs once, then holds still. Ambient motion is rare and has a pause control.
4. **The frame stays.** The masthead and footer persist across pages. Only the page content performs.
5. **The poster sets the color.** No color animation. Cobalt, white, and ink stay put.

## Curves

One entrance curve and one exit curve for the whole site. Register both once with CustomEase, before any builder runs.

```ts
CustomEase.create("signature", "M0,0 C0.2,1.5 0.35,1 1,1");
CustomEase.create("signature-exit", "M0,0 C0.55,0 0.85,0.3 1,1");
```

- `signature`: fast start, overshoots about 8%, settles. Use for entrances.
- `signature-exit`: slow start, fast finish, no overshoot. Use for exits.
- Bigger personality moments may use `elastic.out(1, 0.5)` or `back.out(1.8)`, at most one per screen.

## Timing

| Role | Duration | Stagger |
|---|---|---|
| Display type entrance | 0.6 to 1.1 s | 0.02 to 0.04 s per character, 0.06 s per line |
| UI entrance: labels, nav, specs | 0.3 to 0.45 s | 0.04 s |
| Any exit | 0.25 to 0.35 s | 0.012 to 0.03 s |
| Hover | 0.25 s in, 0.35 s out | none |

Exits are roughly half as long as entrances.

## Signature moves

- **Width stretch.** Display type arrives condensed (wdth 62) and widens to rest, or arrives wide (125) and tightens.
- **Weight gain.** Type arrives light and gains weight as it lands.
- **Stretch and squeeze out.** On exit, display type condenses and drops away behind a mask.

## By surface

**Home hero.** Each headline word performs the exhibit it is numbered with, then lands at rest: 02 Stagger on "Every", 30 Hover (its Underline tab) on "way", 08 Wave (its Weight tab) on "page", 03 Slide on "can", 01 Mask on "move." The hero reads these numbers from the collection, so they follow any renumbering. The headline settles as a straight sentence, so it reads as finished. The mock's frozen frames are moments from these moves, not the rest. At rest, a small move from 08 Wave ripples through the headline every few seconds. The first comes a beat after the headline lands and the wordmark finishes. Its label names the move in play, as in "08 Wave | Hop". Between moves the old name squeezes and drops behind a mask, and the new one stretches up and gains weight, letter by letter. "08 Wave |" holds still. The label and the pause control sit just above the rule, at the right. A Replay control plays the headline again from the top. Only the headline replays: the rule, the text under it, and the controls stay put.

**Collection.** Group rules draw across. Names arrive with a weight gain as they scroll in. On hover and keyboard focus, a name widens. Its blue color swaps instantly, as in the static site, and is never tweened.

**Exhibit page.** The title widens into place. The stage plays its exhibit. Specs and labels rise in quickly.

**Vibe, full page.** A vibe opens in its own tab at `/vibes/[slug]`, filling the window with no masthead or footer. It is the same page as in the exhibit's stage, with the same intro, Replay, and reduced-motion behavior. No page transition: it is a separate document.

**Page transitions.** Outgoing display type squeezes and drops behind masks. Incoming display type stretches up with the signature bounce. The blue field never flashes white between pages.

## Rules

- Width and weight moves reflow text. Pin each character to its widest or heaviest width, as the skill does for weight moves, or use them only on display type with room to grow.
- Animate only transforms, opacity, clip-path, and the font axes. Never animate layout or color.
- Hover effects have a matching keyboard focus state. Touch never gets stuck hover.
- Reduced motion: every element appears at its resting state. No splitting, no ambient loops.
- Any loop longer than five seconds gets a pause control.
