// The site keeps its own scroll positions, one per page, for this tab. The browser's own restoration
// runs at popstate, while the old page is still on screen, so it clamps to the wrong page's height;
// ScrollTrigger, re-measuring after a route change, would put back a position remembered from another
// page. Here a page's position is put back only once that page is drawn.
import { ScrollTrigger } from "./gsap";

const KEY = "mom:scroll";

let positions: Record<string, number> = {};
let pending: "history" | "reload" | null = null;
/** The page on screen. A popstate that keeps it, such as a hash on this page, is not a move between pages. */
let shown = "";

/** The element the address's hash names on this page, if any. A hash that names nothing is only state. */
const hashTarget = () => {
  const id = window.location.hash.slice(1);
  try {
    return id ? document.getElementById(decodeURIComponent(id)) : null;
  } catch {
    return null;
  }
};

const read = () => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
};
const write = () => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(positions));
  } catch {
    // Private windows may refuse storage; the memory still lasts the visit.
  }
};

/** Takes over restoration and starts recording. Returns the teardown. */
export function startScrollMemory(): () => void {
  positions = read();
  shown = window.location.pathname;
  window.history.scrollRestoration = "manual";
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type === "reload" || nav?.type === "back_forward") pending = "reload";
  let frame = 0;
  // The page the scroll happened on, read at the event: by the next frame a history move may have
  // changed the address while the old page is still on screen.
  let page = window.location.pathname;
  const onScroll = () => {
    if (pending) return;
    page = window.location.pathname;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      // Between a history move and the new page drawing, the old page is on screen: nothing to record.
      if (pending) return;
      positions[page] = Math.round(window.scrollY);
      write();
    });
  };
  const onPop = () => {
    // Same page, so no new page will be drawn to settle on: the move would stay pending and misfire later.
    if (window.location.pathname === shown) return;
    pending = "history";
    // Any re-measure from here on must not put back the page being left.
    ScrollTrigger.clearScrollMemory("manual");
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("popstate", onPop);
  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("popstate", onPop);
    cancelAnimationFrame(frame);
    window.history.scrollRestoration = "auto";
  };
}

/**
 * The page for `pathname` is drawn. After Back, Forward, or a reload it returns to where it was left;
 * after a link it stays where the router put it, the top or the link's target.
 */
export function settleScroll(pathname: string): void {
  shown = pathname;
  if (!pending) return;
  pending = null;
  // A hash being followed wins: the landing scrolls to it.
  if (hashTarget()) return;
  const y = positions[pathname] ?? 0;
  window.scrollTo(0, y);
  // ScrollTrigger records the scroll when the new page's motion is set up, before this runs, and puts
  // that back after each re-measure. Each re-measure for the next moment is followed by this page's
  // own position, until the visitor scrolls.
  const again = () => window.scrollTo(0, y);
  const stop = () => {
    ScrollTrigger.removeEventListener("refresh", again);
    for (const type of ["wheel", "touchstart", "keydown", "pointerdown"]) window.removeEventListener(type, stop);
    clearTimeout(timer);
  };
  ScrollTrigger.addEventListener("refresh", again);
  for (const type of ["wheel", "touchstart", "keydown", "pointerdown"]) window.addEventListener(type, stop, { once: true, passive: true });
  const timer = setTimeout(stop, 2000);
}

/**
 * A link has put a new page on screen: it starts at the top. The router scrolls only when the new
 * page's top edge is out of view, so a page left a few pixels down, or a short page in a tall window,
 * would keep the old offset. Call it in the layout phase, before paint and before any intro measures.
 */
export function startAtTop(): void {
  // Back and Forward return to where the page was left, and a hash scrolls to what it names.
  if (pending || hashTarget()) return;
  if (window.scrollY) window.scrollTo(0, 0);
}
