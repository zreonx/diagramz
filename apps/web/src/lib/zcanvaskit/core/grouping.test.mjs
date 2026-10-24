import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const {
  GROUP_FRAME_PADDING,
  activeGroupIdOf,
  canGroup,
  createGroupId,
  expandSelection,
  expandSelectionInContext,
  groupFrames,
  groupIdsOf,
  groupNodes,
  isGrouped,
  pruneEmptyGroupBoxes,
  pruneGroups,
  scaleNodesInBox,
  ungroupNodes,
} = await import('./grouping.ts');

/** A plain card, with only the fields the grouping rules look at. */
function card(id, x = 0, y = 0, extra = {}) {
  return { id, type: 'card', x, y, width: 100, height: 60, title: id, ...extra };
}

/** What each node belongs to, with an ungrouped node reading as none. */
const names = (nodes) => nodes.map(groupIdsOf);

test('grouping two elements adds no element', () => {
  const nodes = [card('a'), card('b')];
  const grouped = groupNodes(nodes, ['a', 'b'], 'g1');

  assert.equal(grouped.length, 2);
  assert.deepEqual(
    grouped.map((n) => n.type),
    ['card', 'card']
  );
  assert.deepEqual(names(grouped), [['g1'], ['g1']]);
  // Nothing but the group name changed: geometry, titles and every other field
  // are what they were, so grouping can never move or restyle anything.
  assert.deepEqual(
    grouped.map(({ groupIds, ...rest }) => rest),
    nodes
  );
});

test('grouping one element, or none, does nothing at all', () => {
  const nodes = [card('a'), card('b')];
  assert.equal(groupNodes(nodes, ['a'], 'g1'), nodes);
  assert.equal(groupNodes(nodes, [], 'g1'), nodes);
  assert.equal(groupNodes(nodes, ['missing'], 'g1'), nodes);
});

test('a member of a group cannot be grouped on its own', () => {
  const nodes = groupNodes([card('a'), card('b'), card('c')], ['a', 'b'], 'g1');
  const regrouped = groupNodes(nodes, ['a', 'c'], 'g2');

  // Grouping `a` took `b` with it, because a group is not divisible by Ctrl+G.
  assert.deepEqual(names(regrouped), [
    ['g1', 'g2'],
    ['g1', 'g2'],
    ['g2'],
  ]);
});

test('picking any member picks the whole group', () => {
  const nodes = groupNodes([card('a'), card('b'), card('c')], ['a', 'b'], 'g1');
  assert.deepEqual(expandSelection(nodes, ['b']), ['a', 'b']);
  assert.deepEqual(expandSelection(nodes, ['c']), ['c']);
  assert.deepEqual(expandSelection(nodes, []), []);
});

test('selection follows a group inside a group', () => {
  const inner = groupNodes([card('a'), card('b'), card('c')], ['a', 'b'], 'inner');
  const both = groupNodes(inner, ['a', 'c'], 'outer');

  // `a` reaches the inner group, the inner group reaches `b`, and the outer
  // group — which `a` is also a member of — reaches `c`.
  assert.deepEqual(expandSelection(both, ['a']), ['a', 'b', 'c']);
  assert.deepEqual(expandSelection(both, ['c']), ['a', 'b', 'c']);
});

test('ungrouping releases one level, from the outside in', () => {
  const inner = groupNodes([card('a'), card('b')], ['a', 'b'], 'inner');
  const nested = groupNodes([...inner, card('c')], ['a', 'c'], 'outer');

  const once = ungroupNodes(nested, ['a']);
  assert.deepEqual(names(once), [['inner'], ['inner'], []]);

  const twice = ungroupNodes(once, ['a']);
  assert.deepEqual(names(twice), [[], [], []]);
  // A node with no groups left carries no empty list: the key is gone.
  assert.equal('groupIds' in twice[0], false);
});

test('ungrouping a selection with nothing grouped changes nothing', () => {
  const nodes = [card('a'), card('b')];
  assert.equal(ungroupNodes(nodes, ['a']), nodes);
  assert.equal(ungroupNodes(nodes, []), nodes);
});

test('a group needs two elements to exist', () => {
  const nodes = groupNodes([card('a'), card('b')], ['a', 'b'], 'g1');
  assert.deepEqual(names(pruneGroups(nodes)), [['g1'], ['g1']]);

  // One member deleted: the survivor is not a group of one.
  const survivor = pruneGroups(nodes.slice(0, 1));
  assert.deepEqual(names(survivor), [[]]);
  assert.equal('groupIds' in survivor[0], false);
});

test('pruning leaves a document with no groups exactly as it was', () => {
  const nodes = [card('a'), card('b')];
  assert.equal(pruneGroups(nodes), nodes);
});

test('the frame covers every member, not only the selected ones', () => {
  const nodes = [card('a', 0, 0), card('b', 300, 200), card('c', 0, 0)];
  const grouped = groupNodes(nodes, ['a', 'b'], 'g1');

  const frames = groupFrames(grouped, ['a']);
  assert.deepEqual(frames, [
    {
      id: 'g1',
      box: {
        x: 0 - GROUP_FRAME_PADDING,
        y: 0 - GROUP_FRAME_PADDING,
        width: 400 + GROUP_FRAME_PADDING * 2,
        height: 260 + GROUP_FRAME_PADDING * 2,
      },
    },
  ]);
});

test('a selection with nothing grouped draws no frame', () => {
  const nodes = [card('a'), card('b')];
  assert.deepEqual(groupFrames(nodes, ['a', 'b']), []);
  assert.deepEqual(groupFrames(nodes, []), []);
});

test('a group of one draws no frame', () => {
  const grouped = groupNodes([card('a'), card('b')], ['a', 'b'], 'g1');
  assert.deepEqual(groupFrames(grouped.slice(0, 1), ['a']), []);
});

test('the menu offers grouping only when it would do something', () => {
  const nodes = [card('a'), card('b'), card('c')];
  assert.equal(canGroup(nodes, []), false);
  assert.equal(canGroup(nodes, ['a']), false);
  assert.equal(canGroup(nodes, ['a', 'b']), true);

  const grouped = groupNodes(nodes, ['a', 'b'], 'g1');
  // One member is a whole group's worth of grouping.
  assert.equal(canGroup(grouped, ['a']), true);
  assert.equal(isGrouped(grouped, ['a']), true);
  assert.equal(isGrouped(grouped, ['c']), false);
});

test('grouping no longer creates a container', () => {
  const nodes = [card('a'), card('b')];
  const grouped = groupNodes(nodes, ['a', 'b'], 'g1');

  // The bug this guards: grouping used to fit a `container` around the
  // selection, which came back looking like a VPC and survived into exports.
  assert.equal(grouped.some((n) => n.type === 'container'), false);
  assert.equal(grouped.some((n) => n.data !== undefined), false);
});

test('grouping never re-parents the selection into a container', () => {
  const vpc = { id: 'vpc', type: 'container', x: -50, y: -50, width: 400, height: 300, title: 'VPC' };
  const nodes = [vpc, card('a', 0, 0), card('b', 200, 100)];
  const grouped = groupNodes(nodes, ['a', 'b'], 'g1');

  assert.deepEqual(
    grouped.map((n) => n.parentId),
    [undefined, undefined, undefined]
  );
});

test('a group box an older editor left behind is swept up once it is empty', () => {
  const box = { id: 'group-box', type: 'container', x: 0, y: 0, width: 200, height: 200, title: 'Group', data: { groupBox: true } };
  const held = card('a', 10, 10, { parentId: 'group-box' });

  // Still holding a member: kept.
  const holding = pruneEmptyGroupBoxes([box, held]);
  assert.equal(holding.length, 2);

  // Released: gone.
  assert.deepEqual(pruneEmptyGroupBoxes([box, card('a', 10, 10)]), [
    card('a', 10, 10),
  ]);
});

test('a boundary the user drew is never removed, empty or not', () => {
  const vpc = { id: 'vpc', type: 'container', x: 0, y: 0, width: 300, height: 300, title: 'VPC' };
  const nodes = [vpc];
  assert.equal(pruneEmptyGroupBoxes(nodes), nodes);
});

test('group names minted in one millisecond do not collide', () => {
  // This used to be a loop of 200 bare calls, which passed or failed on the
  // birthday paradox: two draws in the same millisecond agreeing on four random
  // characters is about a one-in-eighty chance over 200 draws. The set is what
  // makes it deterministic — and what a paste of many groups actually needs,
  // since only one millisecond is available to mint all of them.
  const minted = new Set();
  for (let draw = 0; draw < 200; draw++) {
    const id = createGroupId(minted);
    assert.equal(minted.has(id), false, `draw ${draw} reused ${id}`);
    minted.add(id);
  }

  assert.equal(minted.size, 200);
});

test('group ids survive a round trip through the document schema', async () => {
  const { ZCanvasDocumentSchema } = await import('./schema.ts');
  const grouped = groupNodes([card('a'), card('b')], ['a', 'b'], 'g1');

  const parsed = ZCanvasDocumentSchema.parse({ nodes: grouped });
  const stored = JSON.parse(JSON.stringify(parsed));

  assert.deepEqual(stored.nodes.map((n) => n.groupIds), [['g1'], ['g1']]);
  assert.deepEqual(groupIdsOf(stored.nodes[0]), ['g1']);
});

test('activeGroupIdOf identifies governing group based on drill-down level', () => {
  const plain = card('a');
  assert.equal(activeGroupIdOf(plain, null), null);

  const singleGroup = card('b', 0, 0, { groupIds: ['g1'] });
  assert.equal(activeGroupIdOf(singleGroup, null), 'g1');
  assert.equal(activeGroupIdOf(singleGroup, 'g1'), null);

  // Nested groups: innermost first -> ['inner', 'outer']
  const nested = card('c', 0, 0, { groupIds: ['inner', 'outer'] });
  assert.equal(activeGroupIdOf(nested, null), 'outer');
  assert.equal(activeGroupIdOf(nested, 'outer'), 'inner');
  assert.equal(activeGroupIdOf(nested, 'inner'), null);
});

test('expandSelectionInContext selects whole group or drills down inside entered group', () => {
  const inner = groupNodes([card('a'), card('b')], ['a', 'b'], 'inner');
  const nested = groupNodes([...inner, card('c')], ['a', 'c'], 'outer');

  // Single-click without entered group: expands to entire outer group
  assert.deepEqual(expandSelectionInContext(nested, ['a'], null), ['a', 'b', 'c']);
  assert.deepEqual(expandSelectionInContext(nested, ['c'], null), ['a', 'b', 'c']);

  // Double-clicked to enter 'outer' group: selecting 'c' selects only 'c'
  assert.deepEqual(expandSelectionInContext(nested, ['c'], 'outer'), ['c']);
  // Selecting 'a' inside 'outer' selects its inner subgroup ['a', 'b']
  assert.deepEqual(expandSelectionInContext(nested, ['a'], 'outer'), ['a', 'b']);

  // Double-clicked into 'inner' group: selecting 'a' selects only 'a'
  assert.deepEqual(expandSelectionInContext(nested, ['a'], 'inner'), ['a']);
  assert.deepEqual(expandSelectionInContext(nested, ['b'], 'inner'), ['b']);
});

test('scaleNodesInBox proportionally scales and repositions nodes within box', () => {
  const a = card('a', 0, 0, { width: 100, height: 100 });
  const b = card('b', 100, 100, { width: 100, height: 100 });
  const nodes = [a, b];

  const oldBox = { x: 0, y: 0, width: 200, height: 200 };
  const newBox = { x: 50, y: 50, width: 400, height: 400 }; // 2x scale, offset by (50, 50)

  const originMap = new Map([
    ['a', a],
    ['b', b],
  ]);
  const scaled = scaleNodesInBox(nodes, originMap, oldBox, newBox);

  const scaledA = scaled.find((n) => n.id === 'a');
  const scaledB = scaled.find((n) => n.id === 'b');

  assert.equal(scaledA.x, 50);
  assert.equal(scaledA.y, 50);
  assert.equal(scaledA.width, 200);
  assert.equal(scaledA.height, 200);

  assert.equal(scaledB.x, 250);
  assert.equal(scaledB.y, 250);
  assert.equal(scaledB.width, 200);
  assert.equal(scaledB.height, 200);
});
