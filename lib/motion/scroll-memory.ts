// The site keeps its own scroll positions, one per page, for this tab. The browser's own restoration
// runs at popstate, while the old page is still on screen, so it clamps to the wrong page's height;
// ScrollTrigger, re-measuring after a route change, would put back a position remembered from another
// page. Here a page's position is put back only once that page is drawn.
import { ScrollTrigger } from "./gsap";

const KEY = "mom:scroll";

let positions: Record<string, number> = {};
let pending: "history" | "reload" | null = null;

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
  if (!pending) return;
  pending = null;
  // A hash being followed wins: the landing scrolls to it.
  if (window.location.hash) return;
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
