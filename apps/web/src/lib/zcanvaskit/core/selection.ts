/**
 * What a modified press means.
 *
 * Three kinds of element answer a press — a shape, a connector, a mark of ink —
 * and the rule for widening a selection has to be the same on all three, or a
 * user building a selection out of every kind at once has to remember which
 * modifier the pointer happens to be over. That is not a rule anyone can hold
 * in their head, and the failure is silent: the press works, and the rest of
 * the selection is quietly gone.
 *
 * `Shift` widens the selection and only ever adds to it, which is what it has
 * always done on this canvas. `Ctrl` / `Cmd` widens it and toggles, which is
 * what every other editor has taught the user's fingers: an element already
 * picked comes back out. Both are kept because both are habits — one formed
 * here, one formed elsewhere — and neither costs the other anything.
 *
 * A press with neither modifier replaces the selection, as it always has.
 */
export interface ZCanvasPressModifiers {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  /** Replaces a selection the press landed inside, instead of keeping it standing. */
  altKey: boolean;
}

/**
 * The modifiers a press was made with, copied off the event that carried it.
 *
 * A copy rather than the event itself: a press whose meaning is not known until
 * the pointer comes back up has to be remembered, and a UI event is not
 * something to keep hold of.
 */
export function pressModifiers(event: ZCanvasPressModifiers): ZCanvasPressModifiers {
  return {
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
  };
}

/** Whether the press joins the selection instead of replacing it. */
export function widensSelection(modifiers: ZCanvasPressModifiers): boolean {
  return modifiers.shiftKey || modifiers.ctrlKey || modifiers.metaKey;
}

/** Whether the press takes an element that is already picked back out again. */
export function togglesSelection(modifiers: ZCanvasPressModifiers): boolean {
  return modifiers.ctrlKey || modifiers.metaKey;
}

/**
 * Every id in any of the lists, once, in the order first seen.
 *
 * Order is kept rather than sorted because the last id in a selection is the
 * one the style panel edits, so a union that reordered its members would move
 * the panel off the element the user just picked.
 */
export function unionSelections(...lists: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const union: string[] = [];
  for (const list of lists) {
    for (const id of list) {
      if (seen.has(id)) continue;
      seen.add(id);
      union.push(id);
    }
  }
  return union;
}

/** The selection after `id` is added to it. */
export function addToSelection(selection: readonly string[], id: string): string[] {
  return selection.includes(id) ? [...selection] : [...selection, id];
}

/** The selection after `id` is taken in, or out if it was already in. */
export function toggleInSelection(selection: readonly string[], id: string): string[] {
  return selection.includes(id)
    ? selection.filter((current) => current !== id)
    : [...selection, id];
}

/**
 * The selection after a press on `id` that may be adding, toggling or
 * replacing.
 *
 * `Shift` widens and only adds; `Ctrl` / `Cmd` widens and toggles; `Alt` takes
 * the pressed element alone, whatever else is held with it, which is what a
 * press on something already inside a selection is for.
 *
 * `shiftToggles` is the one place the three kinds of element disagree, and it
 * is deliberate: ink has always let a Shift press take a mark back out, because
 * a sloppy line is the one element a user re-picks by accident and the one they
 * want to be able to undo with the same gesture. Everywhere else Shift adds.
 */
export function selectionAfterPress(
  selection: readonly string[],
  id: string,
  modifiers: ZCanvasPressModifiers,
  options: { shiftToggles?: boolean } = {}
): string[] {
  if (modifiers.altKey) return [id];
  if (!widensSelection(modifiers)) return [id];
  if (togglesSelection(modifiers) || options.shiftToggles) return toggleInSelection(selection, id);
  return addToSelection(selection, id);
}
