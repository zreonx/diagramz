import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../../test/register-ts-resolver.mjs';

// `./index.ts` reaches `../schema` without a file extension, which Node cannot
// resolve on its own.
registerTsResolver();

const {
  copySelection,
  duplicateSelection,
  getInternalClipboard,
  pasteClipboard,
  setInternalClipboard,
} = await import('./index.ts');

/** A document holding one shape and one freehand stroke beside it. */
function makeDoc() {
  return {
    version: 1,
    nodes: [
      { id: 'n1', type: 'rectangle', x: 0, y: 0, width: 100, height: 60, title: 'Box' },
      { id: 'n2', type: 'circle', x: 300, y: 0, width: 60, height: 60, title: 'Dot' },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
    ],
    strokes: [
      {
        id: 'ink1',
        points: [
          { x: 10, y: 10 },
          { x: 60, y: 40 },
        ],
        color: '#635BFF',
        width: 3,
      },
      {
        id: 'ink2',
        points: [
          { x: 400, y: 400 },
          { x: 450, y: 400 },
        ],
        color: '#EF4444',
        width: 6,
      },
    ],
    viewport: { zoom: 1, panX: 0, panY: 0 },
  };
}

test('an empty selection copies nothing at all', () => {
  const doc = makeDoc();
  assert.equal(copySelection(doc, []), null);
  assert.equal(copySelection(doc, [], []), null);
});

test('ink alone is a copyable selection', () => {
  const doc = makeDoc();
  const payload = copySelection(doc, [], ['ink1']);

  assert.ok(payload);
  assert.deepEqual(payload.strokes.map((s) => s.id), ['ink1']);
  // No shapes were named, so none travel.
  assert.deepEqual(payload.nodes, []);
});

test('selecting one stroke does not pick up the others', () => {
  const doc = makeDoc();
  const payload = copySelection(doc, [], ['ink2']);
  assert.deepEqual(payload.strokes.map((s) => s.id), ['ink2']);
});

test('a shape and the ink beside it copy together, in one payload', () => {
  const doc = makeDoc();
  const payload = copySelection(doc, ['n1', 'n2'], ['ink1', 'ink2']);

  assert.deepEqual(payload.nodes.map((n) => n.id), ['n1', 'n2']);
  assert.deepEqual(payload.strokes.map((s) => s.id), ['ink1', 'ink2']);
  // Both ends of the connector travelled, so it comes too.
  assert.deepEqual(payload.edges.map((e) => e.id), ['e1']);
});

test('the clipboard is a snapshot, not a live view of the document', () => {
  const doc = makeDoc();
  copySelection(doc, ['n1'], ['ink1']);

  // Editing the document afterwards must not reach into the copied payload.
  doc.nodes[0].x = 9999;
  doc.strokes[0].points[0].x = 9999;

  const pasted = pasteClipboard(doc, { x: 0, y: 0 });
  assert.equal(pasted.newNodes[pasted.newNodes.length - 1].x, 0);
  assert.equal(pasted.newStrokes[pasted.newStrokes.length - 1].points[0].x, 10);
});

test('pasting offsets the ink by the same delta as the shapes', () => {
  const doc = makeDoc();
  copySelection(doc, ['n1'], ['ink1']);

  const pasted = pasteClipboard(doc, { x: 50, y: 20 });
  assert.ok(pasted);

  const pastedStroke = pasted.newStrokes[pasted.newStrokes.length - 1];
  assert.deepEqual(pastedStroke.points, [
    { x: 60, y: 30 },
    { x: 110, y: 60 },
  ]);

  const pastedNode = pasted.newNodes[pasted.newNodes.length - 1];
  assert.equal(pastedNode.x, 50);
  assert.equal(pastedNode.y, 20);
});

test('pasted ink gets a fresh identity and a stroke id to select', () => {
  const doc = makeDoc();
  copySelection(doc, [], ['ink1']);

  const pasted = pasteClipboard(doc, { x: 30, y: 30 });
  assert.equal(pasted.pastedStrokeIds.length, 1);

  const newId = pasted.pastedStrokeIds[0];
  assert.notEqual(newId, 'ink1');
  assert.ok(pasted.newStrokes.some((s) => s.id === newId));

  // The originals are still there: a paste adds, it does not replace.
  assert.equal(pasted.newStrokes.length, doc.strokes.length + 1);
  assert.deepEqual(pasted.newStrokes.slice(0, 2).map((s) => s.id), ['ink1', 'ink2']);
});

test('pasted ink keeps the appearance it was drawn with', () => {
  const doc = makeDoc();
  copySelection(doc, [], ['ink2']);

  const pasted = pasteClipboard(doc, { x: 10, y: 10 });
  const pastedStroke = pasted.newStrokes[pasted.newStrokes.length - 1];

  assert.equal(pastedStroke.color, '#EF4444');
  assert.equal(pastedStroke.width, 6);
});

test('pasting an ink-only payload leaves the shapes alone', () => {
  const doc = makeDoc();
  copySelection(doc, [], ['ink1']);

  const pasted = pasteClipboard(doc, { x: 30, y: 30 });
  assert.deepEqual(pasted.newNodes, doc.nodes);
  assert.deepEqual(pasted.newEdges, doc.edges);
  assert.deepEqual(pasted.pastedNodeIds, []);
});

test('an empty clipboard pastes nothing', () => {
  setInternalClipboard({ nodes: [], edges: [], strokes: [] });
  assert.equal(pasteClipboard(makeDoc(), { x: 10, y: 10 }), null);
  assert.equal(getInternalClipboard().strokes.length, 0);
});

test('copying twice replaces the payload rather than accumulating it', () => {
  const doc = makeDoc();
  copySelection(doc, ['n1'], ['ink1']);
  copySelection(doc, ['n2'], ['ink2']);

  const payload = getInternalClipboard();
  assert.deepEqual(payload.nodes.map((n) => n.id), ['n2']);
  assert.deepEqual(payload.strokes.map((s) => s.id), ['ink2']);
});

test('duplicating ink offsets it and hands back the new ids', () => {
  const doc = makeDoc();
  const result = duplicateSelection(doc, [], { x: 40, y: 40 }, ['ink1']);

  assert.ok(result);
  assert.deepEqual(result.duplicatedNodeIds, []);
  assert.equal(result.duplicatedStrokeIds.length, 1);

  const copy = result.newStrokes[result.newStrokes.length - 1];
  assert.deepEqual(copy.points, [
    { x: 50, y: 50 },
    { x: 100, y: 80 },
  ]);
});

test('duplicating nothing at all is a no-op rather than a crash', () => {
  assert.equal(duplicateSelection(makeDoc(), [], { x: 40, y: 40 }, []), null);
});

test('duplicating shapes leaves existing ink exactly where it was', () => {
  const doc = makeDoc();
  const result = duplicateSelection(doc, ['n1'], { x: 40, y: 40 });

  assert.deepEqual(result.newStrokes, doc.strokes);
  assert.deepEqual(result.duplicatedStrokeIds, []);
});

test('a pasted group is a group of its own', () => {
  const doc = makeDoc();
  doc.nodes[0].groupIds = ['g1'];
  doc.nodes[1].groupIds = ['g1'];

  copySelection(doc, ['n1', 'n2']);
  const pasted = pasteClipboard(doc, { x: 30, y: 30 });

  const copies = pasted.newNodes.slice(2);
  assert.equal(copies.length, 2);
  // Both copies answer to the same new name...
  assert.equal(copies[0].groupIds.length, 1);
  assert.deepEqual(copies[0].groupIds, copies[1].groupIds);
  // ...and that name is not the original's, so the copy is selected, moved and
  // ungrouped on its own rather than dragging the original set along with it.
  assert.notEqual(copies[0].groupIds[0], 'g1');
  assert.deepEqual(
    pasted.newNodes.slice(0, 2).map((n) => n.groupIds),
    [['g1'], ['g1']]
  );
});

test('every level of a nested group is renamed when it is copied', () => {
  const doc = makeDoc();
  doc.nodes[0].groupIds = ['inner', 'outer'];
  doc.nodes[1].groupIds = ['outer'];

  copySelection(doc, ['n1', 'n2']);
  const pasted = pasteClipboard(doc, { x: 0, y: 0 });
  const copies = pasted.newNodes.slice(2);

  assert.equal(copies[0].groupIds.length, 2);
  assert.notEqual(copies[0].groupIds[0], 'inner');
  assert.notEqual(copies[0].groupIds[1], 'outer');
  // Still nested in the same order, and still sharing the outer name.
  assert.equal(copies[1].groupIds.length, 1);
  assert.equal(copies[1].groupIds[0], copies[0].groupIds[1]);
});

test('pasting an ungrouped selection adds no group names', () => {
  const doc = makeDoc();
  copySelection(doc, ['n1']);
  const pasted = pasteClipboard(doc, { x: 0, y: 0 });
  const copy = pasted.newNodes[pasted.newNodes.length - 1];

  assert.equal('groupIds' in copy, false);
});
