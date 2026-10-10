# Museum of Motion

A fictional museum where every exhibit is a way a web page can move. Built with AI coding agents, GSAP, and the [Animaxxing skills](https://github.com/johnpolacek/animaxxing-skills), as the demo for a Codrops article.

**Live:** [museum.animaxxing.com](https://museum.animaxxing.com)

## What's inside

- 57 exhibits in six groups: Type, Play, Scroll, Pointer, Drag, and Vibes. Each exhibit performs on its own stage, with variation tabs, and the timed ones loop with pause, scrub, and timing controls.
- Vibes: eight small sites, each combining effects into one feeling.
- Page transitions on the Next.js App Router: every page gets an intro, a resting state, and an outro, and a collection name flies into its exhibit's title.
- Reduced motion, keyboard focus, touch, and no-JavaScript fallbacks throughout.

## The motion brief

[`MOTION.md`](MOTION.md) sets the site's personality, curves, timing, and rules. Every agent session reads it before touching animation: `AGENTS.md` points to it, and `CLAUDE.md` imports it. It is also served at [museum.animaxxing.com/MOTION.md](https://museum.animaxxing.com/MOTION.md).

## Agent skills

The skills the agents worked with are checked in, so you can see exactly what they had:

- `.agents/skills`: [Animaxxing skills](https://github.com/johnpolacek/animaxxing-skills) (`animaxxing`, `animaxxing-webgl`, `gsap-nextjs`).
- `.claude/skills`: the [official GSAP skills](https://github.com/greensock/gsap-skills), plus links to the Animaxxing skills.

To add them to your own project:

```
npx skills add https://github.com/greensock/gsap-skills
npx skills add https://github.com/johnpolacek/animaxxing-skills
```

## Run it

```
pnpm install
pnpm dev
```

Then open [localhost:3000](http://localhost:3000). For a production build, `pnpm build && pnpm start`. Browser tests run with `pnpm test:e2e`.

## Where things live

- `lib/exhibits.ts`: every exhibit, its group, builders, and description.
- `lib/motion/`: page motion (hero, collection, exhibit pages, transitions) and the recipe builders from the skills.
- `lib/motion/stages/`: each exhibit's stage.
- `components/motion/`: the transition provider and links that play outros before navigating.

## The build log

The commit history is the build, step by step: each commit is one finished step, from the static poster to the last exhibit.

## Credits

Built by [John Polacek](https://johnpolacek.com). Animation by [GSAP](https://gsap.com). Type is [Archivo](https://fonts.google.com/specimen/Archivo).

## License

MIT
