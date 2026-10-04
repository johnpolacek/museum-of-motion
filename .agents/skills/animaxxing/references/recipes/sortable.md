# Recipe: sortable

A vertical list the visitor reorders by dragging a handle. The held item lifts and follows the pointer, the other items slide aside to open its slot, and on release it settles into place. The keyboard does the same from the handle: Space or Enter picks the item up, the arrow keys move it, Space or Enter drops it, and Escape puts it back. A live region announces each step. The app hears the new order and owns it; the builder only moves the DOM nodes and animates the move.

Lifecycle: the framework controller builds it once the list is mounted and calls `revert` on unmount. Rebuild after the app adds or removes items. Partial setup rolls back per [effect restoration](../effect-restoration.md).

Dependencies: `gsap`, `gsap/Draggable`.

```html
<p id="sort-help" hidden>Press Space to pick up, arrow keys to move, Space to drop, Escape to cancel.</p>
<ul class="tasks" aria-label="Tasks">
  <li data-sortable-item>
    <button type="button" data-sortable-handle aria-describedby="sort-help">Move</button>
    <span data-sortable-name>Write the brief</span>
  </li>
  …
</ul>
```

```css
/* The handle claims touch drags; the rest of the item still scrolls the page. */
[data-sortable-handle] { touch-action: none; cursor: grab; }
[data-sortable-item] { position: relative; }
```

```ts
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";

gsap.registerPlugin(Draggable);

/* Swap for the project's helper if it has one. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type SortableOptions = {
  /** Called after every completed move, with the items in their new order. */
  onReorder?: (items: HTMLElement[], from: number, to: number) => void;
  /** Scale of the held item. */
  lift?: number;
};
export type Sortable = { order: () => HTMLElement[]; revert: () => void };

/** Visually hidden, still read by assistive technology. */
const VISUALLY_HIDDEN = { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" };
const SLIDE = { duration: 0.2, ease: "power2.out" } as const;
const SETTLE = { duration: 0.3, ease: "back.out(1.4)" } as const;

export function sortable(list: HTMLElement, { onReorder, lift = 1.03 }: SortableOptions = {}): Sortable {
  const reduced = prefersReducedMotion();
  const items = () => Array.from(list.querySelectorAll<HTMLElement>(":scope > [data-sortable-item]"));
  const nameOf = (item: HTMLElement) => (item.querySelector("[data-sortable-name]")?.textContent ?? item.textContent ?? "").trim();
  const handleOf = (item: HTMLElement) => item.querySelector<HTMLElement>("[data-sortable-handle]");
  const draggables: Draggable[] = [];
  const cleanups: Array<() => void> = [];
  const status = document.createElement("div");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "assertive");
  Object.assign(status.style, VISUALLY_HIDDEN);
  const say = (text: string) => {
    status.textContent = text;
  };
  const restoreAll = () => {
    cleanups.splice(0).reverse().forEach((fn) => fn());
  };

  try {
    list.after(status);
    cleanups.push(() => status.remove());
    for (const item of items()) {
      const handle = handleOf(item);
      if (!handle) continue;
      // Exact restore: the item's and handle's style attributes and the handle's pressed state.
      const itemStyle = item.getAttribute("style");
      const handleStyle = handle.getAttribute("style");
      const pressed = handle.getAttribute("aria-pressed");
      cleanups.push(() => {
        gsap.killTweensOf(item);
        gsap.set(item, { clearProps: "transform,translate,scale,zIndex" });
        for (const [element, value] of [[item, itemStyle], [handle, handleStyle]] as const) {
          // Read first: Chrome can write a just-cleared inline style back as style="" after a removal.
          void element.getAttribute("style");
          if (value === null) element.removeAttribute("style");
          else element.setAttribute("style", value);
        }
        if (pressed === null) handle.removeAttribute("aria-pressed");
        else handle.setAttribute("aria-pressed", pressed);
      });
    }

    /** True while the builder itself moves a node: moving a focused node fires focusout, which is not the user leaving. */
    let moving = false;
    /** Moves `item` to `to` in the DOM, animating every item that changes place from where it was. */
    const move = (item: HTMLElement, to: number) => {
      const before = items();
      const from = before.indexOf(item);
      if (from === to || to < 0 || to >= before.length) return false;
      const tops = new Map(before.map((element) => [element, element.getBoundingClientRect().top]));
      const reference = to > from ? before[to]!.nextElementSibling : before[to]!;
      moving = true;
      list.insertBefore(item, reference);
      moving = false;
      for (const element of items()) {
        const shift = tops.get(element)! - element.getBoundingClientRect().top;
        if (shift) gsap.fromTo(element, { y: shift }, { y: 0, ...(reduced ? { duration: 0 } : SLIDE), overwrite: "auto" });
      }
      onReorder?.(items(), from, to);
      return true;
    };

    // Pointer: drag the handle. Others slide aside as the held item crosses their middles; the DOM moves on release.
    for (const item of items()) {
      const handle = handleOf(item);
      if (!handle) continue;
      let from = 0;
      let target = 0;
      let rects: DOMRect[] = [];
      let slot = 0;
      const [drag] = Draggable.create(item, {
        type: "y",
        trigger: handle,
        bounds: list,
        zIndexBoost: true,
        onPress() {
          const all = items();
          from = target = all.indexOf(item);
          rects = all.map((element) => element.getBoundingClientRect());
          const next = rects[from + 1] ?? rects[from - 1];
          // The space one item takes, gap included.
          slot = next ? Math.abs(next.top - rects[from]!.top) : rects[from]!.height;
          if (!reduced) gsap.to(item, { scale: lift, duration: 0.15, ease: "power2.out", overwrite: "auto" });
        },
        onDrag(this: Draggable) {
          const all = items();
          const middle = rects[from]!.top + rects[from]!.height / 2 + this.y;
          target = rects.filter((rect, i) => i !== from && rect.top + rect.height / 2 < middle).length;
          all.forEach((element, i) => {
            if (element === item) return;
            const y = from < i && i <= target ? -slot : target <= i && i < from ? slot : 0;
            gsap.to(element, { y, ...(reduced ? { duration: 0 } : SLIDE), overwrite: "auto" });
          });
        },
        onRelease(this: Draggable) {
          const all = items();
          const landing = target > from ? rects[target]!.bottom - rects[from]!.bottom : rects[target]!.top - rects[from]!.top;
          gsap.to(item, {
            y: landing,
            scale: 1,
            ...(reduced ? { duration: 0 } : SETTLE),
            overwrite: "auto",
            onComplete: () => {
              // The DOM takes the new order, and every transform clears in the same frame, so nothing jumps.
              if (target !== from) list.insertBefore(item, target > from ? all[target]!.nextElementSibling : all[target]!);
              gsap.set(items(), { y: 0 });
              drag?.update();
              if (target !== from) onReorder?.(items(), from, target);
              say(`${nameOf(item)} moved to position ${target + 1} of ${all.length}.`);
            },
          });
        },
      });
      if (drag) {
        draggables.push(drag);
        cleanups.push(() => drag.kill());
      }
    }

    // Keyboard: the handle picks up, moves, drops, and cancels.
    let held: { item: HTMLElement; from: number } | undefined;
    const onKey = (event: KeyboardEvent) => {
      const handle = (event.target as Element).closest<HTMLElement>("[data-sortable-handle]");
      const item = handle?.closest<HTMLElement>("[data-sortable-item]");
      if (!handle || !item || item.parentElement !== list) return;
      const all = items();
      const index = all.indexOf(item);
      const refocus = () => handle.focus({ preventScroll: true });
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (!held) {
          held = { item, from: index };
          handle.setAttribute("aria-pressed", "true");
          if (!reduced) gsap.to(item, { scale: lift, duration: 0.15, ease: "power2.out", overwrite: "auto" });
          say(`Picked up ${nameOf(item)}, position ${index + 1} of ${all.length}.`);
        } else {
          held = undefined;
          handle.setAttribute("aria-pressed", "false");
          gsap.to(item, { scale: 1, ...(reduced ? { duration: 0 } : SETTLE), overwrite: "auto" });
          say(`Dropped ${nameOf(item)} at position ${index + 1} of ${all.length}.`);
        }
      } else if (held?.item === item && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        if (move(item, index + (event.key === "ArrowUp" ? -1 : 1))) {
          refocus();
          say(`Moved to position ${items().indexOf(item) + 1} of ${all.length}.`);
        }
      } else if (held?.item === item && event.key === "Escape") {
        event.preventDefault();
        const back = held.from;
        held = undefined;
        move(item, back);
        refocus();
        handle.setAttribute("aria-pressed", "false");
        gsap.to(item, { scale: 1, ...(reduced ? { duration: 0 } : SETTLE), overwrite: "auto" });
        say(`Cancelled. ${nameOf(item)} is back at position ${back + 1} of ${all.length}.`);
      }
    };
    list.addEventListener("keydown", onKey);
    cleanups.push(() => list.removeEventListener("keydown", onKey));
    // Focus leaving a held item drops it where it is.
    const onFocusOut = (event: FocusEvent) => {
      if (moving || !held || held.item.contains(event.relatedTarget as Node | null)) return;
      const { item } = held;
      held = undefined;
      handleOf(item)?.setAttribute("aria-pressed", "false");
      gsap.to(item, { scale: 1, duration: reduced ? 0 : 0.2, overwrite: "auto" });
    };
    list.addEventListener("focusout", onFocusOut);
    cleanups.push(() => list.removeEventListener("focusout", onFocusOut));
  } catch (error) {
    restoreAll();
    throw error;
  }

  let done = false;
  return {
    order: items,
    revert: () => {
      if (done) return;
      done = true;
      restoreAll();
    },
  };
}
```

`revert` leaves the items in their current order: the order is the app's state, already reported through `onReorder`. Vertical lists only; a grid needs a two-axis slot search. Keep the list's height stable while dragging, and give each item an opaque background, since the held item passes over its neighbors.

## Controller contract

| Builder | Create | Returns | Reduced motion |
|---|---|---|---|
| `sortable` | Settled, once item heights are final; rebuild after items change | `{ order, revert }` | Drag, keys, and announcements work; nothing lifts or slides, items jump to their slots |

- `onReorder` fires once per completed move: per drop for a drag, per arrow key for the keyboard.
- Revert before the list is removed, and before a re-render replaces its items.
