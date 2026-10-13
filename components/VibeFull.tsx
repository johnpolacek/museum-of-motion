"use client";

// A vibe in its own tab. The same builder the exhibit's stage uses mounts the page in a window that
// fills the viewport, so nothing about the vibe changes but its size.
import { useEffect, useRef } from "react";
import { createLoop, STAGES } from "@/lib/motion/stage";

export function VibeFull({ slug, name }: { slug: string; name: string }) {
  const text = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = text.current;
    const def = STAGES[slug];
    if (!el || !def) return;
    const build = () => createLoop(slug, el, def.defaults(def.variations[0]!));
    let built = build();
    // Width changes re-measure the page's lines by rebuilding, as the exhibit's stage does.
    let width = window.innerWidth;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(() => {
        built?.destroy();
        built = build();
      }, 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
      built?.destroy();
    };
  }, [slug]);

  return (
    <main className="ex blue vibe-full">
      <div className="stage">
        {/* The builder mounts the page in this stage. The heading names it for assistive tech. */}
        <h1 ref={text}>{name}, a vibe from the Museum of Motion</h1>
        <noscript>
          <p>
            This page needs JavaScript. <a href={`/exhibits/${slug}`}>Back to the exhibit</a>
          </p>
        </noscript>
      </div>
    </main>
  );
}
