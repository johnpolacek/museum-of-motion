// Cross-owner cues. The hero announces when it settles so the masthead can perform last.
export const HERO_SETTLED = "motion:hero-settled";

export function announceHeroSettled(): void {
  (window as unknown as { __heroSettled?: boolean }).__heroSettled = true;
  document.dispatchEvent(new Event(HERO_SETTLED));
}

/** Resolves when the hero has settled, or after `ms` if it never does. */
export function heroSettled(ms: number): Promise<void> {
  if ((window as unknown as { __heroSettled?: boolean }).__heroSettled) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      document.removeEventListener(HERO_SETTLED, done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, ms);
    document.addEventListener(HERO_SETTLED, done);
  });
}
