"use client";

// Route transition controller. Each owner on the page registers an outro. A transition-aware link
// cancels its navigation, waits for every outro to reach its end state, then pushes.
// Back and forward never run an outro: they arrive through the router as usual.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ScrollTrigger } from "@/lib/motion/gsap";
import type { SharedState } from "@/lib/motion/shared";

/** Where the navigation came from: the destination, and the link element clicked, if any. */
export type OutroContext = { href: string; source: Element | null };

/** Plays one part of the page's outro. Returns null when it has nothing on screen to move. */
export type Outro = (context: OutroContext) => Promise<void> | null;

type NavigateEvent = { preventDefault: () => void };
type NavigateOptions = { replace?: boolean; scroll?: boolean; source?: Element | null };

type Controller = {
  registerOutro: (outro: Outro) => () => void;
  navigate: (e: NavigateEvent, href: string, options: NavigateOptions) => void;
  /** Shared-element handoff, keyed by destination pathname. Reading never consumes it. */
  setShared: (pathname: string, state: SharedState) => void;
  peekShared: (pathname: string) => SharedState | null;
  clearShared: () => void;
};

const TransitionContext = createContext<Controller | null>(null);

/** Upper bound on an outro. A stalled timeline never strands a click. */
const OUTRO_WATCHDOG = 1500;
/** Upper bound on the lock. A push that never commits releases it. */
const LOCK_WATCHDOG = 5000;

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Every owner on the page registers its own outro: hero, collection. They play together.
  const outros = useRef(new Set<Outro>());
  const token = useRef(0);
  const locked = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const shared = useRef<{ pathname: string; state: SharedState } | null>(null);

  // A new route is showing: release the lock and invalidate any pending push (back or forward mid-outro).
  useEffect(() => {
    token.current++;
    locked.current = false;
    clearTimeout(lockTimer.current);
    // A handoff only survives into the page it was made for. A history move elsewhere drops it.
    if (shared.current && shared.current.pathname !== pathname) shared.current = null;
    // Persistent owners such as the footer keep their triggers across pages: remeasure for the new page.
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  const registerOutro = useCallback((fn: Outro) => {
    outros.current.add(fn);
    return () => {
      outros.current.delete(fn);
    };
  }, []);

  const navigate = useCallback(
    (e: NavigateEvent, href: string, { replace, scroll, source = null }: NavigateOptions) => {
      // One navigation at a time. The first accepted destination wins.
      if (locked.current) {
        e.preventDefault();
        return;
      }
      const url = new URL(href, window.location.href);
      // Same page, or a hash on this page: leave native.
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      // A new navigation replaces any earlier handoff.
      shared.current = null;
      const runs = [...outros.current].map((fn) => fn({ href, source })).filter((run) => run !== null);
      if (!runs.length) return;
      const run = Promise.all(runs);
      e.preventDefault();
      locked.current = true;
      const mine = ++token.current;
      lockTimer.current = setTimeout(() => {
        if (token.current === mine) locked.current = false;
      }, LOCK_WATCHDOG);

      const watchdog = new Promise<void>((resolve) => setTimeout(resolve, OUTRO_WATCHDOG));
      Promise.race([run, watchdog]).then(() => {
        if (token.current !== mine) return;
        const target = url.pathname + url.search + url.hash;
        if (replace) router.replace(target, { scroll });
        else router.push(target, { scroll });
      });
    },
    [router],
  );

  const setShared = useCallback((path: string, state: SharedState) => {
    shared.current = { pathname: normalize(path), state };
  }, []);
  const peekShared = useCallback(
    (path: string) => (shared.current?.pathname === normalize(path) ? shared.current.state : null),
    [],
  );
  const clearShared = useCallback(() => {
    shared.current = null;
  }, []);

  const value = useMemo(
    () => ({ registerOutro, navigate, setShared, peekShared, clearShared }),
    [registerOutro, navigate, setShared, peekShared, clearShared],
  );
  return <TransitionContext.Provider value={value}>{children}</TransitionContext.Provider>;
}

const normalize = (path: string) => new URL(path, "http://x").pathname.replace(/\/+$/, "") || "/";

export function useTransitionController(): Controller {
  const value = useContext(TransitionContext);
  if (!value) throw new Error("useTransitionController needs a TransitionProvider");
  return value;
}
