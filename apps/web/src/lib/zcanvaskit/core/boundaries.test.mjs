import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const { boundaryAtPoint, childIdsOf, encloses, isBoundaryNode, FRAME_PRESETS } = await import('./boundaries.ts');

/** A boundary, with only the fields these rules look at. */
function box(id, x, y, width, height, extra = {}) {
  return { id, type: 'container', x, y, width, height, title: id, ...extra };
}

/** A plain card, which is what a boundary usually holds. */
function card(id, x, y, width = 100, height = 60, extra = {}) {
  return { id, type: 'card', x, y, width, height, title: id, ...extra };
}

const vpc = box('vpc', 0, 0, 400, 300);

// ---------------------------------------------------------------------------
// Geometry. `encloses` is what the paint order asks, so these are about where a
// box is drawn — a boundary sits beneath whatever covers it — and say nothing
// about who belongs to whom.

test('a shape inside a boundary is enclosed', () => {
  assert.equal(encloses(vpc, card('a', 40, 40)), true);
});

test('a shape hanging over the edge is not enclosed', () => {
  assert.equal(encloses(vpc, card('a', 350, 40)), false);
  assert.equal(encloses(vpc, card('a', -20, 40)), false);
  assert.equal(encloses(vpc, card('a', 40, 270)), false);
});

test('a shape flush with the edge is enclosed', () => {
  // Touching the frame is still being inside it, which matters because a shape
  // snapped to a boundary's edge is the common case, not a corner case.
  assert.equal(encloses(vpc, card('a', 0, 0)), true);
  assert.equal(encloses(vpc, card('a', 300, 240)), true);
});

test('a boundary bigger than the one it holds is not enclosed by it', () => {
  assert.equal(encloses(vpc, box('outer', -50, -50, 600, 500)), false);
});

// ---------------------------------------------------------------------------
// Membership. A box carries what the document records as its own, and nothing
// it merely covers: two ungrouped elements stacked are two elements, and the
// box moves on its own.

test('a box carries nothing it only covers', () => {
  const nodes = [vpc, card('in', 40, 40), card('out', 900, 900)];

  // The shape inside is on top of the box, not part of it. Moving the frame out
  // from under a diagram is the whole point of that.
  assert.deepEqual(childIdsOf(vpc, nodes), []);
});

test('a recorded parent is carried, wherever the shape sits', () => {
  // `parentId` is the membership an older editor wrote when a group came with a
  // box of its own. Nothing here writes it now, but a document that has one
  // means it, so the box still carries what the file says it holds.
  const stray = card('stray', 900, 900, 100, 60, { parentId: 'vpc' });
  const nodes = [vpc, stray, card('in', 40, 40)];

  assert.deepEqual(childIdsOf(vpc, nodes), ['stray']);
});

test('a boundary never carries itself', () => {
  // A box inside its own box would otherwise be moved twice on every drag.
  assert.deepEqual(childIdsOf(vpc, [vpc]), []);
});

test('a nested boundary is covered, not held', () => {
  const inner = box('inner', 40, 40, 120, 100);

  // Nested boxes are still two boxes: moving the outer one over the inner one
  // rearranges the picture rather than picking the inner one up.
  assert.deepEqual(childIdsOf(vpc, [vpc, inner]), []);
});

// ---------------------------------------------------------------------------
// The press. A boundary's body is transparent to the pointer, so the canvas has
// to turn a press back into the box the user meant.

test('a press on a boundary body finds that boundary', () => {
  assert.equal(boundaryAtPoint([vpc], { x: 200, y: 150 })?.id, 'vpc');
});

test('a press outside every boundary finds none', () => {
  assert.equal(boundaryAtPoint([vpc], { x: 900, y: 900 }), null);
  assert.equal(boundaryAtPoint([], { x: 0, y: 0 }), null);
});

test('a press on the frame itself still finds the boundary', () => {
  // The body is a fair target right up to its edge, which is what makes the
  // whole box a handle rather than only the middle of it.
  assert.equal(boundaryAtPoint([vpc], { x: 0, y: 150 })?.id, 'vpc');
  assert.equal(boundaryAtPoint([vpc], { x: 400, y: 300 })?.id, 'vpc');
});

test('a press inside nested boundaries finds the innermost one', () => {
  const inner = box('inner', 40, 40, 120, 100);

  // Both contain the point; the one being pointed at is the small one.
  assert.equal(boundaryAtPoint([vpc, inner], { x: 100, y: 90 })?.id, 'inner');
  // Outside the inner box but inside the outer one.
  assert.equal(boundaryAtPoint([vpc, inner], { x: 300, y: 250 })?.id, 'vpc');
});

test('only boundaries are ever found by a press', () => {
  // A shape's own press reaches the shape; this is only about the presses that
  // fall through a transparent box, so a card must never answer one.
  assert.equal(boundaryAtPoint([card('a', 0, 0, 400, 300)], { x: 200, y: 150 }), null);
});

test('a frame is recognized as a boundary node and found by a press', () => {
  const frameNode = { id: 'frame-1', type: 'frame', x: 100, y: 100, width: 800, height: 600, title: 'Desktop' };
  assert.equal(isBoundaryNode(frameNode), true);
  assert.equal(isBoundaryNode(vpc), true);
  assert.equal(isBoundaryNode(card('a', 0, 0)), false);

  assert.equal(boundaryAtPoint([frameNode], { x: 200, y: 200 })?.id, 'frame-1');
  assert.equal(boundaryAtPoint([frameNode], { x: 50, y: 50 }), null);
});

test('frame presets provide standard dimensions', () => {
  assert.ok(FRAME_PRESETS.length >= 5);
  const desktop = FRAME_PRESETS.find((p) => p.id === 'desktop');
  assert.equal(desktop?.width, 1440);
  assert.equal(desktop?.height, 900);
});
