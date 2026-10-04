// Cross-owner cues. The hero tells the masthead when its wordmark may perform.
const WORDMARK_CUE = "motion:wordmark-cue";

type CueWindow = { __wordmarkCued?: boolean };

export function cueWordmark(): void {
  const w = window as unknown as CueWindow;
  if (w.__wordmarkCued) return;
  w.__wordmarkCued = true;
  document.dispatchEvent(new Event(WORDMARK_CUE));
}

/** Resolves on the cue, or after `ms` if it never comes. */
export function wordmarkCue(ms: number): Promise<void> {
  if ((window as unknown as CueWindow).__wordmarkCued) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      document.removeEventListener(WORDMARK_CUE, done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, ms);
    document.addEventListener(WORDMARK_CUE, done);
  });
}
