// Cross-owner cues. The hero tells the masthead when its wordmark may perform,
// and the masthead tells the hero when it has finished.
const WORDMARK_CUE = "motion:wordmark-cue";
const WORDMARK_DONE = "motion:wordmark-done";

type CueWindow = { __wordmarkCued?: boolean; __wordmarkDone?: boolean };

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

export function markWordmarkDone(): void {
  const w = window as unknown as CueWindow;
  if (w.__wordmarkDone) return;
  w.__wordmarkDone = true;
  document.dispatchEvent(new Event(WORDMARK_DONE));
}

/** Resolves once the wordmark has finished or settled, or after `ms` if it never says so. */
export function wordmarkDone(ms: number): Promise<void> {
  if ((window as unknown as CueWindow).__wordmarkDone) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      document.removeEventListener(WORDMARK_DONE, done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, ms);
    document.addEventListener(WORDMARK_DONE, done);
  });
}
