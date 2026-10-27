import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const {
  ZCANVAS_ITEM_MIME,
  ZCANVAS_LEGACY_MIMES,
  ZCANVAS_TOOL_NAMES,
  hasDragItem,
  isShapeTool,
  isToolName,
  readDragItem,
  writeDragItem,
} = await import('./drag-payload.ts');

/** The slice of `DataTransfer` the protocol uses, without a browser. */
function transfer(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get types() {
      return [...store.keys()];
    },
    getData: (format) => store.get(format) ?? '',
    setData: (format, data) => {
      store.set(format, data);
    },
    effectAllowed: 'none',
  };
}

const TRANSFER_LIMIT_EXCEEDED = 'M0 0'.repeat(2 * 1024 * 1024);

test('a tool payload survives a write and a read', () => {
  const dt = transfer();
  writeDragItem(dt, { kind: 'tool', tool: 'cylinder', width: 120, height: 90 });

  assert.deepEqual(readDragItem(dt), {
    kind: 'tool',
    tool: 'cylinder',
    width: 120,
    height: 90,
  });
});

test('a stencil payload survives a write and a read', () => {
  const dt = transfer();
  const item = {
    kind: 'stencil',
    stencilId: 'arch-load-balancer',
    title: 'Load Balancer',
    category: 'Networking',
    accentColor: '#3b82f6',
    width: 90,
    height: 90,
  };
  writeDragItem(dt, item);

  assert.deepEqual(readDragItem(dt), item);
});

test('a pattern payload survives a write and a read, connectors included', () => {
  const dt = transfer();
  writeDragItem(dt, {
    kind: 'pattern',
    pattern: {
      id: 'p1',
      title: 'Two Tier',
      nodes: [
        { id: 'a', type: 'card', title: 'A', x: 0, y: 0, width: 200, height: 76 },
        { id: 'b', type: 'card', title: 'B', x: 260, y: 0, width: 200, height: 76 },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', label: 'HTTPS' }],
    },
  });

  const item = readDragItem(dt);
  assert.equal(item.kind, 'pattern');
  assert.equal(item.pattern.id, 'p1');
  assert.equal(item.pattern.nodes.length, 2);
  // Key for key: a payload read back is the payload that went in, so a caller
  // cannot tell how the drag was spelled from the shape of the result.
  assert.deepEqual(item.pattern.edges[0], { id: 'e1', source: 'a', target: 'b', label: 'HTTPS' });
});

test('writing offers a copy', () => {
  const dt = transfer();
  writeDragItem(dt, { kind: 'tool', tool: 'text' });

  assert.equal(dt.effectAllowed, 'copy');
});

test('a payload over the browser limit is refused rather than truncated', () => {
  // `setData` silently drops anything past 8 MB, which would hand the drop
  // handler a truncated string. Failing here surfaces it at the drag instead.
  const dt = transfer();

  assert.throws(
    () =>
      writeDragItem(dt, {
        kind: 'stencil',
        svgPath: TRANSFER_LIMIT_EXCEEDED,
      }),
    /8 MB/
  );
  assert.equal(readDragItem(dt), null, 'nothing was written');
});

test('the drag is recognised from its types alone, without reading the payload', () => {
  // Browsers blank `getData` during `dragover`, which is exactly where the drop
  // has to be accepted, so `types` is all that is available there.
  const dt = transfer();
  writeDragItem(dt, { kind: 'tool', tool: 'rectangle' });
  dt.getData = () => {
    throw new Error('dragover must not read the payload');
  };

  assert.equal(hasDragItem(dt), true);
});

test('the drag is not recognised when the types belong to someone else', () => {
  assert.equal(hasDragItem(transfer({ 'text/plain': 'hello' })), false);
  assert.equal(hasDragItem(transfer({ 'Files': '' })), false);
});

test('a missing or empty data transfer is not a drag of ours', () => {
  assert.equal(hasDragItem(null), false);
  assert.equal(hasDragItem(undefined), false);
  assert.equal(hasDragItem({ types: [] }), false);
});

test('every legacy mimetype is still recognised', () => {
  for (const mime of ZCANVAS_LEGACY_MIMES) {
    assert.equal(hasDragItem(transfer({ [mime]: 'x' })), true, mime);
  }
});

test('a node payload survives a write and a read', () => {
  const dt = transfer();
  const node = {
    id: 'flow-queue',
    type: 'card',
    title: 'Queue',
    subtitle: 'Kafka',
    badge: 'Stream',
    icon: 'server',
    x: 0,
    y: 0,
    width: 210,
    height: 76,
    color: '#f59e0b',
  };
  writeDragItem(dt, { kind: 'node', node });

  assert.deepEqual(readDragItem(dt), { kind: 'node', node });
});

test('a node payload naming a node with no id or type reads as nothing', () => {
  // Placement would otherwise have to invent both, and an unnamed node gives
  // the user nothing to grab.
  const noType = transfer({
    [ZCANVAS_ITEM_MIME]: JSON.stringify({ kind: 'node', node: { id: 'a', title: 'A' } }),
  });
  const noId = transfer({
    [ZCANVAS_ITEM_MIME]: JSON.stringify({ kind: 'node', node: { type: 'card', title: 'A' } }),
  });
  const notANode = transfer({
    [ZCANVAS_ITEM_MIME]: JSON.stringify({ kind: 'node', node: 'card' }),
  });

  assert.equal(readDragItem(noType), null);
  assert.equal(readDragItem(noId), null);
  assert.equal(readDragItem(notANode), null);
});

test('a payload that is not JSON, or not an object, reads as nothing', () => {
  assert.equal(readDragItem(transfer({ [ZCANVAS_ITEM_MIME]: 'not json' })), null);
  assert.equal(readDragItem(transfer({ [ZCANVAS_ITEM_MIME]: '"a string"' })), null);
  assert.equal(readDragItem(transfer({ [ZCANVAS_ITEM_MIME]: '[]' })), null);
  assert.equal(readDragItem(transfer()), null);
});

test('a payload with an unknown kind reads as nothing', () => {
  const dt = transfer({
    [ZCANVAS_ITEM_MIME]: JSON.stringify({ kind: 'sandwich', filling: 'cheese' }),
  });

  assert.equal(readDragItem(dt), null);
});

test('a payload naming a tool that does not exist reads as nothing', () => {
  const dt = transfer({
    [ZCANVAS_ITEM_MIME]: JSON.stringify({ kind: 'tool', tool: 'nonexistent-shape' }),
  });

  assert.equal(readDragItem(dt), null);
});

test('a stencil payload with no artwork and no id reads as nothing', () => {
  // Placing it would put an empty node on the canvas.
  const dt = transfer({
    [ZCANVAS_ITEM_MIME]: JSON.stringify({ kind: 'stencil', title: 'Mystery' }),
  });

  assert.equal(readDragItem(dt), null);
});

test('the legacy toolbar payload becomes a tool', () => {
  // The bare mimetype carried the tool name and nothing else, so the payload
  // that comes back carries the tool name and nothing else.
  const dt = transfer({ 'application/zcanvas-item': 'triangle' });

  assert.deepEqual(readDragItem(dt), { kind: 'tool', tool: 'triangle' });
});

test('a legacy toolbar payload naming an unknown tool reads as nothing', () => {
  assert.equal(readDragItem(transfer({ 'application/zcanvas-item': 'octagon' })), null);
});

test('a legacy architecture payload becomes a stencil', () => {
  const dt = transfer({
    'application/diagramz-library-item': JSON.stringify({
      archId: 'arch-vpc',
      title: 'Virtual Private Cloud',
      category: 'Containers',
      accentColor: '#8b5cf6',
      width: 90,
      height: 90,
    }),
  });

  assert.deepEqual(readDragItem(dt), {
    kind: 'stencil',
    stencilId: 'arch-vpc',
    title: 'Virtual Private Cloud',
    category: 'Containers',
    accentColor: '#8b5cf6',
    width: 90,
    height: 90,
  });
});

test('a legacy shape payload becomes a tool, so it lands a real shape', () => {
  const dt = transfer({
    'application/diagramz-library-item': JSON.stringify({
      id: 'shape-cloud',
      type: 'cloud',
      title: '',
      width: 180,
      height: 110,
    }),
  });

  assert.deepEqual(readDragItem(dt), {
    kind: 'tool',
    tool: 'cloud',
    width: 180,
    height: 110,
  });
});

test('a legacy tech payload keeps the brand colour it spelled as `hex`', () => {
  // The old panel wrote `hex` and every reader looked for `color`, so a logo
  // always drew in the theme ink. `color` is the one name now.
  const dt = transfer({
    'application/diagramz-library-item': JSON.stringify({
      id: 'postgres',
      cleanName: 'PostgreSQL',
      svgPath: 'M0 0h24v24H0z',
      hex: '#4169E1',
      viewBox: '0 0 24 24',
      width: 80,
      height: 80,
    }),
  });

  const item = readDragItem(dt);
  assert.equal(item.kind, 'stencil');
  assert.equal(item.color, '#4169E1');
  assert.equal(item.stencilId, 'postgres');
  assert.equal(item.title, 'PostgreSQL');
});

test('a legacy element-array payload becomes a stencil with its artwork', () => {
  const elements = [{ type: 'rectangle', x: 0, y: 0, width: 10, height: 10 }];
  const dt = transfer({
    'application/diagramz-library-item': JSON.stringify({
      id: 'sketch-1',
      cleanName: 'Sketch',
      elements,
      libraryName: 'Community',
      author: 'Someone',
      width: 120,
      height: 100,
    }),
  });

  const item = readDragItem(dt);
  assert.equal(item.kind, 'stencil');
  assert.deepEqual(item.elements, elements);
  assert.equal(item.libraryName, 'Community');
  assert.equal(item.author, 'Someone');
});

test('a legacy library payload that is none of the four kinds reads as nothing', () => {
  const dt = transfer({
    'application/diagramz-library-item': JSON.stringify({ id: 'x', title: 'y' }),
  });

  assert.equal(readDragItem(dt), null);
});

test('a legacy pattern payload becomes a pattern', () => {
  const dt = transfer({
    'application/diagramz-pattern': JSON.stringify({
      id: 'p1',
      title: '3-Tier',
      nodes: [{ id: 'a', type: 'card', title: 'A', x: 0, y: 0, width: 200, height: 76 }],
      edges: [],
    }),
  });

  const item = readDragItem(dt);
  assert.equal(item.kind, 'pattern');
  assert.equal(item.pattern.title, '3-Tier');
  assert.equal(item.pattern.nodes.length, 1);
});

test('a legacy pattern payload using from/to is understood', () => {
  // The canvas used to read `from`/`to` here; the panel has only ever written
  // `source`/`target`. Accepting both is what stops a pattern arriving bare.
  const dt = transfer({
    'application/diagramz-pattern': JSON.stringify({
      title: 'Old',
      nodes: [
        { id: 'a', type: 'card', title: 'A', x: 0, y: 0, width: 200, height: 76 },
        { id: 'b', type: 'card', title: 'B', x: 300, y: 0, width: 200, height: 76 },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b' }],
    }),
  });

  const item = readDragItem(dt);
  assert.equal(item.pattern.edges.length, 1);
  assert.equal(item.pattern.edges[0].source, 'a');
  assert.equal(item.pattern.edges[0].target, 'b');
});

test('a pattern edge pointing outside the pattern is dropped', () => {
  const dt = transfer({
    'application/diagramz-pattern': JSON.stringify({
      title: 'Broken',
      nodes: [{ id: 'a', type: 'card', title: 'A', x: 0, y: 0, width: 200, height: 76 }],
      edges: [{ id: 'e1', source: 'a', target: 'ghost' }],
    }),
  });

  const item = readDragItem(dt);
  assert.deepEqual(item.pattern.edges, []);
  assert.equal(item.pattern.nodes.length, 1, 'the node itself is still placeable');
});

test('a pattern with no nodes at all reads as nothing', () => {
  const dt = transfer({
    'application/diagramz-pattern': JSON.stringify({ title: 'Empty', nodes: [], edges: [] }),
  });

  assert.equal(readDragItem(dt), null);
});

test('a pattern node missing its id or type is skipped, not fatal', () => {
  const dt = transfer({
    'application/diagramz-pattern': JSON.stringify({
      title: 'Partly broken',
      nodes: [
        { id: 'a', type: 'card', title: 'A', x: 0, y: 0, width: 200, height: 76 },
        { id: 'b', title: 'no type', x: 300, y: 0 },
        null,
      ],
      edges: [],
    }),
  });

  assert.equal(readDragItem(dt).pattern.nodes.length, 1);
});

test('the modern payload wins over a legacy one on the same drag', () => {
  const dt = transfer({
    [ZCANVAS_ITEM_MIME]: JSON.stringify({ kind: 'tool', tool: 'circle' }),
    'application/zcanvas-item': 'rectangle',
  });

  assert.equal(readDragItem(dt).tool, 'circle');
});

test('the tool vocabulary is the shapes and components', () => {
  assert.deepEqual(ZCANVAS_TOOL_NAMES, [
    'rectangle',
    'circle',
    'diamond',
    'triangle',
    'cylinder',
    'cloud',
    'document',
    'parallelogram',
    'hexagon',
    'subroutine',
    'rounded-rectangle',
    'actor',
    'cube',
    'step',
    'callout',
    'trapezoid',
    'internal-storage',
    'star',
    'text',
    'service',
    'table',
    'container',
    'frame',
    'sticky-note',
  ]);
});

test('telling a shape from a component tool is exact', () => {
  for (const tool of [
    'rectangle',
    'circle',
    'diamond',
    'triangle',
    'cylinder',
    'cloud',
    'document',
    'parallelogram',
    'hexagon',
    'subroutine',
    'rounded-rectangle',
    'actor',
    'cube',
    'step',
    'callout',
    'trapezoid',
    'internal-storage',
    'star',
  ]) {
    assert.equal(isShapeTool(tool), true, tool);
  }
  for (const tool of ['text', 'service', 'table', 'container', 'select', 'pen', '']) {
    assert.equal(isShapeTool(tool), false, tool);
  }
  assert.equal(isToolName('table'), true);
  assert.equal(isToolName('nonexistent-shape'), false);
  assert.equal(isToolName(7), false);
});

test('a shape payload carries an optional size and nothing else', () => {
  const dt = transfer();
  writeDragItem(dt, { kind: 'tool', tool: 'circle' });

  assert.deepEqual(readDragItem(dt), { kind: 'tool', tool: 'circle' });
});

test('an image payload survives a write and a read', () => {
  const dt = transfer();
  const item = {
    kind: 'image',
    src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    title: 'Custom Brand Icon',
    width: 140,
    height: 140,
  };
  writeDragItem(dt, item);

  assert.deepEqual(readDragItem(dt), item);
});
