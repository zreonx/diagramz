import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const { createIdFactory, createShapeNode, placeDragItem, SHAPE_DEFAULTS } = await import(
  './placement.ts'
);
const { ARCHITECTURE_STENCIL_META } = await import('./architecture.ts');
const { TECH_ICON_STENCILS } = await import('./tech-icons.ts');

/** A deterministic id source, so a test can name the ids it expects. */
function ids() {
  let n = 0;
  return (prefix) => `${prefix}#${++n}`;
}

const at = (x = 100, y = 200) => ({ x, y, createId: ids() });

test('a shape tool lands a real shape, not an empty svg node', () => {
  // A standard-shape drag used to fall through every library branch and reach
  // the element-array fallback, which drew nothing: a blank box on the canvas.
  const placement = placeDragItem({ kind: 'tool', tool: 'cylinder' }, at());

  assert.equal(placement.nodes.length, 1);
  assert.equal(placement.nodes[0].type, 'cylinder');
});

test('a shape lands centred on the drop point', () => {
  const { width, height } = SHAPE_DEFAULTS.rectangle;
  const placement = placeDragItem({ kind: 'tool', tool: 'rectangle' }, at(400, 300));
  const node = placement.nodes[0];

  assert.equal(node.x, 400 - width / 2);
  assert.equal(node.y, 300 - height / 2);
  assert.equal(node.width, width);
  assert.equal(node.height, height);
});

test('a shape payload can carry its own size', () => {
  const placement = placeDragItem(
    { kind: 'tool', tool: 'cloud', width: 300, height: 150 },
    at(0, 0)
  );

  assert.equal(placement.nodes[0].width, 300);
  assert.equal(placement.nodes[0].height, 150);
  assert.equal(placement.nodes[0].x, -150, 'the size decides the centring');
});

test('every shape tool round-trips to its own node type', () => {
  for (const tool of Object.keys(SHAPE_DEFAULTS)) {
    const placement = placeDragItem({ kind: 'tool', tool }, at());
    assert.equal(placement.nodes[0].type, tool, tool);
  }
});

test('dropping text selects it and opens its label for editing', () => {
  const placement = placeDragItem({ kind: 'tool', tool: 'text' }, at());
  const node = placement.nodes[0];

  assert.equal(node.type, 'text');
  assert.deepEqual(placement.selectedIds, [node.id]);
  assert.equal(placement.startTextEditId, node.id);
});

test('a non-text tool does not open an editor', () => {
  assert.equal(placeDragItem({ kind: 'tool', tool: 'circle' }, at()).startTextEditId, undefined);
});

test('a container goes beneath what is already on the canvas', () => {
  // A boundary has to paint behind its contents, so it is prepended rather than
  // appended. Everything else lands on top.
  assert.equal(placeDragItem({ kind: 'tool', tool: 'container' }, at()).prepend, true);
  assert.equal(placeDragItem({ kind: 'tool', tool: 'table' }, at()).prepend, false);
  assert.equal(placeDragItem({ kind: 'tool', tool: 'service' }, at()).prepend, false);
});

test('a component tool lands the node kind its tool names', () => {
  assert.equal(placeDragItem({ kind: 'tool', tool: 'service' }, at()).nodes[0].type, 'card');
  assert.equal(placeDragItem({ kind: 'tool', tool: 'table' }, at()).nodes[0].type, 'table');
  assert.equal(placeDragItem({ kind: 'tool', tool: 'container' }, at()).nodes[0].type, 'container');
});

test('a table tool lands with its starter columns', () => {
  const node = placeDragItem({ kind: 'tool', tool: 'table' }, at()).nodes[0];

  assert.ok(Array.isArray(node.fields) && node.fields.length > 0);
});

test('a registry stencil is placed and records its id', () => {
  const meta = ARCHITECTURE_STENCIL_META[0];
  const placement = placeDragItem({ kind: 'stencil', stencilId: meta.id }, at());
  const node = placement.nodes[0];

  assert.equal(node.type, 'svg');
  assert.equal(node.data.stencilId, meta.id);
});

test('an architecture stencil also records the field older documents use', () => {
  // `archId` is what every diagram saved before this module carries, so it is
  // written alongside the new name rather than instead of it.
  const meta = ARCHITECTURE_STENCIL_META[0];
  assert.ok(meta.id.startsWith('arch-'), 'this test assumes an architecture id');

  const node = placeDragItem({ kind: 'stencil', stencilId: meta.id }, at()).nodes[0];

  assert.equal(node.data.archId, meta.id);
});

test('a tech logo does not claim to be an architecture stencil', () => {
  const logo = TECH_ICON_STENCILS[0];
  const node = placeDragItem({ kind: 'stencil', stencilId: logo.id }, at()).nodes[0];

  assert.equal(node.data.stencilId, logo.id);
  assert.equal(node.data.archId, undefined);
});

test('a stencil with no size of its own takes the registry default', () => {
  const logo = TECH_ICON_STENCILS[0];
  const node = placeDragItem({ kind: 'stencil', stencilId: logo.id }, at()).nodes[0];

  assert.equal(node.width, logo.defaultWidth);
  assert.equal(node.height, logo.defaultHeight);
});

test('a stencil naming an id the registry does not know places nothing', () => {
  assert.equal(placeDragItem({ kind: 'stencil', stencilId: 'arch-nope' }, at()), null);
});

test('artwork carried by the payload is used even for an unknown id', () => {
  // The sender had the artwork in hand, so a lookup would only substitute
  // whatever the registry holds under that id today.
  const placement = placeDragItem(
    { kind: 'stencil', stencilId: 'arch-nope', svgPath: 'M0 0h24v24H0z', width: 40, height: 40 },
    at()
  );
  const node = placement.nodes[0];

  assert.equal(node.data.svgPath, 'M0 0h24v24H0z');
  assert.equal(node.data.stencilId, 'arch-nope');
  assert.equal(node.width, 40);
});

test('an element array is placed as artwork, not as an empty node', () => {
  const elements = [{ type: 'rectangle', x: 0, y: 0, width: 10, height: 10 }];
  const node = placeDragItem({ kind: 'stencil', elements }, at()).nodes[0];

  assert.deepEqual(node.data.elements, elements);
  assert.equal(node.type, 'svg');
});

test('an element array with no id still places, and records no stencil id', () => {
  const node = placeDragItem({ kind: 'stencil', elements: [{ type: 'rectangle' }] }, at())
    .nodes[0];

  assert.equal(node.data.stencilId, undefined);
});

test('a colour on the payload reaches the node, so a logo keeps its brand', () => {
  const node = placeDragItem(
    { kind: 'stencil', svgPath: 'M0 0h1v1H0z', color: '#4169E1' },
    at()
  ).nodes[0];

  assert.equal(node.data.color, '#4169E1');
});

test('a stencil with neither artwork nor a known id places nothing', () => {
  assert.equal(placeDragItem({ kind: 'stencil', title: 'Mystery' }, at()), null);
});

test('a pattern places every node and re-points every connector', () => {
  // The regression this locks: the canvas remapped `from`/`to`, which the
  // panel has never written, so a dropped pattern arrived with no connectors.
  const placement = placeDragItem(
    {
      kind: 'pattern',
      pattern: {
        title: 'Two Tier',
        nodes: [
          { id: 'a', type: 'card', title: 'A', x: 0, y: 0, width: 200, height: 76 },
          { id: 'b', type: 'card', title: 'B', x: 260, y: 0, width: 200, height: 76 },
        ],
        edges: [{ id: 'e1', source: 'a', target: 'b', label: 'HTTPS', color: '#3b82f6' }],
      },
    },
    at(500, 400)
  );

  assert.equal(placement.nodes.length, 2);
  assert.equal(placement.edges.length, 1, 'the connector survived the drop');

  const [first, second] = placement.nodes;
  assert.equal(placement.edges[0].source, first.id);
  assert.equal(placement.edges[0].target, second.id);
  assert.equal(placement.edges[0].label, 'HTTPS');
  assert.equal(placement.edges[0].color, '#3b82f6');
  assert.equal(placement.edges[0].style, 'bezier');
});

test('a pattern keeps its own layout, offset to the drop point', () => {
  const placement = placeDragItem(
    {
      kind: 'pattern',
      pattern: {
        title: 'Pair',
        nodes: [
          { id: 'a', type: 'card', title: 'A', x: 0, y: 0, width: 200, height: 76 },
          { id: 'b', type: 'card', title: 'B', x: 260, y: 40, width: 200, height: 76 },
        ],
        edges: [{ id: 'e1', source: 'a', target: 'b' }],
      },
    },
    at(500, 400)
  );

  assert.deepEqual(
    placement.nodes.map((n) => [n.x, n.y]),
    [
      [500, 400],
      [760, 440],
    ]
  );
});

test('a pattern carries its node styling and leaves the selection alone', () => {
  const placement = placeDragItem(
    {
      kind: 'pattern',
      pattern: {
        title: 'Pair',
        nodes: [
          {
            id: 'a',
            type: 'card',
            title: 'A',
            subtitle: 'sub',
            badge: 'Badge',
            icon: 'server',
            color: '#10b981',
            x: 0,
            y: 0,
            width: 200,
            height: 76,
          },
        ],
        edges: [],
      },
    },
    at()
  );

  assert.deepEqual(placement.selectedIds, [], 'a cluster is not one thing to select');
  assert.equal(placement.nodes[0].subtitle, 'sub');
  assert.equal(placement.nodes[0].badge, 'Badge');
  assert.equal(placement.nodes[0].icon, 'server');
  assert.equal(placement.nodes[0].color, '#10b981');
});

test('a pattern edge whose ends are not in the pattern is not placed', () => {
  const placement = placeDragItem(
    {
      kind: 'pattern',
      pattern: {
        title: 'Broken',
        nodes: [{ id: 'a', type: 'card', title: 'A', x: 0, y: 0, width: 200, height: 76 }],
        edges: [{ id: 'e1', source: 'a', target: 'ghost' }],
      },
    },
    at()
  );

  assert.deepEqual(placement.edges, []);
});

test('an empty pattern places nothing', () => {
  assert.equal(placeDragItem({ kind: 'pattern', pattern: { title: 'Empty', nodes: [], edges: [] } }, at()), null);
});

test('a placement never reuses an id already in the document', () => {
  // Dropping the same tile twice has to produce two nodes, not one that
  // silently swallows the other. The collision is staged with a pinned clock,
  // because it is the same millisecond that makes the two ids equal.
  const now = () => 1_700_000_000_000;
  const mint = createIdFactory({ now });
  const taken = new Set([mint('card'), mint('card')]);
  assert.equal(taken.size, 2, 'the two staged ids are the ones that collide');

  const createId = createIdFactory({ existing: taken, now });
  const first = createId('card');
  const second = createId('card');

  assert.equal(taken.has(first), false, 'the taken ids were stepped over');
  assert.equal(taken.has(second), false);
  assert.notEqual(first, second);
});

test('the default id source marks the time and stays monotonic', () => {
  // A pattern places a dozen nodes inside one millisecond, so the timestamp
  // alone would collide.
  const createId = createIdFactory({ now: () => 1_700_000_000_000 });
  const minted = Array.from({ length: 50 }, () => createId('card'));

  assert.equal(new Set(minted).size, 50);
});

test('a lone component lands centred, on its own, with no connectors', () => {
  // A flow component dragged out of the panel is placed as an independent,
  // un-grouped, un-connected node — never as a cluster of one.
  const placement = placeDragItem(
    {
      kind: 'node',
      node: {
        id: 'flow-queue',
        type: 'card',
        title: 'Queue',
        subtitle: 'Kafka',
        badge: 'Stream',
        icon: 'server',
        color: '#f59e0b',
        x: 0,
        y: 0,
        width: 210,
        height: 76,
      },
    },
    at(500, 400)
  );

  assert.equal(placement.nodes.length, 1);
  assert.deepEqual(placement.edges, []);
  assert.equal(placement.nodes[0].x, 500 - 105);
  assert.equal(placement.nodes[0].y, 400 - 38);
  assert.deepEqual(placement.selectedIds, [placement.nodes[0].id]);
  assert.equal(placement.nodes[0].subtitle, 'Kafka');
  assert.equal(placement.nodes[0].color, '#f59e0b');
  assert.equal(placement.prepend, false);
});

test('a lone container is prepended, so it paints behind what it encloses', () => {
  const placement = placeDragItem(
    { kind: 'node', node: { id: 'vpc', type: 'container', title: 'VPC' } },
    at()
  );

  assert.equal(placement.prepend, true);
});

test('a stencil dropped from the library lands as its drawing and nothing else', () => {
  // The regression this locks: the panel sent the catalogue title on the
  // payload, and a payload title is the name a node lands with, so every
  // dropped shape arrived captioned after the library entry it came from.
  const meta = ARCHITECTURE_STENCIL_META[0];
  const node = placeDragItem(
    { kind: 'stencil', stencilId: meta.id, category: meta.category },
    at()
  ).nodes[0];

  assert.equal(node.title, '');
  // Still identifiable as a stencil, and still drawn: unnamed, not anonymous.
  assert.equal(node.data.stencilId, meta.id);
  assert.equal(node.data.title, meta.title, 'the record keeps the stencil it is');
});

test('a payload that does name a stencil still names it', () => {
  // The engine's contract is unchanged — a host that hands over a title gets a
  // captioned node. It is the library that sends none.
  const meta = ARCHITECTURE_STENCIL_META[0];
  const node = placeDragItem(
    { kind: 'stencil', stencilId: meta.id, title: 'Primary database' },
    at()
  ).nodes[0];

  assert.equal(node.title, 'Primary database');
  assert.equal(node.data.title, 'Primary database');
});

test('a lone node keeps whatever name the payload gave it, and nothing else', () => {
  // A placement reports nodes, not a summary of them. A host that wants to say
  // what landed reads the node it just placed; nothing is invented for it here.
  const named = placeDragItem({ kind: 'node', node: { id: 'q', type: 'card', title: 'Queue' } }, at());
  assert.equal(named.nodes[0].title, 'Queue');

  const anonymous = placeDragItem(
    { kind: 'node', node: { id: 'anon', type: 'card', title: '' } },
    at()
  );
  assert.equal(anonymous.nodes[0].title, '');
});

test('a shape node built for click-to-draw takes an id when one is offered', () => {
  const box = { x: 0, y: 0, width: 10, height: 10 };

  assert.equal(createShapeNode('circle', box, 'circle#9').id, 'circle#9');
  assert.match(createShapeNode('circle', box).id, /^circle-/);
});

test('a shape node carries no appearance, so Reset has something to restore to', () => {
  const node = createShapeNode('diamond', { x: 1, y: 2, width: 3, height: 4 }, 'd#1');

  assert.deepEqual(node, {
    id: 'd#1',
    type: 'diamond',
    x: 1,
    y: 2,
    width: 3,
    height: 4,
    title: '',
  });
});

test('a placement names every node it created, uniquely', () => {
  const placement = placeDragItem(
    {
      kind: 'pattern',
      pattern: {
        title: 'Many',
        nodes: [
          { id: 'a', type: 'card', title: 'A', x: 0, y: 0, width: 10, height: 10 },
          { id: 'a', type: 'card', title: 'A again', x: 20, y: 0, width: 10, height: 10 },
        ],
        edges: [{ id: 'e1', source: 'a', target: 'a' }],
      },
    },
    at()
  );

  const ids = placement.nodes.map((n) => n.id);
  assert.equal(new Set(ids).size, 2, 'two nodes sharing a pattern id still differ');
  assert.equal(placement.edges[0].source, placement.edges[0].target);
});

test('an image payload lands an image node with its source and centred box', () => {
  const placement = placeDragItem(
    {
      kind: 'image',
      src: 'data:image/svg+xml,<svg></svg>',
      title: 'App Logo',
      width: 120,
      height: 80,
    },
    at(500, 400)
  );

  assert.equal(placement.nodes.length, 1);
  const node = placement.nodes[0];
  assert.equal(node.type, 'image');
  assert.equal(node.title, 'App Logo');
  assert.equal(node.width, 120);
  assert.equal(node.height, 80);
  assert.equal(node.x, 500 - 60);
  assert.equal(node.y, 400 - 40);
  assert.equal(node.data?.src, 'data:image/svg+xml,<svg></svg>');
  assert.deepEqual(placement.selectedIds, [node.id]);
});
