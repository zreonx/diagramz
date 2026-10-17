import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const { allLocked, applyLock, isLocked, lockedIds, nextLockState } = await import('./locking.ts');

const card = (id, extra = {}) => ({ id, type: 'card', x: 0, y: 0, width: 1, height: 1, title: id, ...extra });
const edge = (id, extra = {}) => ({ id, source: 'a', target: 'b', ...extra });
const ink = (id, extra = {}) => ({ id, points: [{ x: 0, y: 0 }], color: '#000', width: 2, ...extra });

test('an element with no flag is not locked', () => {
  assert.equal(isLocked(card('a')), false);
});

test('a locked element is locked', () => {
  assert.equal(isLocked(card('a', { locked: true })), true);
});

test('an explicit false beats the flag it was given before the field existed', () => {
  // Unlocking has to survive a reload, and the old flag is still in the file.
  assert.equal(isLocked(card('a', { locked: false, data: { locked: true } })), false);
});

test('the flag the old command wrote is still honoured', () => {
  // Instruments locking a shape and then reopening the diagram used to lose it.
  assert.equal(isLocked(card('a', { data: { locked: true } })), true);
});

test('an unrelated key in the data bag is not a lock', () => {
  assert.equal(isLocked(card('a', { data: { locked: 'yes' } })), false);
  assert.equal(isLocked(card('a', { data: { pinned: true } })), false);
});

test('locking writes the field', () => {
  assert.equal(applyLock(card('a'), true).locked, true);
});

test('locking leaves the rest of the element alone', () => {
  const before = card('a', { title: 'Alpha' });

  assert.deepEqual(applyLock(before, true), { ...before, locked: true });
});

test('locking does not mutate the element it was handed', () => {
  const before = card('a');
  applyLock(before, true);

  assert.equal('locked' in before, false);
});

test('unlocking removes the field rather than writing false onto it', () => {
  assert.equal('locked' in applyLock(card('a', { locked: true }), false), false);
});

test('unlocking clears the old flag too, so it cannot come back on the next load', () => {
  // The round trip that matters: lock, unlock, save, reload.
  const unlocked = applyLock(card('a', { data: { locked: true } }), false);

  assert.equal(isLocked(unlocked), false);
  assert.deepEqual(unlocked.data, {});
});

test('unlocking keeps the rest of the data bag', () => {
  const unlocked = applyLock(card('a', { data: { locked: true, note: 'keep me' } }), false);

  assert.deepEqual(unlocked.data, { note: 'keep me' });
});

test('unlocking an element with no data bag does not invent one', () => {
  assert.equal('data' in applyLock(card('a', { locked: true }), false), false);
});

test('a lock survives the serialize-and-parse round trip', () => {
  const locked = applyLock(card('a'), true);

  assert.equal(isLocked(JSON.parse(JSON.stringify(locked))), true);
});

test('every kind of element can be locked', () => {
  assert.equal(isLocked(edge('e', { locked: true })), true);
  assert.equal(isLocked(ink('s', { locked: true })), true);
  assert.equal(applyLock(edge('e'), true).locked, true);
  assert.equal(applyLock(ink('s'), true).locked, true);
});

test('a toggle over nothing is a no-op selection', () => {
  // Nothing is ever locked by an empty selection, so the rule reads as "unlock"
  // only to describe what a single further toggle would do.
  assert.equal(allLocked([]), false);
  assert.equal(nextLockState([]), true);
});

test('a toggle locks a selection of unlocked elements', () => {
  assert.equal(nextLockState([card('a'), card('b')]), true);
});

test('a toggle unlocks a selection that is already locked through', () => {
  assert.equal(nextLockState([card('a', { locked: true }), card('b', { locked: true })]), false);
});

test('a mixed selection locks the rest rather than splitting the difference', () => {
  // Whatever a half-locked selection means, it is not something the canvas can
  // show, so the toggle resolves it in one direction.
  assert.equal(nextLockState([card('a', { locked: true }), card('b')]), true);
  assert.equal(allLocked([card('a', { locked: true }), card('b')]), false);
});

test('allLocked is true only when every element is locked', () => {
  assert.equal(allLocked([card('a', { locked: true })]), true);
  assert.equal(allLocked([card('a', { locked: true }), edge('e', { locked: true })]), true);
  assert.equal(allLocked([card('a', { locked: true }), edge('e')]), false);
});

test('an element the old flag locked counts towards allLocked', () => {
  assert.equal(allLocked([card('a', { data: { locked: true } })]), true);
});

test('the locked ids of a document span all three kinds', () => {
  const ids = lockedIds({
    nodes: [card('a', { locked: true }), card('b')],
    edges: [edge('e', { locked: true })],
    strokes: [ink('s'), ink('t', { data: { locked: true } })],
  });

  assert.deepEqual([...ids].sort(), ['a', 'e', 't']);
});

test('a document with nothing locked has no locked ids', () => {
  assert.equal(lockedIds({ nodes: [card('a')], edges: [], strokes: [] }).size, 0);
});
