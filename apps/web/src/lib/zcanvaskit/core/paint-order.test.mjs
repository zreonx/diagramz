import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const { paintOrderRanks, nodeStackKey, topmostNodeAt, findConnectableNodeAt } = await import('./paint-order.ts');

/** A boundary, which is what the ranking's container rule is about. */
function box(id, x, y, width, height, extra = {}) {
  return { id, type: 'container', x, y, width, height, title: id, ...extra };
}

/** A plain card. */
function card(id, x, y, width = 100, height = 60, extra = {}) {
  return { id, type: 'card', x, y, width, height, title: id, ...extra };
}

const vpc = box('vpc', 0, 0, 400, 300);
const inner = card('inner', 40, 40);

/** The rank of `id`, or `undefined` when the node is not in the ranking. */
const rankOf = (nodes, id) => paintOrderRanks(nodes).get(id);

test('a plain document ranks in document order', () => {
  const ranks = paintOrderRanks([card('a', 0, 0), card('b', 200, 0), card('c', 400, 0)]);

  assert.equal(ranks.get('a'), 1);
  assert.equal(ranks.get('b'), 2);
  assert.equal(ranks.get('c'), 3);
});

test('a boundary is pulled behind what it encloses', () => {
  // The document has the box last, which is what drawing a box around finished
  // work produces. Paint order overrules it.
  assert.ok(rankOf([inner, vpc], 'vpc') < rankOf([inner, vpc], 'inner'));
});

test('a boundary written first is left where it is', () => {
  // Already behind its contents, so nothing has to move.
  assert.ok(rankOf([vpc, inner], 'vpc') < rankOf([vpc, inner], 'inner'));
});

test('a boundary says nothing about an element hanging over its edge', () => {
  const overhanging = card('over', 350, 40);
  const ranks = paintOrderRanks([overhanging, vpc]);

  // Overlapping is not belonging: the box is not pulled behind it.
  assert.equal(ranks.get('vpc'), 2);
  assert.equal(ranks.get('over'), 1);
});

test('a boundary enclosing nothing keeps its place in the document', () => {
  const empty = box('empty', 900, 900, 200, 100);
  const ranks = paintOrderRanks([card('a', 0, 0), empty]);

  assert.equal(ranks.get('a'), 1);
  assert.equal(ranks.get('empty'), 2);
});

test('boundaries stay interchangeable with each other', () => {
  const outer = box('outer', 0, 0, 600, 500);
  const nested = box('nested', 40, 40, 200, 160);
  const innerCard = card('inner', 60, 60);

  const ranks = paintOrderRanks([outer, nested, innerCard]);

  // The card is in front of both boxes; which of the two boxes is in front of
  // the other is not something the container rule has an opinion about.
  assert.ok(ranks.get('inner') > ranks.get('outer'));
  assert.ok(ranks.get('inner') > ranks.get('nested'));
  assert.equal(new Set(ranks.values()).size, 3);
});

test('the ranking is dense, one key per element', () => {
  const nodes = [box('vpc', 0, 0, 400, 300), card('a', 40, 40), card('b', 500, 0)];

  assert.deepEqual([...paintOrderRanks(nodes).values()].sort((x, y) => x - y), [1, 2, 3]);
});

test('an explicit zIndex overrides the ranking, in both directions', () => {
  const nodes = [card('a', 0, 0), card('b', 0, 0, 100, 60, { zIndex: 99 })];

  assert.equal(nodeStackKey(nodes[1], paintOrderRanks(nodes), 1), 99);
  assert.equal(nodeStackKey(nodes[0], paintOrderRanks(nodes), 0), 1);
});

test('a node the ranking does not hold falls back to its document index', () => {
  // The renderer can be handed a node the ranking has not seen — one added
  // between a render and the memo that follows it. It still has to be drawable.
  assert.equal(nodeStackKey(card('late', 0, 0), new Map(), 4), 5);
});

test('a press reaches the shape drawn over a boundary, box last in the document', () => {
  const nodes = [inner, vpc];

  // The regression this exists for: a walk of raw document order hit the box
  // first and returned it, so the shape inside could not be picked.
  assert.equal(topmostNodeAt(nodes, { x: 60, y: 60 }, paintOrderRanks(nodes))?.id, 'inner');
});

test('a press on bare boundary body finds the boundary', () => {
  const nodes = [inner, vpc];

  assert.equal(topmostNodeAt(nodes, { x: 300, y: 250 }, paintOrderRanks(nodes))?.id, 'vpc');
});

test('a press on bare boundary body finds it with the box written first too', () => {
  const nodes = [vpc, inner];

  assert.equal(topmostNodeAt(nodes, { x: 300, y: 250 }, paintOrderRanks(nodes))?.id, 'vpc');
});

test('a press outside everything finds nothing', () => {
  const nodes = [inner, vpc];

  assert.equal(topmostNodeAt(nodes, { x: 900, y: 900 }, paintOrderRanks(nodes)), null);
  assert.equal(topmostNodeAt([], { x: 0, y: 0 }, paintOrderRanks([])), null);
});

test('the topmost of two overlapping shapes is the later one', () => {
  const nodes = [card('under', 0, 0), card('over', 20, 20)];

  assert.equal(topmostNodeAt(nodes, { x: 50, y: 50 }, paintOrderRanks(nodes))?.id, 'over');
});

test('an explicit zIndex wins the press as well as the paint', () => {
  const nodes = [card('front', 0, 0, 100, 60, { zIndex: 9 }), card('back', 20, 20)];

  // Written first, so document order would hand the press to `back` — which is
  // exactly the disagreement between picking and painting this rules out.
  assert.equal(topmostNodeAt(nodes, { x: 50, y: 50 }, paintOrderRanks(nodes))?.id, 'front');
});

test('a press on the edge of a box is inside it', () => {
  // Flush counts as covered, which matters because a shape snapped against a
  // neighbour is the common case rather than a corner case.
  const nodes = [card('a', 0, 0, 100, 60)];

  assert.equal(topmostNodeAt(nodes, { x: 0, y: 0 }, paintOrderRanks(nodes))?.id, 'a');
  assert.equal(topmostNodeAt(nodes, { x: 100, y: 60 }, paintOrderRanks(nodes))?.id, 'a');
});

test('findConnectableNodeAt ignores bare interior of containers so lines inside never hijack/snap to container', () => {
  const nodes = [inner, vpc];
  const ranks = paintOrderRanks(nodes);

  // An inner component inside the VPC connects to the component
  assert.equal(findConnectableNodeAt(nodes, { x: 60, y: 60 }, ranks)?.id, 'inner');

  // Bare interior inside the VPC returns null - no auto-snap to VPC line point!
  assert.equal(findConnectableNodeAt(nodes, { x: 300, y: 200 }, ranks), null);
  assert.equal(findConnectableNodeAt(nodes, { x: 200, y: 150 }, ranks), null);

  // Dropping directly on the perimeter border of the VPC allows attaching to the container
  assert.equal(findConnectableNodeAt(nodes, { x: 200, y: 2 }, ranks)?.id, 'vpc');
  assert.equal(findConnectableNodeAt(nodes, { x: 398, y: 150 }, ranks)?.id, 'vpc');

  // When allowBoundary is false (e.g. line creation tool), even the border does not attach to container
  assert.equal(findConnectableNodeAt(nodes, { x: 200, y: 2 }, ranks, { allowBoundary: false }), null);
  // But components still connect when allowBoundary is false
  assert.equal(findConnectableNodeAt(nodes, { x: 60, y: 60 }, ranks, { allowBoundary: false })?.id, 'inner');
});

test('findConnectableNodeAt with padding catches points in the anchor perimeter margin', () => {
  const nodes = [card('shape', 100, 100, 100, 60)];
  const ranks = paintOrderRanks(nodes);

  // Point just outside the top border (where an anchor handle sits at -6px)
  assert.equal(findConnectableNodeAt(nodes, { x: 150, y: 94 }, ranks), null);
  // With padding: 10, the point is recognized, preventing hover flickering
  assert.equal(findConnectableNodeAt(nodes, { x: 150, y: 94 }, ranks, { padding: 10 })?.id, 'shape');
  // Point too far outside (> 10px) is not caught
  assert.equal(findConnectableNodeAt(nodes, { x: 150, y: 80 }, ranks, { padding: 10 }), null);
});
