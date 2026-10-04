// First-paint gate. The inline script marks <html> pending before content paints and arms a deadline.
// Owners (masthead, hero) claim their first visit, register a rollback, and hand off once their intro runs.
// An owner still pending at the deadline is rolled back to readable settled content.

export const BOOT_DEADLINE = 1500;

export const BOOT_SCRIPT = `(function(){try{
var d=document.documentElement;
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
var b=window.__motionBoot={owners:{},claimed:{},done:{},expired:false,path:location.pathname};
setTimeout(function(){
b.expired=true;var hit=false;
for(var k in b.owners){hit=true;try{b.owners[k]()}catch(e){}}
b.owners={};
d.setAttribute('data-motion-boot',hit?'recovered':'done');
},${BOOT_DEADLINE});
d.setAttribute('data-motion-boot','pending');
}catch(e){}})();`;

type Boot = {
  /** The pathname the document loaded on. Owners first seen on any other path came by client navigation. */
  path: string;
  owners: Record<string, () => void>;
  claimed: Record<string, true>;
  done: Record<string, true>;
  expired: boolean;
};

const boot = (): Boot | undefined => (window as unknown as { __motionBoot?: Boot }).__motionBoot;

/**
 * Decides one visit for an owner. Its first claim on the document's first page is the boot visit:
 * after the deadline it settles without motion. Later claims, and any claim on a page reached by
 * client navigation, animate. Call once per visit (keep the answer in a ref) so repeated setup does not re-decide.
 */
export function claimVisit(owner: string): "animate" | "settle" {
  const b = boot();
  if (!b || b.claimed[owner] || window.location.pathname !== b.path) return "animate";
  b.claimed[owner] = true;
  return b.expired ? "settle" : "animate";
}

/** Registers this setup's rollback while the boot deadline still covers the owner. */
export function armRecovery(owner: string, rollback: () => void): void {
  const b = boot();
  if (!b || b.expired || b.done[owner]) return;
  b.owners[owner] = rollback;
}

/** The intro is running with its handlers attached: the deadline no longer applies. */
export function handOff(owner: string): void {
  const b = boot();
  if (!b) return;
  delete b.owners[owner];
  b.done[owner] = true;
}

/** Setup is being torn down; its rollback is stale. */
export function disarm(owner: string): void {
  const b = boot();
  if (b) delete b.owners[owner];
}
