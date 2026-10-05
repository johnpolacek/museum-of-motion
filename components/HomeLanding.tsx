"use client";

// Arriving on the home page with "#collection", from a shared link or the Collection link elsewhere:
// the page is already at the collection, so the hash has done its job. It is cleared, so a reload or
// Back restores the spot the visitor is actually at.
import { useEffect } from "react";
import { clearHash, collectionTargets, COLLECTION } from "@/lib/motion/home-nav";

export function HomeLanding() {
  // Typed or pasted onto this page, the hash only scrolls: the browser has done the job, so it is cleared.
  useEffect(() => {
    const onHash = () => window.location.hash === `#${COLLECTION}` && clearHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (window.location.hash !== `#${COLLECTION}`) return;
    const { section, heading } = collectionTargets();
    if (section && Math.abs(section.getBoundingClientRect().top) > 2) window.scrollTo(0, section.getBoundingClientRect().top + window.scrollY);
    // Reached from another page by the Collection link: focus follows, as it does for a glide on this page.
    // A fresh load of the link leaves focus to the browser.
    const loaded = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (heading && loaded && new URL(loaded.name).pathname !== "/") {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
    // A frame later: on a fresh load the router writes the address it loaded with once it mounts, after this.
    const frame = requestAnimationFrame(clearHash);
    return () => cancelAnimationFrame(frame);
  }, []);
  return null;
}
