import assert from 'assert';
import { TransactionHistory } from './history/transaction-history.ts';
import {
  CreateNodeCommand,
  DeleteSelectedCommand,
  ReorderNodesCommand,
  ToggleLockCommand,
  AlignNodesCommand,
  DistributeNodesCommand,
} from './commands/index.ts';
import {
  copySelection,
  pasteClipboard,
  duplicateSelection,
} from './clipboard/index.ts';
import {
  getSketchRectPath,
  getSketchDiamondPath,
  getSketchLinePath,
} from '../rendering/sketch/rough-svg.ts';
import { isLocked } from './locking.ts';

console.log('--- Running ZCanvasKit Engine Specification Tests ---');

// 1. TransactionHistory Tests
{
  const history = new TransactionHistory(5);
  let doc = { version: 1, nodes: [{ id: 'n1', x: 0, y: 0 }] };

  assert.strictEqual(history.canUndo(), false);
  assert.strictEqual(history.canRedo(), false);

  history.beginTransaction(doc);
  doc = { version: 1, nodes: [{ id: 'n1', x: 50, y: 50 }] };
  history.commitTransaction(doc, 'Move node');

  assert.strictEqual(history.canUndo(), true);
  const reverted = history.undo(doc);
  assert.strictEqual(reverted.nodes[0].x, 0);
  assert.strictEqual(history.canRedo(), true);

  const redone = history.redo(reverted);
  assert.strictEqual(redone.nodes[0].x, 50);

  // Test no-op transaction
  history.beginTransaction(redone);
  history.commitTransaction(redone, 'No-op move');
  assert.strictEqual(history.canRedo(), false);

  console.log('✓ TransactionHistory tests passed');
}

// 2. Command System Tests
{
  let doc = {
    version: 1,
    nodes: [
      { id: 'a', type: 'rectangle', x: 10, y: 20, width: 100, height: 50, title: 'Node A' },
      { id: 'b', type: 'rectangle', x: 200, y: 20, width: 100, height: 50, title: 'Node B' },
      { id: 'c', type: 'rectangle', x: 400, y: 20, width: 100, height: 50, title: 'Node C' },
    ],
    edges: [],
    strokes: [],
    viewport: { zoom: 1, panX: 0, panY: 0 },
  };

  const context = {
    document: doc,
    selectedNodeIds: ['a', 'b', 'c'],
    selectedEdgeId: null,
    commit(update) {
      if (update.nodes) doc.nodes = update.nodes;
      if (update.edges) doc.edges = update.edges;
    },
    select(ids) {
      this.selectedNodeIds = ids;
    },
  };

  // Align Left
  const alignLeftCmd = new AlignNodesCommand('left');
  assert.strictEqual(alignLeftCmd.canExecute(context), true);
  alignLeftCmd.execute(context);
  assert.strictEqual(doc.nodes[0].x, 10);
  assert.strictEqual(doc.nodes[1].x, 10);
  assert.strictEqual(doc.nodes[2].x, 10);

  // Stacking order: bring to front
  context.selectedNodeIds = ['a'];
  const frontCmd = new ReorderNodesCommand('front');
  frontCmd.execute(context);
  assert.strictEqual(doc.nodes[doc.nodes.length - 1].id, 'a');

  // Stacking order: send to back
  const backCmd = new ReorderNodesCommand('back');
  backCmd.execute(context);
  assert.strictEqual(doc.nodes[0].id, 'a');

  // Lock command. The flag is a field of its own rather than something hidden
  // in the data bag, because both connectors and ink are lockable too and
  // neither has a bag to hide it in.
  const lockCmd = new ToggleLockCommand();
  assert.strictEqual(lockCmd.canExecute(context), true);
  lockCmd.execute(context);
  assert.strictEqual(doc.nodes[0].locked, true);
  assert.strictEqual(doc.nodes[0].data, undefined);

  // ...and toggling again lifts it, leaving no trace behind for a reload to
  // pick back up.
  lockCmd.execute(context);
  assert.strictEqual(doc.nodes[0].locked, undefined);
  assert.strictEqual(isLocked(doc.nodes[0]), false);

  console.log('✓ Command System tests passed');
}

// 3. Clipboard System Tests
{
  const doc = {
    version: 1,
    nodes: [
      { id: 'orig-1', type: 'rectangle', x: 10, y: 10, width: 100, height: 60, title: 'Box' },
    ],
    edges: [],
    strokes: [],
    viewport: { zoom: 1, panX: 0, panY: 0 },
  };

  copySelection(doc, ['orig-1']);
  const pasted = pasteClipboard(doc, { x: 50, y: 50 });
  assert(pasted !== null);
  assert.strictEqual(pasted.newNodes.length, 2);
  assert.notStrictEqual(pasted.newNodes[1].id, 'orig-1');
  assert.strictEqual(pasted.newNodes[1].x, 60);
  assert.strictEqual(pasted.newNodes[1].y, 60);

  console.log('✓ Clipboard System tests passed');
}

// 4. Deterministic Sketch Rough SVG Tests
{
  const path1 = getSketchRectPath(0, 0, 100, 100, 'seed-abc', 1.5);
  const path2 = getSketchRectPath(0, 0, 100, 100, 'seed-abc', 1.5);
  const pathDiff = getSketchRectPath(0, 0, 100, 100, 'seed-xyz', 1.5);

  // Same seed produces 100% deterministic identical SVG path
  assert.strictEqual(path1, path2);
  // Different seed produces different outline
  assert.notStrictEqual(path1, pathDiff);

  const diamondPath1 = getSketchDiamondPath(120, 80, 42, 1.2);
  const diamondPath2 = getSketchDiamondPath(120, 80, 42, 1.2);
  assert.strictEqual(diamondPath1, diamondPath2);

  console.log('✓ Deterministic Sketch Rough SVG tests passed');
}

console.log('All ZCanvasKit Engine Specification tests PASSED successfully!');
