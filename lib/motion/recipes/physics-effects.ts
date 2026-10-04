// Copied from the animaxxing skill: references/recipes/physics-effects.md. Edit in place; see the recipe for the contract.
import gsap from "gsap";
import { Physics2DPlugin } from "gsap/Physics2DPlugin";

gsap.registerPlugin(Physics2DPlugin);

/* Swap for the project's helper if it has one. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Pieces alive at once across every run; coarse pointers get half. Runs past the cap spawn fewer. */
const MAX_LIVE = 120;
let live = 0;

function budget(): number {
  const cap = window.matchMedia("(pointer: coarse)").matches ? MAX_LIVE / 2 : MAX_LIVE;
  return Math.max(0, cap - live);
}

/** A piece to throw: text such as an emoji, or an element to copy. */
export type Piece = string | HTMLElement;

export type PhysicsOptions = {
  pieces: Piece[];
  count?: number;
  /** Launch speed range in px/s. */
  velocity?: [number, number];
  /** Downward pull in px/s². */
  gravity?: number;
  /** Most spin in degrees over a piece's flight, either way. */
  spin?: number;
  /** Scale range, for depth. */
  scale?: [number, number];
};

export type PhysicsRun = {
  /** Removes every piece at once. Safe to call twice or after the run ends. */
  stop(): void;
  /** Resolves when the last piece is gone, by landing or by `stop`. */
  finished: Promise<void>;
};

const idle = (): PhysicsRun => ({ stop: () => {}, finished: Promise.resolve() });
const rnd = gsap.utils.random;

/** Builds `count` pieces within the budget; copies lose ids and stay hidden from assistive technology. */
function spawn(layer: HTMLElement, pieces: Piece[], count: number): HTMLElement[] {
  const total = Math.min(count, budget());
  const made: HTMLElement[] = [];
  for (let i = 0; i < total; i++) {
    const source = pieces[i % pieces.length]!;
    let piece: HTMLElement;
    if (typeof source === "string") {
      piece = document.createElement("span");
      piece.textContent = source;
    } else {
      piece = source.cloneNode(true) as HTMLElement;
      piece.removeAttribute("id");
      piece.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    }
    piece.setAttribute("aria-hidden", "true");
    made.push(piece);
  }
  layer.append(...made);
  live += made.length;
  return made;
}

/** Runs one timeline over the spawned pieces and removes them when it ends or stops. */
function run(pieces: HTMLElement[], build: (tl: gsap.core.Timeline) => void): PhysicsRun {
  let resolve = () => {};
  const finished = new Promise<void>((done) => (resolve = done));
  let done = false;
  let tl: gsap.core.Timeline | undefined;
  const stop = () => {
    if (done) return;
    done = true;
    tl?.kill();
    pieces.forEach((piece) => piece.remove());
    live -= pieces.length;
    resolve();
  };
  try {
    tl = gsap.timeline({ onComplete: stop });
    build(tl);
  } catch (error) {
    stop();
    throw error;
  }
  return { stop, finished };
}

export type BurstOptions = PhysicsOptions & {
  /** Direction of the cone's center in degrees: -90 is straight up, 0 is right. */
  angle?: number;
  /** Width of the cone in degrees. */
  spread?: number;
  /** Seconds each piece flies before it is gone. */
  duration?: number;
};

export function burst(
  layer: HTMLElement,
  x: number,
  y: number,
  {
    pieces,
    count = 24,
    velocity = [500, 900],
    gravity = 1200,
    spin = 540,
    scale = [0.7, 1.3],
    angle = -90,
    spread = 70,
    duration = 1.4,
  }: BurstOptions,
): PhysicsRun {
  if (prefersReducedMotion() || !pieces.length) return idle();
  const made = spawn(layer, pieces, count);
  if (!made.length) return idle();
  return run(made, (tl) => {
    made.forEach((piece) => {
      gsap.set(piece, { x, y, xPercent: -50, yPercent: -50, scale: rnd(scale[0], scale[1]), rotation: rnd(-30, 30) });
      const delay = rnd(0, 0.06);
      const flight = duration * rnd(0.8, 1);
      tl.to(
        piece,
        {
          physics2D: { velocity: rnd(velocity[0], velocity[1]), angle: angle + rnd(-spread / 2, spread / 2), gravity },
          rotation: `+=${rnd(-spin, spin)}`,
          duration: flight,
          ease: "none",
        },
        delay,
      );
      // Fade over the last third, so pieces that stay on screen still leave.
      tl.to(piece, { autoAlpha: 0, duration: flight / 3, ease: "power1.in" }, delay + (flight * 2) / 3);
    });
  });
}

export function burstFrom(layer: HTMLElement, element: Element, options: BurstOptions): PhysicsRun {
  const box = element.getBoundingClientRect();
  return burst(layer, box.left + box.width / 2, box.top + box.height / 2, options);
}

export type RainOptions = PhysicsOptions & {
  /** Seconds over which pieces start falling. */
  period?: number;
  /** Most sideways drift from straight down, in degrees. */
  sway?: number;
};

export function rain(
  layer: HTMLElement,
  {
    pieces,
    count = 40,
    velocity = [80, 240],
    gravity = 900,
    spin = 120,
    scale = [0.6, 1.2],
    period = 1.2,
    sway = 8,
  }: RainOptions,
): PhysicsRun {
  if (prefersReducedMotion() || !pieces.length) return idle();
  const made = spawn(layer, pieces, count);
  if (!made.length) return idle();
  const width = layer.clientWidth;
  const height = layer.clientHeight;
  return run(made, (tl) => {
    made.forEach((piece) => {
      const size = Math.max(piece.offsetHeight, 1);
      gsap.set(piece, { x: rnd(0, width), y: -size, xPercent: -50, scale: rnd(scale[0], scale[1]), rotation: rnd(-30, 30) });
      const v = rnd(velocity[0], velocity[1]);
      // Time to fall from above the top edge to below the bottom: y = vt + gt²/2.
      const fall = height + size * 2;
      const flight = (-v + Math.sqrt(v * v + 2 * gravity * fall)) / gravity;
      tl.to(
        piece,
        {
          physics2D: { velocity: v, angle: 90 + rnd(-sway, sway), gravity },
          rotation: `+=${rnd(-spin, spin)}`,
          duration: flight,
          ease: "none",
        },
        rnd(0, period),
      );
    });
  });
}
