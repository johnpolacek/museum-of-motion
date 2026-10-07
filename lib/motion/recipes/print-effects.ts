// Copied from the animaxxing skill: references/recipes/print-effects.md. Edit in place; see the recipe for the contract.
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
export type PrintEffect = { timeline: gsap.core.Timeline; revert: Teardown };
export type StrokeDirection = "right" | "down";

/** Per-pixel thresholds, 0 to 255: the order a dry brush covers the area in. Seeded, so the edge is stable. */
export function brushThresholds(width: number, height: number, direction: StrokeDirection = "right"): Uint8Array {
  const hash = (x: number, y: number) => {
    let n = Math.imul(x + 19, 374761393) + Math.imul(y + 37, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    return (hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx) * (1 - fy) + (hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx) * fy;
  };
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;
      // The stroke's direction, then broad patches, then fine grain to fill the gaps last.
      const lead = direction === "down" ? ny * 0.68 - 0.18 : nx * 0.5 + ny * 0.18;
      const value = lead + noise(nx * 7, ny * 9) * 0.19 + noise(nx * 43, ny * 51) * 0.12 + hash(x, y) * 0.13;
      out[y * width + x] = Math.max(0, Math.min(255, Math.round(value * 225)));
    }
  }
  return out;
}

export type PaintOptions = {
  /** The cover's color. Defaults to the target's computed background color, then the page's. */
  paper?: string;
  direction?: StrokeDirection;
  duration?: number;
  /** Moves across the target with the stroke's leading edge, then fades. */
  roller?: HTMLElement;
};

export function paintReveal(target: HTMLElement, { paper, direction = "right", duration = 2.4, roller }: PaintOptions = {}): PrintEffect {
  const timeline = gsap.timeline();
  if (prefersReducedMotion()) return { timeline, revert: () => timeline.kill() };
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "1" });
  const context = canvas.getContext("2d");
  if (!context) return { timeline, revert: () => timeline.kill() };
  const box = target.getBoundingClientRect();
  const ratio = Math.min(1, 1000 / Math.max(1, box.width), 900 / Math.max(1, box.height));
  const width = (canvas.width = Math.max(1, Math.round(box.width * ratio)));
  const height = (canvas.height = Math.max(1, Math.round(box.height * ratio)));
  const fill = paper ?? paperColor(target);
  context.fillStyle = fill;
  context.fillRect(0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const thresholds = brushThresholds(width, height, direction);
  let previous = -1;
  /** Erases the cover where the stroke has reached; 180 steps is finer than the eye can split. */
  const paint = (progress: number) => {
    const step = Math.round(progress * 180);
    if (step === previous) return;
    previous = step;
    for (let i = 0; i < thresholds.length; i++) {
      const ink = progress <= 0 ? 0 : progress >= 1 ? 255 : Math.max(0, Math.min(255, (progress * 280 - thresholds[i]!) * 18));
      pixels.data[i * 4 + 3] = 255 - ink;
    }
    context.putImageData(pixels, 0, 0);
  };
  paint(0);
  target.append(canvas);
  // A setter rather than onUpdate, so a scrubbed or seeked timeline paints too.
  let current = 0;
  const state = {
    get progress() {
      return current;
    },
    set progress(value: number) {
      current = value;
      paint(value);
    },
  };
  timeline.to(state, { progress: 1, duration, ease: "none" }, 0);
  if (roller) {
    const along = direction === "down" ? "y" : "x";
    const span = direction === "down" ? box.height : box.width;
    timeline
      // The roller leads the ink: the brush edge trails a little behind it, as ink trails a brayer.
      .fromTo(roller, { [along]: -span * 0.05, autoAlpha: 1 }, { [along]: span * 1.05, duration: duration * 0.6, ease: "none" }, 0)
      .to(roller, { autoAlpha: 0, duration: 0.3 }, duration * 0.6);
  }
  // Remove the cover once it is fully worn away, so nothing sits over the content at rest.
  timeline.call(() => canvas.remove(), [], duration);
  return {
    timeline,
    revert() {
      timeline.kill();
      canvas.remove();
      if (roller) gsap.set(roller, { clearProps: "transform,opacity,visibility" });
    },
  };
}

/** The first opaque background up the tree, else white. */
function paperColor(element: HTMLElement): string {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;
    if (color && color !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(color)) return color;
  }
  return "#fff";
}

let maskId = 0;

export type InkOptions = { duration?: number; stagger?: number; direction?: StrokeDirection };

export function inkText(targets: HTMLElement[], { duration = 0.9, stagger = 0.12, direction = "right" }: InkOptions = {}): PrintEffect {
  const timeline = gsap.timeline();
  if (prefersReducedMotion() || !targets.length) return { timeline, revert: () => timeline.kill() };
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) return { timeline, revert: () => timeline.kill() };
  const image = context.createImageData(canvas.width, canvas.height);
  brushThresholds(canvas.width, canvas.height, direction).forEach((value, i) => {
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = 255 - value;
    image.data[i * 4 + 3] = 255;
  });
  context.putImageData(image, 0, 0);
  const grain = canvas.toDataURL();
  const svg = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(svg, "svg");
  defs.setAttribute("aria-hidden", "true");
  Object.assign(defs.style, { position: "absolute", width: "0", height: "0", pointerEvents: "none" });
  document.body.append(defs);
  const saved = targets.map((target) => [target.style.getPropertyValue("mask-image"), target.style.getPropertyValue("-webkit-mask-image")] as const);
  const ramps = targets.map((target) => {
    const id = `ink-text-${++maskId}`;
    const mask = document.createElementNS(svg, "mask");
    mask.setAttribute("id", id);
    mask.setAttribute("maskUnits", "objectBoundingBox");
    mask.setAttribute("maskContentUnits", "objectBoundingBox");
    for (const [name, value] of [["x", "0"], ["y", "0"], ["width", "1"], ["height", "1"]]) mask.setAttribute(name, value);
    // Luminance becomes alpha, then a steep ramp turns the grain into a hard, broken edge that GSAP slides.
    mask.innerHTML = `<filter id="${id}-ink" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 0"/><feComponentTransfer><feFuncA type="linear" slope="18" intercept="-18"/></feComponentTransfer></filter><image width="1" height="1" preserveAspectRatio="none" href="${grain}" filter="url(#${id}-ink)"/>`;
    defs.append(mask);
    target.style.setProperty("mask-image", `url(#${id})`);
    target.style.setProperty("-webkit-mask-image", `url(#${id})`);
    return mask.querySelector("feFuncA")!;
  });
  ramps.forEach((ramp, i) => timeline.to(ramp, { attr: { intercept: 1 }, duration, ease: "none" }, i * stagger));
  // At rest the text needs no mask at all.
  timeline.call(() => restore(), [], ">");
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    defs.remove();
    targets.forEach((target, i) => {
      const [mask, webkit] = saved[i]!;
      if (mask) target.style.setProperty("mask-image", mask);
      else target.style.removeProperty("mask-image");
      if (webkit) target.style.setProperty("-webkit-mask-image", webkit);
      else target.style.removeProperty("-webkit-mask-image");
    });
  };
  return {
    timeline,
    revert() {
      timeline.kill();
      restore();
    },
  };
}

export type SlipOptions = {
  /** The second impression's ink. Use a color already in the palette. */
  ink: string;
  /** Starting offset, in pixels. */
  x?: number;
  y?: number;
  duration?: number;
};

export function registrationSlip(heading: HTMLElement, { ink, x = 8, y = 3, duration = 0.5 }: SlipOptions): PrintEffect {
  const timeline = gsap.timeline();
  if (prefersReducedMotion()) return { timeline, revert: () => timeline.kill() };
  const copy = heading.cloneNode(true) as HTMLElement;
  copy.removeAttribute("id");
  copy.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
  copy.setAttribute("aria-hidden", "true");
  const box = heading.getBoundingClientRect();
  const parent = heading.offsetParent instanceof HTMLElement ? heading.offsetParent : document.body;
  const origin = parent.getBoundingClientRect();
  Object.assign(copy.style, {
    position: "absolute",
    left: `${box.left - origin.left + parent.scrollLeft}px`,
    top: `${box.top - origin.top + parent.scrollTop}px`,
    width: `${box.width}px`,
    margin: "0",
    color: ink,
    pointerEvents: "none",
    zIndex: "0",
  });
  const position = heading.style.position;
  const zIndex = heading.style.zIndex;
  // The heading sits above its impression.
  if (getComputedStyle(heading).position === "static") heading.style.position = "relative";
  heading.style.zIndex = "1";
  parent.append(copy);
  timeline
    .fromTo(copy, { x, y }, { x: x / 2, y: -y / 3, duration: duration * 0.5, ease: "power2.out" })
    .to(copy, { x: 0, y: 0, duration: duration * 0.3, ease: "back.out(3)" })
    .call(() => restore());
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    copy.remove();
    heading.style.position = position;
    heading.style.zIndex = zIndex;
  };
  return {
    timeline,
    revert() {
      timeline.kill();
      restore();
    },
  };
}

export type WriteOptions = { duration?: number; ease?: string };

export function writeOn(target: HTMLElement, { duration = 0.55, ease = "power1.inOut" }: WriteOptions = {}): PrintEffect {
  const timeline = gsap.timeline();
  if (prefersReducedMotion()) return { timeline, revert: () => timeline.kill() };
  const style = getComputedStyle(target);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
  const lines = Math.max(1, Math.round(target.getBoundingClientRect().height / lineHeight));
  const svg = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(svg, "svg");
  defs.setAttribute("aria-hidden", "true");
  Object.assign(defs.style, { position: "absolute", width: "0", height: "0", pointerEvents: "none" });
  const id = `write-on-${++maskId}`;
  const band = 1 / lines;
  // A slight rise and fall across each line, and strokes a little wider than the line, so descenders write too.
  const strokes = Array.from({ length: lines }, (_, i) => {
    const y = band * (i + 0.5);
    return `<path d="M-0.02 ${(y + band * 0.04).toFixed(4)}Q0.4 ${(y - band * 0.06).toFixed(4)} 1.02 ${(y + band * 0.02).toFixed(4)}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" fill="none" stroke="white" stroke-linecap="round" stroke-width="${(band * 1.12).toFixed(4)}"/>`;
  }).join("");
  defs.innerHTML = `<defs><mask id="${id}" maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">${strokes}</mask></defs>`;
  document.body.append(defs);
  const saved = [target.style.getPropertyValue("mask"), target.style.getPropertyValue("-webkit-mask")] as const;
  target.style.setProperty("mask", `url(#${id})`);
  target.style.setProperty("-webkit-mask", `url(#${id})`);
  const paths = Array.from(defs.querySelectorAll("path"));
  paths.forEach((path, i) => timeline.to(path, { attr: { "stroke-dashoffset": 0 }, duration: duration / lines + 0.1, ease }, i * (duration / lines)));
  timeline.call(() => restore(), [], ">");
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    defs.remove();
    if (saved[0]) target.style.setProperty("mask", saved[0]);
    else target.style.removeProperty("mask");
    if (saved[1]) target.style.setProperty("-webkit-mask", saved[1]);
    else target.style.removeProperty("-webkit-mask");
  };
  return {
    timeline,
    revert() {
      timeline.kill();
      restore();
    },
  };
}

export type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left";
export type PullOptions = {
  corner?: Corner;
  /** The paper's back. Defaults to a warm off-white. */
  back?: string;
};
export type Pull = {
  /** 0 lies flat; 1 has peeled the whole sheet away. */
  set(progress: number): void;
  progress(): number;
  /** Tweens to a progress. Reduced motion jumps. */
  to(progress: number, vars?: gsap.TweenVars): gsap.core.Tween;
  /** Stops a running tween where it is, such as when a hand takes the corner. */
  stop(): void;
  revert: Teardown;
};

type Point = [number, number];

/** The part of a polygon where x + y <= c, by one Sutherland-Hodgman pass. */
function clipBelow(points: Point[], c: number): Point[] {
  const out: Point[] = [];
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]!;
    const inA = a[0] + a[1] <= c;
    const inB = b[0] + b[1] <= c;
    if (inA) out.push(a);
    if (inA !== inB) {
      const t = (c - a[0] - a[1]) / (b[0] + b[1] - a[0] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  });
  return out;
}

export function pullCorner(sheet: HTMLElement, { corner = "bottom-right", back = "#f4efe6" }: PullOptions = {}): Pull {
  const flap = document.createElement("i");
  flap.setAttribute("aria-hidden", "true");
  const shade = `linear-gradient(${corner.includes("bottom") ? (corner.includes("right") ? "315deg" : "45deg") : corner.includes("right") ? "225deg" : "135deg"}, ${back} 40%, color-mix(in srgb, ${back} 78%, black))`;
  // Three times the sheet's size, centered on it, so a flap folded past the sheet's edges still paints.
  Object.assign(flap.style, { position: "absolute", left: "-100%", top: "-100%", width: "300%", height: "300%", pointerEvents: "none", background: shade, clipPath: "polygon(0 0)", zIndex: "2" });
  const position = sheet.style.position;
  const clip = sheet.style.clipPath;
  if (getComputedStyle(sheet).position === "static") sheet.style.position = "relative";
  // The flap sits in the sheet's parent, so the sheet's own clip does not cut it.
  const host = document.createElement("div");
  Object.assign(host.style, { position: "absolute", pointerEvents: "none" });
  host.setAttribute("aria-hidden", "true");
  host.append(flap);
  sheet.after(host);
  let current = 0;
  let tween: gsap.core.Tween | undefined;
  const flipX = corner.endsWith("left");
  const flipY = corner.startsWith("top");

  const set = (progress: number) => {
    current = Math.max(0, Math.min(1, progress));
    const w = sheet.offsetWidth;
    const h = sheet.offsetHeight;
    Object.assign(host.style, { left: `${sheet.offsetLeft}px`, top: `${sheet.offsetTop}px`, width: `${w}px`, height: `${h}px` });
    // Work as if the corner were bottom right; mirror the axes for the others.
    const map = ([x, y]: Point): Point => [flipX ? w - x : x, flipY ? h - y : y];
    const c = w + h - current * (w + h);
    const rect: Point[] = [[0, 0], [w, 0], [w, h], [0, h]];
    const kept = clipBelow(rect, c).map(map);
    const lifted = clipBelow(rect.map(([x, y]) => [-x, -y] as Point), -c).map(([x, y]) => [-x, -y] as Point);
    // The flap is the lifted part reflected across the fold line x + y = c.
    const folded = lifted.map(([x, y]) => [c - y, c - x] as Point).map(map);
    const polygon = (points: Point[], ox = 0, oy = 0) =>
      points.length ? `polygon(${points.map(([x, y]) => `${(x + ox).toFixed(2)}px ${(y + oy).toFixed(2)}px`).join(",")})` : "polygon(0 0)";
    // Fully peeled, nothing lies flat: an empty clip rather than a polygon of zero area.
    sheet.style.clipPath = current === 0 ? clip : current === 1 ? "polygon(0 0)" : polygon(kept);
    flap.style.clipPath = current === 0 ? "polygon(0 0)" : polygon(folded, w, h);
  };
  set(0);
  return {
    set,
    progress: () => current,
    to(progress, vars = {}) {
      tween?.kill();
      const state = { value: current };
      tween = gsap.to(state, { value: progress, duration: prefersReducedMotion() ? 0 : 0.45, ease: "power2.inOut", ...vars, onUpdate: () => set(state.value) });
      return tween;
    },
    stop: () => tween?.kill(),
    revert() {
      tween?.kill();
      host.remove();
      sheet.style.clipPath = clip;
      sheet.style.position = position;
    },
  };
}

export type DragPullOptions = {
  /** Share of the peel past which a release finishes it. */
  threshold?: number;
  /** Runs once the sheet has been pulled all the way off. */
  onPulled?: () => void;
};

/**
 * A pointer or finger pulls the corner: the fold follows the distance dragged toward the opposite
 * corner. Released past `threshold`, the sheet peels off; short of it, it springs flat. Keyboard: Enter
 * or Space on the sheet pulls it off, so give the sheet `tabindex="0"` and a label saying so.
 */
export function dragPull(sheet: HTMLElement, pull: Pull, { threshold = 0.35, onPulled }: DragPullOptions = {}): Teardown {
  const aborter = new AbortController();
  const on = { signal: aborter.signal };
  const touchAction = sheet.style.touchAction;
  sheet.style.touchAction = "none";
  let start: { x: number; y: number; id: number } | undefined;
  const finish = () =>
    pull.to(1, { duration: 0.6, ease: "power2.in" }).eventCallback("onComplete", () => onPulled?.());
  sheet.addEventListener("pointerdown", (event) => {
    // The hand takes over from any spring back or peel still running.
    pull.stop();
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    sheet.setPointerCapture(event.pointerId);
  }, on);
  sheet.addEventListener("pointermove", (event) => {
    if (!start || event.pointerId !== start.id) return;
    const span = sheet.offsetWidth + sheet.offsetHeight;
    // Distance dragged along the diagonal, toward the sheet's middle from whichever corner is pulled.
    const dx = start.x - event.clientX;
    const dy = start.y - event.clientY;
    pull.set(Math.max(0, (Math.abs(dx) + Math.abs(dy)) / span));
  }, on);
  const release = (event: PointerEvent) => {
    if (!start || event.pointerId !== start.id) return;
    start = undefined;
    if (pull.progress() >= threshold) finish();
    else pull.to(0, { duration: 0.5, ease: "power3.out" });
  };
  sheet.addEventListener("pointerup", release, on);
  sheet.addEventListener("pointercancel", release, on);
  sheet.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    finish();
  }, on);
  return () => {
    aborter.abort();
    sheet.style.touchAction = touchAction;
  };
}

