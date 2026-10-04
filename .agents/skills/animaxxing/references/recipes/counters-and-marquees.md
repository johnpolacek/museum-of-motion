# Recipe: counters and marquees

A number that counts up to its value, digits that roll to each new value, a seamless looping marquee, and a logo grid that swaps one cell at a time. Each starts from markup that reads correctly without JavaScript.

Lifecycle: see the [controller contract](#controller-contract); the controller calls each `revert` on unmount. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`.

```ts
import gsap from "gsap";

/* Swap for the project's helper if it has one. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type Teardown = () => void;
type Register = (fn: () => void) => void;

/**
 * Runs setup in its own GSAP context and returns a once-only teardown that also rolls back a throw.
 * `dispose` undoes writers, observers, and DOM additions before the context reverts; `after` restores after it.
 */
function own(setup: (dispose: Register, after: Register) => void): Teardown {
  const ctx = gsap.context(() => {});
  const disposers: Array<() => void> = [];
  const restores: Array<() => void> = [];
  let done = false;
  const teardown = () => {
    if (done) return;
    done = true;
    let failure: unknown;
    const attempt = (fn: () => void) => {
      try {
        fn();
      } catch (error) {
        failure ??= error;
      }
    };
    disposers.splice(0).reverse().forEach(attempt);
    attempt(() => ctx.revert());
    restores.splice(0).reverse().forEach(attempt);
    if (failure) throw failure;
  };
  let failure: { error: unknown } | undefined;
  // Catch inside add: GSAP restores its current context only when add returns.
  ctx.add(() => {
    try {
      setup((fn) => disposers.push(fn), (fn) => restores.push(fn));
    } catch (error) {
      failure = { error };
    }
  });
  if (failure) {
    teardown();
    throw failure.error;
  }
  return teardown;
}

/** Records inline properties and returns a restore for after the revert. */
function snapshotStyles(elements: HTMLElement[], props: string[]): () => void {
  const saved = elements.map((element) => props.map((prop) =>
    [element.style.getPropertyValue(prop), element.style.getPropertyPriority(prop)] as const));
  return () =>
    elements.forEach((element, i) => {
      gsap.set(element, { clearProps: props.join(",") });
      props.forEach((prop, j) => {
        const [value, priority] = saved[i]?.[j] ?? ["", ""];
        if (value) element.style.setProperty(prop, value, priority);
        else element.style.removeProperty(prop);
      });
    });
}
```

## countUp

The element's text is its final value. Each frame keeps its separators, decimals, prefix, and suffix, so `1,204`, `98.6%`, and `$3.2M` count correctly. Pass `locale` when the figure's formatting differs from the page's `lang`. Width is reserved at the final value, and assistive technology reads only the final value.

```html
<span class="stat" data-count>12,480</span>
```

```css
/* Equal-width digits keep the count from jittering. */
.stat { font-variant-numeric: tabular-nums; }
```

```ts
export type CountOptions = {
  from?: number;
  duration?: number;
  delay?: number;
  /** Locale of the figure's formatting, for reading and writing it. Defaults to the document's `lang`. */
  locale?: string;
  onComplete?: () => void;
};
export type Count = { timeline: gsap.core.Timeline; revert: Teardown };

/** `locale`, else the document's `lang`. An unsupported or malformed tag, such as `en_US`, falls back to the browser's. */
function numberLocale(locale: string | undefined): string | undefined {
  const tag = locale ?? (document.documentElement.lang || undefined);
  try {
    return tag && Intl.NumberFormat.supportedLocalesOf(tag).length > 0 ? tag : undefined;
  } catch {
    return undefined;
  }
}

/** The locale's decimal mark: "." for en, "," for de. */
function decimalMark(locale: string | undefined): string {
  return new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === "decimal")?.value ?? ".";
}

/** Splits "$3.2M" into "$", 3.2, "M" and keeps the decimals shown. */
function parseFigure(text: string, decimal: string) {
  const match = text.match(/^(\D*?)(-?[\d.,\s]*\d)(.*)$/s);
  if (!match) return undefined;
  const [, prefix = "", digits = "", suffix = ""] = match;
  // A mark that appears twice is grouping in another convention, not a decimal point.
  const at = digits.indexOf(decimal) === digits.lastIndexOf(decimal) ? digits.lastIndexOf(decimal) : -1;
  const whole = at >= 0 ? digits.slice(0, at) : digits;
  const fraction = at >= 0 ? digits.slice(at + 1).replace(/\D/g, "") : "";
  const value = Number(`${whole.replace(/\D/g, "") || 0}.${fraction || 0}`) * (digits.trim().startsWith("-") ? -1 : 1);
  return { prefix, suffix, value, decimals: fraction.length };
}

/** Visually hidden, still read by assistive technology. */
const VISUALLY_HIDDEN = { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" };

export function countUp(
  element: HTMLElement,
  { from = 0, duration = 1.6, delay = 0, locale, onComplete }: CountOptions = {},
): Count {
  const finalText = element.textContent ?? "";
  const figureLocale = numberLocale(locale);
  const figure = parseFigure(finalText.trim(), decimalMark(figureLocale));
  const timeline = gsap.timeline({ delay, defaults: { overwrite: "auto" } });
  if (onComplete) timeline.eventCallback("onComplete", onComplete);
  const revert = own((dispose, after) => {
    after(snapshotStyles([element], ["min-width", "display"]));
    after(() => {
      element.textContent = finalText;
    });
    dispose(() => timeline.kill());
    if (!figure || prefersReducedMotion()) return;
    const format = new Intl.NumberFormat(figureLocale, {
      minimumFractionDigits: figure.decimals,
      maximumFractionDigits: figure.decimals,
    });
    // Reserve the final width before the digits change.
    const width = element.getBoundingClientRect().width;
    gsap.set(element, { display: "inline-block", minWidth: `${width}px` });
    // The counting digits are hidden from assistive technology, which reads the final value from its twin.
    const shown = document.createElement("span");
    shown.setAttribute("aria-hidden", "true");
    const spoken = document.createElement("span");
    spoken.textContent = finalText;
    Object.assign(spoken.style, VISUALLY_HIDDEN);
    element.replaceChildren(shown, spoken);
    const write = (n: number) => {
      shown.textContent = `${figure.prefix}${format.format(n)}${figure.suffix}`;
    };
    const counter = { n: from };
    write(from);
    timeline.to(counter, {
      n: figure.value,
      duration,
      ease: "power3.out",
      onUpdate: () => write(counter.n),
      onComplete: () => {
        element.textContent = finalText;
      },
    });
  });
  return { timeline, revert };
}
```

Unusual formats (fractions, ranges, several numbers) are left alone; mark one number per element.

## marquee

A row scrolls sideways forever. Clones fill the container and are `aria-hidden` and `inert`, so each item is announced and focused once. It slows on mouse hover and pauses on focus inside and off screen.

```html
<div class="marquee" aria-label="Clients">
  <ul class="marquee-row">…items…</ul>
</div>
```

```css
.marquee { overflow: hidden; }
.marquee-row { display: flex; width: max-content; flex: none; }
.marquee-inner { display: flex; width: max-content; } /* Added by the builder around the rows. */
```

```ts
export type MarqueeOptions = {
  /** Travel in px per second. */
  speed?: number;
  /** -1 moves left, 1 moves right. */
  direction?: -1 | 1;
  /** Speed multiplier while the mouse is over the marquee. */
  hoverSpeed?: number;
};
export type Marquee = { pause: () => void; play: () => void; revert: Teardown };

export function marquee(
  container: HTMLElement,
  row: HTMLElement,
  { speed = 60, direction = -1, hoverSpeed = 0.25 }: MarqueeOptions = {},
): Marquee {
  if (prefersReducedMotion()) return { pause: () => {}, play: () => {}, revert: () => {} };
  let loop: gsap.core.Tween | undefined;
  let paused = false;
  let visible = true;
  let focused = false;
  const sync = () => {
    if (!loop) return;
    if (paused || !visible || focused) loop.pause();
    else loop.play();
  };

  const revert = own((dispose) => {
    // Wrap the row and its clones in one strip that moves; the row itself is never transformed.
    const strip = document.createElement("div");
    strip.className = "marquee-inner";
    row.before(strip);
    strip.append(row);
    dispose(() => {
      strip.before(row);
      strip.remove();
    });

    const build = () => {
      loop?.kill();
      strip.querySelectorAll("[data-marquee-clone]").forEach((clone) => clone.remove());
      gsap.set(strip, { x: 0 });
      const width = row.offsetWidth;
      if (!width) return;
      const copies = Math.ceil(container.clientWidth / width) + 1;
      for (let i = 0; i < copies; i++) {
        const clone = row.cloneNode(true) as HTMLElement;
        clone.dataset.marqueeClone = "";
        clone.setAttribute("aria-hidden", "true");
        clone.inert = true;
        clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
        clone.removeAttribute("id");
        strip.append(clone);
      }
      const start = direction < 0 ? 0 : -width;
      loop = gsap.fromTo(strip, { x: start }, { x: start + direction * width, duration: width / speed, ease: "none", repeat: -1 });
      sync();
    };
    build();
    dispose(() => loop?.kill());

    // Rebuild when the row or container changes width, once per frame at most.
    let frame = 0;
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(build);
    });
    resize.observe(container);
    resize.observe(row);
    dispose(() => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    });

    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      sync();
    });
    seen.observe(container);
    dispose(() => seen.disconnect());

    let slow: gsap.core.Tween | undefined;
    dispose(() => slow?.kill());
    const ease = (scale: number) => {
      slow?.kill();
      if (loop) slow = gsap.to(loop, { timeScale: scale, duration: 0.4, ease: "power2.out" });
    };
    const on = <K extends keyof HTMLElementEventMap>(type: K, handler: (event: HTMLElementEventMap[K]) => void) => {
      container.addEventListener(type, handler);
      dispose(() => container.removeEventListener(type, handler));
    };
    on("pointerenter", (event) => {
      if (event.pointerType === "mouse") ease(hoverSpeed);
    });
    on("pointerleave", () => ease(1));
    on("focusin", () => {
      focused = true;
      sync();
    });
    on("focusout", (event) => {
      focused = container.contains(event.relatedTarget as Node | null);
      sync();
    });
  });

  return {
    pause: () => {
      paused = true;
      sync();
    },
    play: () => {
      paused = false;
      sync();
    },
    revert,
  };
}
```

The endless loop needs a user pause (WCAG 2.2.2): wire `pause` and `play` to a visible control.

## logoCycle

A grid of logos where one cell at a time swaps to the next logo in a reserve pool, the old one sliding out as the new one slides in. The markup lists every logo; cells show the first few, and the rest wait in a hidden pool. Swapped logos rejoin the back of the pool, so every logo gets its turn. Real elements move between the cells and the pool; nothing is cloned.

```html
<ul class="logo-grid" aria-label="Clients">
  <li data-logo-cell><img src="/a.svg" alt="Acme" /></li>
  <li data-logo-cell><img src="/b.svg" alt="Bolt" /></li>
  <li data-logo-cell><img src="/c.svg" alt="Crane" /></li>
</ul>
<div hidden data-logo-pool>
  <img src="/d.svg" alt="Dune" />
  <img src="/e.svg" alt="Echo" />
</div>
```

```css
/* Each cell stacks its outgoing and incoming logo in one grid area and clips the slide. */
[data-logo-cell] { display: grid; overflow: hidden; }
[data-logo-cell] > * { grid-area: 1 / 1; }
```

Each cell holds one logo element, and the pool holds the same kind of element, since they trade places. Size cells in CSS, so a wider logo never shifts the grid.

```ts
export type LogoCycleOptions = {
  /** Seconds between swaps. */
  interval?: number;
  /** Seconds each swap takes. */
  duration?: number;
  /** Accepts a registered CustomEase name. */
  ease?: string;
};
export type LogoCycle = { pause: () => void; play: () => void; revert: Teardown };

export function logoCycle(
  grid: HTMLElement,
  pool: HTMLElement,
  { interval = 2, duration = 0.6, ease = "power3.inOut" }: LogoCycleOptions = {},
): LogoCycle {
  const idle = { pause: () => {}, play: () => {}, revert: () => {} };
  const cells = Array.from(grid.querySelectorAll<HTMLElement>("[data-logo-cell]"));
  if (prefersReducedMotion() || !cells.length || !pool.children.length) return idle;
  /** Reasons the cycle holds: a pause control, off screen, hover, or focus inside. */
  const holds = new Set<string>();
  let swap: gsap.core.Timeline | undefined;
  let next: gsap.core.Tween | undefined;
  let last = -1;

  const revert = own((dispose, after) => {
    // Every logo returns to its original parent, in its original order.
    const homes = [...cells, pool].map((parent) => [parent, Array.from(parent.children) as HTMLElement[]] as const);
    after(() => homes.forEach(([parent, logos]) => parent.append(...logos)));
    // Restore each logo's `style` attribute exactly, including none; clearProps also resets GSAP's cache.
    const styles = homes.flatMap(([, logos]) => logos).map((logo) => [logo, logo.getAttribute("style")] as const);
    after(() =>
      styles.forEach(([logo, value]) => {
        gsap.set(logo, { clearProps: "transform,opacity,visibility" });
        if (value === null) logo.removeAttribute("style");
        else logo.setAttribute("style", value);
      }),
    );
    dispose(() => {
      swap?.kill();
      next?.kill();
    });

    const step = () => {
      if (holds.size) {
        next = gsap.delayedCall(interval, step);
        return;
      }
      // A different cell each time, never the one just swapped.
      let i = gsap.utils.random(0, cells.length - 1, 1);
      if (cells.length > 1 && i === last) i = (i + 1) % cells.length;
      last = i;
      const cell = cells[i]!;
      const outgoing = cell.lastElementChild as HTMLElement | null;
      const incoming = pool.firstElementChild as HTMLElement | null;
      if (!outgoing || !incoming) return;
      cell.append(incoming);
      swap = gsap
        .timeline({
          onComplete: () => {
            pool.append(outgoing);
            gsap.set([outgoing, incoming], { clearProps: "transform,opacity,visibility" });
            next = gsap.delayedCall(interval, step);
          },
        })
        .fromTo(incoming, { yPercent: 100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration, ease }, 0)
        .to(outgoing, { yPercent: -100, autoAlpha: 0, duration, ease }, 0);
    };
    next = gsap.delayedCall(interval, step);

    const seen = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) holds.delete("hidden");
      else holds.add("hidden");
    });
    seen.observe(grid);
    dispose(() => seen.disconnect());
    const on = <K extends keyof HTMLElementEventMap>(type: K, handler: (event: HTMLElementEventMap[K]) => void) => {
      grid.addEventListener(type, handler);
      dispose(() => grid.removeEventListener(type, handler));
    };
    on("pointerenter", (event) => {
      if (event.pointerType === "mouse") holds.add("hover");
    });
    on("pointerleave", () => holds.delete("hover"));
    on("focusin", () => holds.add("focus"));
    on("focusout", (event) => {
      if (!grid.contains(event.relatedTarget as Node | null)) holds.delete("focus");
    });
  });

  return { pause: () => void holds.add("paused"), play: () => void holds.delete("paused"), revert };
}
```

A hold never interrupts a swap in progress; the next swap waits until every hold clears. Swapped logos are real content, so assistive technology reads whichever logos are in the cells; keep the grid out of live regions. The cycle runs past five seconds, so wire `pause` and `play` to a visible control.

## odometer

A figure whose digits sit in columns that roll to each new value, like a car odometer. Use it for a number that changes while the page is open, such as a live count or a price; `countUp` is for a figure arriving once. The element's text is its first value. `set` takes a number, formatted like that first value, or a string. Rising values roll every column forward and falling values roll it back, so 19 to 20 turns the ones column through 9 to 0, not back down the column.

```html
<span class="stat" data-odometer>1,204</span>
```

```css
/* Equal-width digits keep the columns from shifting as they roll. */
.stat { font-variant-numeric: tabular-nums; }
```

```ts
export type OdometerOptions = {
  /** Seconds each column rolls. */
  duration?: number;
  /** Seconds between columns, starting at the right. */
  stagger?: number;
  /** Accepts a registered CustomEase name. */
  ease?: string;
  /** Locale of the figure's formatting. Defaults to the document's `lang`. */
  locale?: string;
};
export type Odometer = {
  /** Rolls to a number, formatted like the first value, or to a string as given. Returns the roll, or undefined when nothing moves. */
  set: (value: number | string) => gsap.core.Timeline | undefined;
  revert: Teardown;
};

/** Each column holds 0–9 twice, so a roll can pass 9 to 0 in either direction. */
const COLUMN_DIGITS = 20;
const isDigit = (char: string) => char >= "0" && char <= "9";
/** The characters that are not digits, in place, so two values with the same shape reuse their columns. */
const shapeOf = (text: string) => text.replace(/\d/g, "0");

export function odometer(
  element: HTMLElement,
  { duration = 0.9, stagger = 0.04, ease = "power3.out", locale }: OdometerOptions = {},
): Odometer {
  let text = (element.textContent ?? "").trim();
  const figureLocale = numberLocale(locale);
  const figure = parseFigure(text, decimalMark(figureLocale));
  const format = figure
    ? (n: number) =>
        `${figure.prefix}${new Intl.NumberFormat(figureLocale, {
          minimumFractionDigits: figure.decimals,
          maximumFractionDigits: figure.decimals,
        }).format(n)}${figure.suffix}`
    : (n: number) => String(n);
  const valueOf = (value: string) => parseFigure(value, decimalMark(figureLocale))?.value ?? NaN;
  const toText = (value: number | string) => (typeof value === "number" ? format(value) : value.trim());

  if (prefersReducedMotion()) {
    return {
      set: (value) => {
        text = toText(value);
        element.textContent = text;
        return undefined;
      },
      revert: () => {},
    };
  }

  type Column = { digit: number; sizer: HTMLElement; strip: HTMLElement };
  let columns: Column[] = [];
  let roll: gsap.core.Timeline | undefined;
  const shown = document.createElement("span");
  const spoken = document.createElement("span");

  /** Column offset for a position in 0–19. */
  const place = (strip: HTMLElement, position: number) => gsap.set(strip, { yPercent: (-100 / COLUMN_DIGITS) * position });
  /** Where a column sits now, in 0–19, read from its transform. */
  const positionOf = (strip: HTMLElement) => -Number(gsap.getProperty(strip, "yPercent")) / (100 / COLUMN_DIGITS);

  /** Rebuilds the shown characters. `start` gives each new column, counted from the right, its first digit. */
  const render = (value: string, start: (fromRight: number) => number) => {
    const digits = [...value].filter(isDigit).length;
    let seen = 0;
    columns = [];
    shown.replaceChildren(
      ...[...value].map((char) => {
        if (!isDigit(char)) return document.createTextNode(char);
        const fromRight = digits - 1 - seen++;
        // The hidden sizer gives the column its width and baseline; the strip rolls over it, clipped to one line.
        const slot = document.createElement("span");
        Object.assign(slot.style, { display: "inline-block", position: "relative", clipPath: "inset(0)" });
        const sizer = document.createElement("span");
        sizer.textContent = char;
        sizer.style.visibility = "hidden";
        const strip = document.createElement("span");
        Object.assign(strip.style, { position: "absolute", left: "0", top: "0", width: "100%", textAlign: "center" });
        for (let i = 0; i < COLUMN_DIGITS; i++) {
          const line = document.createElement("span");
          line.style.display = "block";
          line.textContent = String(i % 10);
          strip.append(line);
        }
        slot.append(sizer, strip);
        const digit = Number(char);
        place(strip, start(fromRight));
        columns.push({ digit, sizer, strip });
        return slot;
      }),
    );
  };

  const revert = own((dispose, after) => {
    after(() => {
      element.textContent = text;
    });
    dispose(() => roll?.kill());
    shown.setAttribute("aria-hidden", "true");
    Object.assign(spoken.style, VISUALLY_HIDDEN);
    spoken.textContent = text;
    render(text, (fromRight) => {
      const digits = [...text].filter(isDigit);
      return Number(digits[digits.length - 1 - fromRight]);
    });
    element.replaceChildren(shown, spoken);
  });

  const set = (value: number | string) => {
    const next = toText(value);
    if (next === text) return undefined;
    const rising = !(valueOf(next) < valueOf(text));
    // Positions before the roll, read before anything is rebuilt, counted from the right.
    const before = columns.map((column) => positionOf(column.strip) % 10).reverse();
    roll?.kill();
    if (shapeOf(next) !== shapeOf(text)) render(next, (fromRight) => before[fromRight] ?? 0);
    text = next;
    spoken.textContent = next;
    const targets = [...next].filter(isDigit).map(Number);
    roll = gsap.timeline();
    columns.forEach((column, i) => {
      const target = targets[i] ?? 0;
      const order = columns.length - 1 - i;
      const from = positionOf(column.strip) % 10;
      column.digit = target;
      column.sizer.textContent = String(target);
      if (Math.abs(from - target) < 0.001) return place(column.strip, target);
      // Forward rolls run 0–19 upward; backward rolls start in the second set and run down.
      const start = rising ? from : from + 10;
      const end = rising ? (target >= from ? target : target + 10) : target <= from ? target + 10 : target;
      place(column.strip, start);
      roll!.to(
        column.strip,
        { yPercent: (-100 / COLUMN_DIGITS) * end, duration, ease, onComplete: () => place(column.strip, target) },
        order * stagger,
      );
    });
    return roll;
  };

  return { set, revert };
}
```

The shown digits are hidden from assistive technology, which reads the current value from a visually hidden twin. That twin is not announced when it changes; wrap the figure in `role="status"` only if every change should be spoken. `revert` leaves the element's text at its latest value.

## Controller contract

| Builder | Phase | Returns | Reduced motion |
|---|---|---|---|
| `countUp` | Intro, or when the figure scrolls into view | `{ timeline, revert }` | Final value shown; completion fires |
| `marquee` | Settled, once fonts and images in the row have loaded | `{ pause, play, revert }` | No-op; row static, wrapping or scrolling natively in CSS |
| `odometer` | Initial state, then the app calls `set` on each new value | `{ set, revert }` | `set` writes the new text at once |
| `logoCycle` | Settled, once the cells' logos have loaded | `{ pause, play, revert }` | No-op; the first logos stay, the pool stays hidden |

- A counted figure needs no pre-paint hiding when built at initial state: it writes the start value before paint.
- Rebuild the marquee or logo cycle after its items change.
