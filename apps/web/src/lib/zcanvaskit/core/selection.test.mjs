import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const {
  addToSelection,
  pressModifiers,
  selectionAfterPress,
  toggleInSelection,
  togglesSelection,
  unionSelections,
  widensSelection,
} = await import('./selection.ts');

/** The modifiers a press was made with, with only the named ones held down. */
const held = (...keys) => ({
  shiftKey: keys.includes('shift'),
  ctrlKey: keys.includes('ctrl'),
  metaKey: keys.includes('meta'),
  altKey: keys.includes('alt'),
});

test('a press with nothing held replaces the selection', () => {
  assert.equal(widensSelection(held()), false);
  assert.deepEqual(selectionAfterPress(['a', 'b'], 'c', held()), ['c']);
});

test('shift widens, ctrl widens, meta widens, and nothing else does', () => {
  assert.equal(widensSelection(held('shift')), true);
  assert.equal(widensSelection(held('ctrl')), true);
  assert.equal(widensSelection(held('meta')), true);
  // Alt narrows rather than widens: it is the modifier for taking one element
  // out of a pile, not for adding to it.
  assert.equal(widensSelection(held('alt')), false);
});

test('only ctrl and meta toggle', () => {
  assert.equal(togglesSelection(held('ctrl')), true);
  assert.equal(togglesSelection(held('meta')), true);
  // Shift has always only added on this canvas, for shapes and lines alike.
  assert.equal(togglesSelection(held('shift')), false);
  assert.equal(togglesSelection(held()), false);
});

test('a press snapshot copies the modifiers off the event', () => {
  const event = { ...held('shift', 'meta'), stopPropagation() {} };

  assert.deepEqual(pressModifiers(event), held('shift', 'meta'));
});

test('adding to a selection keeps the order and never repeats an id', () => {
  assert.deepEqual(addToSelection(['a', 'b'], 'c'), ['a', 'b', 'c']);
  // Already in: the selection is handed back as it was, not reordered, because
  // the last id in it is the one the style panel edits.
  assert.deepEqual(addToSelection(['a', 'b'], 'a'), ['a', 'b']);
});

test('toggling takes an id in, and takes it back out', () => {
  assert.deepEqual(toggleInSelection(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggleInSelection(['a', 'b'], 'a'), ['b']);
});

test('shift adds a line to a selection of shapes instead of replacing it', () => {
  // The regression this locks: a press on a connector cleared everything else,
  // so a selection of shapes and lines could only ever hold one line.
  assert.deepEqual(selectionAfterPress(['shape-1', 'shape-2'], 'line-1', held('shift')), [
    'shape-1',
    'shape-2',
    'line-1',
  ]);
});

test('ctrl-clicking a line already in the selection takes it back out', () => {
  assert.deepEqual(selectionAfterPress(['shape-1', 'line-1'], 'line-1', held('ctrl')), ['shape-1']);
});

test('ctrl-clicking a line that is not in the selection adds it', () => {
  assert.deepEqual(selectionAfterPress(['shape-1'], 'line-1', held('ctrl')), ['shape-1', 'line-1']);
});

test('cmd carries the ctrl rule, so a Mac builds the same selection', () => {
  assert.deepEqual(selectionAfterPress(['shape-1'], 'line-1', held('meta')), [
    'shape-1',
    'line-1',
  ]);
  assert.deepEqual(selectionAfterPress(['shape-1', 'line-1'], 'line-1', held('meta')), [
    'shape-1',
  ]);
});

test('alt takes the pressed element alone, even held with a widening key', () => {
  assert.deepEqual(selectionAfterPress(['a', 'b'], 'b', held('alt')), ['b']);
  assert.deepEqual(selectionAfterPress(['a', 'b'], 'c', held('alt', 'shift')), ['c']);
});

test('ink toggles on shift as well, which is the one place the kinds differ', () => {
  // A sloppy line is the element a user re-picks by accident, so the gesture
  // that picked it also puts it back.
  assert.deepEqual(selectionAfterPress(['ink-1', 'ink-2'], 'ink-1', held('shift'), {
    shiftToggles: true,
  }), ['ink-2']);
  // And it still only adds when the id was not in there.
  assert.deepEqual(selectionAfterPress(['ink-1'], 'ink-2', held('shift'), { shiftToggles: true }), [
    'ink-1',
    'ink-2',
  ]);
});

test('a union holds every id once, in the order first seen', () => {
  assert.deepEqual(unionSelections(['a', 'b'], ['b', 'c'], ['a', 'd']), ['a', 'b', 'c', 'd']);
});

test('a union with nothing in it is empty, and one list is that list', () => {
  assert.deepEqual(unionSelections(), []);
  assert.deepEqual(unionSelections([], []), []);
  assert.deepEqual(unionSelections(['a']), ['a']);
});

test('a sweep that widens adds to the selection it started from', () => {
  // What both sweeps of a two-box selection do: the second box catches one
  // shape and one line, and the shapes picked before it stay picked.
  const base = { nodeIds: ['shape-1'], edgeIds: ['line-1'], strokeIds: [] };
  const swept = { nodeIds: ['shape-2'], edgeIds: ['line-2'], strokeIds: [] };

  assert.deepEqual(unionSelections(base.nodeIds, swept.nodeIds), ['shape-1', 'shape-2']);
  assert.deepEqual(unionSelections(base.edgeIds, swept.edgeIds), ['line-1', 'line-2']);
});
