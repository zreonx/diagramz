import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const {
  beginSelectionDrag,
  isDragSnapshotMovable,
  translateSelection,
  dragSnapshotBounds,
} = await import('./selection-drag.ts');

/** A shape, with only the fields a move looks at. */
const card = (id, x, y, extra = {}) => ({ id, type: 'card', x, y, width: 100, height: 60, ...extra });

/** A connector drawn between two shapes. */
const attached = (id, source, target) => ({ id, source, target });

/** A connector carrying its own two endpoints. */
const free = (id, sx, sy, tx, ty, extra = {}) => ({
  id,
  source: '',
  target: '',
  sourcePoint: { x: sx, y: sy },
  targetPoint: { x: tx, y: ty },
  ...extra,
});

/** Hand-drawn ink, as the pen records it. */
const ink = (id, points, extra = {}) => ({ id, points, color: '#000', width: 2, ...extra });

const DOC = {
  nodes: [card('a', 0, 0), card('b', 200, 0), card('c', 900, 900)],
  edges: [attached('link', 'a', 'b'), free('arrow', 10, 300, 110, 300)],
  strokes: [ink('scribble', [{ x: 0, y: 0 }, { x: 10, y: 10 }])],
};

const ALL = { nodeIds: ['a', 'b', 'c'], edgeIds: ['link', 'arrow'], strokeIds: ['scribble'] };

test('every kind of selected element travels together', () => {
  const snapshot = beginSelectionDrag(DOC, { nodeIds: ['a'], edgeIds: ['arrow'], strokeIds: ['scribble'] });
  const next = translateSelection(snapshot, DOC, 10, 5);

  // The regression this exists for: a drag used to move one kind and leave the
  // rest where they were, which is what "the arrow is not selected" looks like.
  assert.deepEqual(next.nodes.find((n) => n.id === 'a'), card('a', 10, 5));
  assert.deepEqual(next.edges.find((e) => e.id === 'arrow'), free('arrow', 20, 305, 120, 305));
  assert.deepEqual(next.strokes[0].points, [{ x: 10, y: 5 }, { x: 20, y: 15 }]);
});

test('an attached connector is left for its shapes to carry', () => {
  const snapshot = beginSelectionDrag(DOC, ALL);
  const next = translateSelection(snapshot, DOC, 10, 5);

  // It has no endpoint of its own: where it runs is decided by what it is
  // anchored to, so shifting its ends would tear it off them.
  assert.deepEqual(next.edges.find((e) => e.id === 'link'), attached('link', 'a', 'b'));
});

test('an element the selection does not hold does not move', () => {
  const snapshot = beginSelectionDrag(DOC, { nodeIds: ['a'] });
  const next = translateSelection(snapshot, DOC, 10, 5);

  assert.deepEqual(next.nodes.find((n) => n.id === 'c'), card('c', 900, 900));
});

test('the move is measured from the press, not accumulated', () => {
  const snapshot = beginSelectionDrag(DOC, { nodeIds: ['a'] });

  // Two moves of the same delta, each applied to the live document, land where
  // one move of double the delta does — not where the sum of both would.
  const once = translateSelection(snapshot, DOC, 30, 30);
  const twice = translateSelection(snapshot, once, 30, 30);

  assert.deepEqual(twice.nodes.find((n) => n.id === 'a'), card('a', 30, 30));
});

test('a change made during the drag survives the move', () => {
  const snapshot = beginSelectionDrag(DOC, { nodeIds: ['a'] });
  const restyled = {
    ...DOC,
    nodes: DOC.nodes.map((n) => (n.id === 'a' ? { ...n, color: '#f00' } : n)),
  };
  const next = translateSelection(snapshot, restyled, 10, 5);

  // Position comes from the snapshot, everything else from the document, so a
  // style preview made mid-drag is carried through rather than reverted.
  assert.equal(next.nodes.find((n) => n.id === 'a').color, '#f00');
  assert.equal(next.nodes.find((n) => n.id === 'a').x, 10);
});

test('a move of nothing returns the document untouched', () => {
  const snapshot = beginSelectionDrag(DOC, ALL);

  assert.equal(translateSelection(snapshot, DOC, 0, 0), DOC);
});

test('a snapshot is movable when it holds something that can shift', () => {
  assert.equal(isDragSnapshotMovable(beginSelectionDrag(DOC, { nodeIds: [] })), false);
  assert.equal(isDragSnapshotMovable(beginSelectionDrag(DOC, { nodeIds: ['a'] })), true);
  assert.equal(isDragSnapshotMovable(beginSelectionDrag(DOC, { edgeIds: ['arrow'] })), true);
  assert.equal(isDragSnapshotMovable(beginSelectionDrag(DOC, { strokeIds: ['scribble'] })), true);
});

test('a snapshot holding only an attached connector is not movable', () => {
  // It is genuinely selected, and so worth showing as selected — but where it
  // runs is decided by the shapes it is anchored to, so a move over it would
  // write the document back to itself and record an undo step that undoes
  // nothing.
  assert.equal(isDragSnapshotMovable(beginSelectionDrag(DOC, { edgeIds: ['link'] })), false);
});

test('a snapshot of an id that is not in the document is not movable', () => {
  assert.equal(isDragSnapshotMovable(beginSelectionDrag(DOC, { nodeIds: ['missing'] })), false);
});

test('an attached connector in the snapshot is still part of the selection', () => {
  const snapshot = beginSelectionDrag(DOC, { edgeIds: ['link'] });

  // It is held, so the gesture is real and worth an undo step; it simply has no
  // position of its own to change.
  assert.equal(snapshot.edges.size, 1);
  assert.deepEqual(translateSelection(snapshot, DOC, 10, 5).edges, DOC.edges);
});

test('the selection box spans every kind it holds', () => {
  const snapshot = beginSelectionDrag(DOC, { nodeIds: ['a'], strokeIds: ['scribble'] });

  // Shape at 0,0 (100x60); ink reaching 10,10.
  assert.deepEqual(dragSnapshotBounds(snapshot), { x: 0, y: 0, width: 100, height: 60 });
});

test('the selection box reaches a free connector that lies outside every shape', () => {
  const snapshot = beginSelectionDrag(DOC, { edgeIds: ['arrow'] });

  assert.deepEqual(dragSnapshotBounds(snapshot), { x: 10, y: 300, width: 100, height: 0 });
});

test('an empty snapshot has no box', () => {
  assert.equal(dragSnapshotBounds(beginSelectionDrag(DOC, { nodeIds: [] })), null);
});

// ---------------------------------------------------------------------------
// Lock. One snapshot is taken by the drag, the nudge and a boundary's carry
// alike, so a locked element staying still is decided here rather than three
// times over in the component.

/** The same document, with `id` locked. */
const withLock = (id) => ({
  nodes: DOC.nodes.map((n) => (n.id === id ? { ...n, locked: true } : n)),
  edges: DOC.edges.map((e) => (e.id === id ? { ...e, locked: true } : e)),
  strokes: DOC.strokes.map((s) => (s.id === id ? { ...s, locked: true } : s)),
});

test('a locked shape stays where it is while the rest of the selection moves', () => {
  const doc = withLock('a');
  const snapshot = beginSelectionDrag(doc, { nodeIds: ['a', 'b'] });
  const next = translateSelection(snapshot, doc, 10, 5);

  assert.deepEqual(next.nodes.find((n) => n.id === 'a'), card('a', 0, 0, { locked: true }));
  assert.deepEqual(next.nodes.find((n) => n.id === 'b'), card('b', 210, 5));
});

test('a locked connector stays where it is', () => {
  const doc = withLock('arrow');
  const snapshot = beginSelectionDrag(doc, { nodeIds: ['a', 'b'], edgeIds: ['arrow'] });
  const next = translateSelection(snapshot, doc, 10, 5);

  assert.deepEqual(
    next.edges.find((e) => e.id === 'arrow'),
    free('arrow', 10, 300, 110, 300, { locked: true })
  );
  assert.deepEqual(next.nodes.find((n) => n.id === 'a'), card('a', 10, 5));
});

test('locked ink stays where it is', () => {
  const doc = withLock('scribble');
  const snapshot = beginSelectionDrag(doc, { nodeIds: ['a'], strokeIds: ['scribble'] });
  const next = translateSelection(snapshot, doc, 10, 5);

  assert.deepEqual(
    next.strokes[0],
    ink('scribble', [{ x: 0, y: 0 }, { x: 10, y: 10 }], { locked: true })
  );
  assert.deepEqual(next.nodes.find((n) => n.id === 'a'), card('a', 10, 5));
});

test('a locked connector alone in the selection leaves the gesture nothing to do', () => {
  // A free connector would normally be movable wherever it is selected, so this
  // is the lock talking and not the attachment rule. Nothing shifts, so nothing
  // is committed — a drag across it writes no undo step the user then has to
  // undo twice.
  assert.equal(
    isDragSnapshotMovable(beginSelectionDrag(withLock('arrow'), { edgeIds: ['arrow'] })),
    false
  );
});

test('a snapshot of nothing but locked elements is not movable', () => {
  const doc = { nodes: [card('a', 0, 0, { locked: true })], edges: [], strokes: [] };

  // Which is what stops a nudge from recording an undo step that undoes
  // nothing, and a press on a locked shape from opening a move at all.
  assert.equal(isDragSnapshotMovable(beginSelectionDrag(doc, { nodeIds: ['a'] })), false);
});

test('the box a drag measures against covers only what will move', () => {
  const doc = {
    nodes: [card('a', 0, 0, { locked: true }), card('b', 200, 0)],
    edges: [],
    strokes: [],
  };
  const snapshot = beginSelectionDrag(doc, { nodeIds: ['a', 'b'] });

  // The locked shape is still selected — it is drawn as selected and clicking it
  // still reaches the menu that unlocks it — but it is not going anywhere, so it
  // must not drag the box the move snaps against out to cover it.
  assert.equal(snapshot.nodes.size, 1);
  assert.deepEqual(dragSnapshotBounds(snapshot), { x: 200, y: 0, width: 100, height: 60 });
});

test('the flag the old command wrote is honoured by a move', () => {
  const doc = { nodes: [{ ...card('a', 0, 0), data: { locked: true } }], edges: [], strokes: [] };

  // Documents written before locks were a field carry the flag in the data bag,
  // and go on being locked: a lock that springs open on reload is worse than no
  // lock, because the user has already stopped watching the element.
  assert.equal(isDragSnapshotMovable(beginSelectionDrag(doc, { nodeIds: ['a'] })), false);
});

test('an unlocked neighbour of a locked element still moves', () => {
  const doc = withLock('a');

  assert.equal(isDragSnapshotMovable(beginSelectionDrag(doc, { nodeIds: ['a', 'b'] })), true);
});

test('a moving container carries enclosed and grouped shapes without them being selected', () => {
  const containerNode = {
    id: 'vpc',
    type: 'container',
    x: 100,
    y: 100,
    width: 500,
    height: 400,
    title: 'VPC',
    groupIds: ['grp-1'],
  };
  const insideCard = card('inside', 150, 150, 80, 50, { groupIds: ['grp-1'] });
  const outsideCard = card('outside', 800, 800, 80, 50);

  const doc = {
    nodes: [containerNode, insideCard, outsideCard],
    edges: [],
    strokes: [],
  };

  // Only the container itself is selected in the UI selection!
  const snapshot = beginSelectionDrag(doc, { nodeIds: ['vpc'] });
  const next = translateSelection(snapshot, doc, 50, 30);

  // Both container and inner shape moved
  assert.equal(next.nodes.find((n) => n.id === 'vpc').x, 150);
  assert.equal(next.nodes.find((n) => n.id === 'vpc').y, 130);
  assert.equal(next.nodes.find((n) => n.id === 'inside').x, 200);
  assert.equal(next.nodes.find((n) => n.id === 'inside').y, 180);

  // Outside shape did not move
  assert.equal(next.nodes.find((n) => n.id === 'outside').x, 800);
  assert.equal(next.nodes.find((n) => n.id === 'outside').y, 800);
});

test('moving a single shape inside a container leaves the parent container untouched', () => {
  const containerNode = {
    id: 'vpc',
    type: 'container',
    x: 100,
    y: 100,
    width: 500,
    height: 400,
    title: 'VPC',
  };
  const insideCard = card('inside', 150, 150, 80, 50);

  const doc = {
    nodes: [containerNode, insideCard],
    edges: [],
    strokes: [],
  };

  // Only the child shape is selected
  const snapshot = beginSelectionDrag(doc, { nodeIds: ['inside'] });
  const next = translateSelection(snapshot, doc, 20, 20);

  // Container remains at original position
  assert.equal(next.nodes.find((n) => n.id === 'vpc').x, 100);
  assert.equal(next.nodes.find((n) => n.id === 'vpc').y, 100);
  // Child moved inside the container
  assert.equal(next.nodes.find((n) => n.id === 'inside').x, 170);
  assert.equal(next.nodes.find((n) => n.id === 'inside').y, 170);
});
