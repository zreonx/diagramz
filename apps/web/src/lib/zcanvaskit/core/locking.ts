import type { ZCanvasDrawingStroke, ZCanvasEdge, ZCanvasNode } from './schema';

/**
 * Lock: an element the canvas holds but will not change.
 *
 * A lock is a property of one element, not of a group or a boundary's contents.
 * Locking a box leaves the shapes inside it free to move, and locking a shape
 * leaves its neighbours alone — the gesture that moves a mixed selection moves
 * everything in it that is not locked and leaves everything that is, which is
 * the reading that makes a lock worth having in a diagram full of elements that
 * all want to move together.
 *
 * What a lock does *not* do is hide the element from the pointer. A locked
 * element is still swept up, still answers a click, and still opens its context
 * menu, because unlocking it is done from that menu. Refusing selection would
 * make a lock a one-way door.
 */

/** Anything the canvas can hold, and therefore anything that can be locked. */
export type ZCanvasLockable = ZCanvasNode | ZCanvasEdge | ZCanvasDrawingStroke;

/**
 * Whether an element refuses to be edited or moved.
 *
 * Reads the field first and falls back to the flag `ToggleLockCommand` used to
 * write into a node's `data` bag, so a document that was given a lock before
 * the field existed keeps it. The field wins where both are present, because it
 * is the one every write goes through now.
 */
export function isLocked(element: ZCanvasLockable): boolean {
  if (element.locked !== undefined) return element.locked;
  const legacy = (element as { data?: Record<string, unknown> }).data?.locked;
  return legacy === true;
}

/** Whether every one of `elements` carries a lock. False for an empty list. */
export function allLocked(elements: ZCanvasLockable[]): boolean {
  return elements.length > 0 && elements.every(isLocked);
}

/**
 * The lock state a toggle over `elements` lands on.
 *
 * One rule for a mixed selection: lock everything unless everything is already
 * locked, in which case unlock everything. A per-element flip would leave a
 * selection of two locked and one unlocked shape half-locked in a way nothing
 * on screen explains — and it is the same rule a menu label needs, since "all
 * locked" is exactly when the item reads Unlock.
 */
export function nextLockState(elements: ZCanvasLockable[]): boolean {
  return !allLocked(elements);
}

/**
 * `element` with its lock set as asked.
 *
 * Unlocking removes the field rather than writing `false` onto it, and clears
 * the legacy `data.locked` at the same time — otherwise a document that came in
 * with the old flag would be unlocked and then spring back locked on the next
 * load, because the fallback would find the flag still there.
 */
export function applyLock<T extends ZCanvasLockable>(element: T, locked: boolean): T {
  const next = { ...element } as T & { locked?: boolean; data?: Record<string, unknown> };

  if (locked) {
    next.locked = true;
    return next as T;
  }

  delete next.locked;
  if (next.data && 'locked' in next.data) {
    const data = { ...next.data };
    delete data.locked;
    next.data = data;
  }
  return next as T;
}

/** Every element of `document` that carries a lock. */
export function lockedIds(document: {
  nodes: ZCanvasNode[];
  edges: ZCanvasEdge[];
  strokes: ZCanvasDrawingStroke[];
}): Set<string> {
  const ids = new Set<string>();
  for (const element of [...document.nodes, ...document.edges, ...document.strokes]) {
    if (isLocked(element)) ids.add(element.id);
  }
  return ids;
}
