# Recipe: sound cues

Short sounds tied to motion: a tick as a label rolls, a whoosh as a curtain covers, a low bed under a hero. Sound is off until the visitor turns it on, never carries meaning alone, and stops when the tab hides. Web Audio plays each cue with no delay, a small random pitch spread so repeats never sound identical, and a cap on how many play at once.

Lifecycle: the framework controller builds the cues once per document, like smooth scroll, and calls `revert` when the document goes away. The app owns the sound toggle, its `aria-pressed`, and any stored preference. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`. Howler or another engine can replace the Web Audio calls behind the same shape.

Rules:

- Off by default. Call `setEnabled(true)` from the toggle's click handler: browsers allow audio only after a user gesture. With a stored "on" preference, the first press or key anywhere unlocks it.
- A cue that is not loaded yet is dropped, never played late.
- Keep cues under half a second, quieter than speech, and in a compressed format such as `.webm` with an `.mp3` fallback chosen by the app.
- Beds (`ambient`) loop, so the toggle is their pause control ([WCAG 1.4.2](https://www.w3.org/WAI/WCAG22/Understanding/audio-control)).
- Sound follows its own toggle, not reduced motion. Under reduced motion timelines finish at once, so their cues arrive together; `voices` and `gap` cap that.

```ts
import gsap from "gsap";

export type SoundCuesOptions = {
  /** Cue name to file URL. */
  sources: Record<string, string>;
  /** Master volume, 0 to 1. */
  volume?: number;
  /** Starts on, such as from a stored preference. Audio still waits for a gesture. */
  enabled?: boolean;
  /** Seconds before the same cue can sound again. */
  gap?: number;
  /** Most one-shot cues sounding at once. */
  voices?: number;
  /** Random pitch spread in cents on each play. */
  vary?: number;
};

export type PlayOptions = { volume?: number; rate?: number };

export type SoundCues = {
  play(name: string, options?: PlayOptions): void;
  /** Adds a call that plays the cue when a forward-moving timeline passes `position`. */
  cue(timeline: gsap.core.Timeline, name: string, position?: gsap.Position, options?: PlayOptions): gsap.core.Timeline;
  /** Loops a bed that fades in whenever sound is on; the returned stop fades it out. */
  ambient(name: string, options?: { volume?: number; fade?: number }): () => void;
  /** Call from the toggle's click handler. */
  setEnabled(on: boolean): void;
  enabled(): boolean;
  revert(): void;
};

type Bed = { volume: number; fade: number; gain?: GainNode; source?: AudioBufferSourceNode };

/** Seconds the master volume takes to fade on toggle. */
const TOGGLE_FADE = 0.15;

export function soundCues({ sources, volume = 0.5, enabled = false, gap = 0.06, voices = 4, vary = 40 }: SoundCuesOptions): SoundCues {
  let on = enabled;
  let done = false;
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let suspendTimer: ReturnType<typeof setTimeout> | undefined;
  const loads = new AbortController();
  const ready = new Map<string, AudioBuffer>();
  const lastPlayed = new Map<string, number>();
  const live = new Set<AudioBufferSourceNode>();
  const beds = new Map<string, Bed>();
  const listeners: Array<() => void> = [];

  const listen = (target: EventTarget, type: string, handler: () => void, options?: AddEventListenerOptions) => {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  };

  const running = () => on && !done && context?.state === "running";

  const startBed = (name: string, bed: Bed) => {
    const buffer = ready.get(name);
    if (!context || !master || !buffer || bed.source) return;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(bed.volume, context.currentTime + bed.fade);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain).connect(master);
    source.start();
    Object.assign(bed, { gain, source });
  };

  const fadeOut = (bed: Bed) => {
    const { gain, source } = bed;
    if (!context || !gain || !source) return;
    const end = context.currentTime + bed.fade;
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
    gain.gain.linearRampToValueAtTime(0, end);
    source.stop(end);
    source.onended = () => gain.disconnect();
    bed.gain = bed.source = undefined;
  };

  /** Creates or resumes the context. Only a user gesture lets it run. */
  const unlock = () => {
    if (done || !on) return;
    clearTimeout(suspendTimer);
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      const ctx = context;
      for (const [name, url] of Object.entries(sources)) {
        fetch(url, { signal: loads.signal })
          .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(url))))
          .then((data) => ctx.decodeAudioData(data))
          .then((buffer) => {
            if (done) return;
            ready.set(name, buffer);
            const bed = beds.get(name);
            if (bed && on) startBed(name, bed);
          })
          // A missing or undecodable file leaves that cue silent.
          .catch(() => {});
      }
    }
    void context.resume();
    master!.gain.cancelScheduledValues(context.currentTime);
    master!.gain.setValueAtTime(master!.gain.value, context.currentTime);
    master!.gain.linearRampToValueAtTime(volume, context.currentTime + TOGGLE_FADE);
    beds.forEach((bed, name) => startBed(name, bed));
  };

  const silence = () => {
    if (!context || !master) return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(master.gain.value, context.currentTime);
    master.gain.linearRampToValueAtTime(0, context.currentTime + TOGGLE_FADE);
    const ctx = context;
    suspendTimer = setTimeout(() => void ctx.suspend(), TOGGLE_FADE * 1000 + 50);
  };

  const play = (name: string, { volume: level = 1, rate = 1 }: PlayOptions = {}) => {
    const buffer = ready.get(name);
    if (!running() || !buffer || live.size >= voices) return;
    const now = performance.now() / 1000;
    if (now - (lastPlayed.get(name) ?? -Infinity) < gap) return;
    lastPlayed.set(name, now);
    const gain = context!.createGain();
    gain.gain.value = level;
    const source = context!.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.detune.value = gsap.utils.random(-vary, vary);
    source.connect(gain).connect(master!);
    source.onended = () => {
      live.delete(source);
      gain.disconnect();
    };
    live.add(source);
    source.start();
  };

  if (typeof window !== "undefined") {
    // A stored "on" preference unlocks on the first gesture anywhere.
    const firstGesture = () => {
      if (context?.state !== "running") unlock();
    };
    // Touch grants activation on pointerup, not pointerdown.
    listen(window, "pointerdown", firstGesture, { capture: true });
    listen(window, "pointerup", firstGesture, { capture: true });
    listen(window, "keydown", firstGesture, { capture: true });
    // Silent while the tab is hidden; resumes when it returns if still on.
    listen(document, "visibilitychange", () => {
      if (!context) return;
      if (document.hidden) void context.suspend();
      else if (on) void context.resume();
    });
  }

  return {
    play,
    cue(timeline, name, position, options) {
      // Scrubbing back or reversing passes the call too; only forward play sounds.
      return timeline.call(
        () => {
          if (!timeline.reversed()) play(name, options);
        },
        undefined,
        position,
      );
    },
    ambient(name, { volume: level = 0.3, fade = 1.5 } = {}) {
      if (done) return () => {};
      const bed: Bed = { volume: level, fade };
      const previous = beds.get(name);
      if (previous) fadeOut(previous);
      beds.set(name, bed);
      if (on && context) startBed(name, bed);
      return () => {
        if (beds.get(name) !== bed) return;
        beds.delete(name);
        fadeOut(bed);
      };
    },
    setEnabled(next) {
      if (done || next === on) return;
      on = next;
      if (on) unlock();
      else silence();
    },
    enabled: () => on,
    revert() {
      if (done) return;
      done = true;
      clearTimeout(suspendTimer);
      listeners.splice(0).forEach((remove) => remove());
      loads.abort();
      live.forEach((source) => source.stop());
      live.clear();
      beds.clear();
      void context?.close();
      context = master = undefined;
    },
  };
}
```

`cue` works on played timelines, such as a curtain or a menu open. A scrubbed timeline is never reversed, so dragging it back would sound again; cue a scroll trigger's `onEnter` instead. `revert` stops every sound at once and closes the context; it never changes the toggle or stored preference.

## Wiring

```ts
// Example: a toggle, a menu open, and a hover tick.
const sound = soundCues({ sources: { tick: "/sfx/tick.webm", whoosh: "/sfx/whoosh.webm", bed: "/sfx/bed.webm" } });
toggle.addEventListener("click", () => {
  sound.setEnabled(!sound.enabled());
  toggle.setAttribute("aria-pressed", String(sound.enabled()));
});
sound.ambient("bed");
menuButton.addEventListener("click", () => sound.cue(menu.open(), "whoosh", 0));
links.forEach((link) => link.addEventListener("pointerenter", () => sound.play("tick", { volume: 0.4 })));
```

## Controller contract

| Phase | Call |
|---|---|
| initial state | None: the page is silent until the visitor opts in. |
| intro | `soundCues(...)` once per document; `cue(timeline, ...)` on any played entrance. |
| settled | `play` from interactions; `ambient` for a bed. |
| outro | `cue` on the exit timeline; stop page-specific beds. |
| unmount | `revert()` when the document goes away; route changes keep the instance. |
