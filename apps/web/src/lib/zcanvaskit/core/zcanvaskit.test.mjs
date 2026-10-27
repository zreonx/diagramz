import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ZCanvasDocumentSchema, hasEditableLabel, holdsAspect, isGeometricShape } from './schema.ts';
import { ZCanvasHistory } from './history.ts';

test('document schema fills document and viewport defaults', () => {
  assert.deepEqual(ZCanvasDocumentSchema.parse({}), {
    version: 1,
    nodes: [],
    edges: [],
    strokes: [],
    viewport: { zoom: 1, panX: 40, panY: 40 },
  });
});

test('document schema rejects malformed nodes', () => {
  assert.equal(
    ZCanvasDocumentSchema.safeParse({ nodes: [{ id: 'broken', type: 'unknown' }] }).success,
    false
  );
});

test('a freehand stroke keeps the pen settings it was drawn with', () => {
  const parsed = ZCanvasDocumentSchema.parse({
    strokes: [
      {
        id: 'stroke-1',
        points: [{ x: 0, y: 0 }],
        color: '#EF4444',
        width: 6,
        strokeStyle: 'dashed',
        opacity: 0.4,
      },
    ],
  });

  assert.equal(parsed.strokes[0].strokeStyle, 'dashed');
  assert.equal(parsed.strokes[0].opacity, 0.4);
});

test('a stroke written before the pen gained a dash style still parses', () => {
  const parsed = ZCanvasDocumentSchema.parse({
    strokes: [
      {
        id: 'stroke-legacy',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        color: '#635BFF',
        width: 3,
      },
    ],
  });

  // Absent, not defaulted to 'solid': nothing rewrites ink that predates the
  // field, and the renderer already treats an absent style as a solid line.
  assert.equal(parsed.strokes[0].strokeStyle, undefined);
  assert.equal(parsed.strokes[0].opacity, undefined);
});

test('an unknown dash style is rejected rather than silently dropped', () => {
  const result = ZCanvasDocumentSchema.safeParse({
    strokes: [{ id: 's', points: [], color: '#000', width: 1, strokeStyle: 'wavy' }],
  });

  assert.equal(result.success, false);
});

test('history snapshots are isolated from later mutations', () => {
  const history = new ZCanvasHistory();
  const state = { nodes: [{ x: 1 }] };

  history.push(state);
  state.nodes[0].x = 2;

  assert.deepEqual(history.undo({ nodes: [{ x: 3 }] }), { nodes: [{ x: 1 }] });
});

test('undo and redo move snapshots between stacks', () => {
  const history = new ZCanvasHistory();
  history.push({ value: 1 });

  assert.deepEqual(history.undo({ value: 2 }), { value: 1 });
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), true);
  assert.deepEqual(history.redo({ value: 1 }), { value: 2 });
  assert.equal(history.canUndo(), true);
  assert.equal(history.canRedo(), false);
});

test('pushing after undo clears the redo branch', () => {
  const history = new ZCanvasHistory();
  history.push({ value: 1 });
  history.undo({ value: 2 });

  history.push({ value: 3 });

  assert.equal(history.canRedo(), false);
});

test('history retains only the configured number of undo snapshots', () => {
  const history = new ZCanvasHistory(2);
  history.push(1);
  history.push(2);
  history.push(3);

  assert.equal(history.undo(4), 3);
  assert.equal(history.undo(3), 2);
  assert.equal(history.canUndo(), false);
});

test('clear drops undo and redo snapshots', () => {
  const history = new ZCanvasHistory();
  history.push(1);
  history.undo(2);
  history.clear();

  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);
});

test('the geometric shapes are the four outlines a diagram is built from', () => {
  for (const type of ['rectangle', 'circle', 'diamond', 'triangle']) {
    assert.equal(isGeometricShape(type), true, type);
  }
  // Everything that is *written on* rather than drawn.
  for (const type of ['card', 'table', 'container', 'text', undefined]) {
    assert.equal(isGeometricShape(type), false, String(type));
  }
});

test('a shape with no label is not a text target', () => {
  // The shape draws no text, so there is nothing to click into typing.
  assert.equal(hasEditableLabel({ type: 'rectangle', title: '' }), false);
  assert.equal(hasEditableLabel({ type: 'diamond', title: '' }), false);
});

test('a label a document already had stays editable', () => {
  // Documents written when shapes carried their own text — and every diagram
  // imported from Mermaid or the legacy format — keep their node names in
  // `title`, and that is the only copy of the name there is.
  assert.equal(hasEditableLabel({ type: 'rectangle', title: 'Auth service' }), true);
  assert.equal(hasEditableLabel({ type: 'triangle', title: 'Valid?' }), true);
});

test('every written node is a text target, labelled or not', () => {
  for (const type of ['card', 'table', 'container', 'text']) {
    assert.equal(hasEditableLabel({ type, title: '' }), true, type);
    assert.equal(hasEditableLabel({ type, title: 'Something' }), true, type);
  }
});

test('a drawn element keeps its shape when it is resized', () => {
  // A stencil's artwork is drawn uniform and centred in its node, so a box of a
  // different shape only widens the empty strip around the drawing: dragging
  // one side would grow padding rather than the picture.
  assert.equal(holdsAspect('svg'), true);
  assert.equal(holdsAspect('image'), true);

  // Everything else is drawn by the node itself, at whatever box it is given.
  for (const type of [
    'rectangle',
    'circle',
    'diamond',
    'triangle',
    'cylinder',
    'cloud',
    'card',
    'table',
    'container',
    'text',
    undefined,
  ]) {
    assert.equal(holdsAspect(type), false, String(type));
  }
});

test('a node keeps the angle it was turned to', () => {
  const parsed = ZCanvasDocumentSchema.parse({
    nodes: [
      { id: 'n1', type: 'rectangle', x: 0, y: 0, width: 40, height: 20, title: '', rotation: 45 },
    ],
  });

  assert.equal(parsed.nodes[0].rotation, 45);
});

test('a node written before it could turn parses as an upright one', () => {
  // Every diagram saved before nodes could turn carries no angle anywhere, and
  // has to keep loading. Absent rather than defaulted to 0, so a load-and-save
  // never rewrites a document that never had one.
  const parsed = ZCanvasDocumentSchema.parse({
    nodes: [{ id: 'n1', type: 'rectangle', x: 0, y: 0, width: 40, height: 20, title: '' }],
  });

  assert.equal(parsed.nodes[0].rotation, undefined);
});
