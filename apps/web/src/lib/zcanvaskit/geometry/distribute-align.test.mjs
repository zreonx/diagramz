import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alignNodes,
  distributeNodes,
  tidyUpNodes,
} from './distribute-align.ts';

function createMockNode(id, x, y, width = 100, height = 50) {
  return {
    id,
    type: 'card',
    x,
    y,
    width,
    height,
    title: `Node ${id}`,
  };
}

test('alignNodes aligns selected nodes along left boundary', () => {
  const n1 = createMockNode('1', 50, 100, 100, 50);
  const n2 = createMockNode('2', 120, 200, 80, 40);
  const n3 = createMockNode('3', 300, 300, 120, 60);

  const result = alignNodes([n1, n2, n3], ['1', '2'], 'left');
  assert.equal(result.find((n) => n.id === '1').x, 50);
  assert.equal(result.find((n) => n.id === '2').x, 50);
  assert.equal(result.find((n) => n.id === '3').x, 300, 'unselected node stays untouched');
});

test('alignNodes aligns selected nodes to right boundary', () => {
  const n1 = createMockNode('1', 50, 100, 100, 50); // right = 150
  const n2 = createMockNode('2', 120, 200, 80, 40);  // right = 200

  const result = alignNodes([n1, n2], ['1', '2'], 'right');
  // maxX is 200
  assert.equal(result.find((n) => n.id === '1').x, 100); // 200 - 100
  assert.equal(result.find((n) => n.id === '2').x, 120); // 200 - 80
});

test('alignNodes aligns selected nodes to vertical center / middle', () => {
  const n1 = createMockNode('1', 100, 50, 100, 50);   // center Y = 75
  const n2 = createMockNode('2', 200, 150, 100, 50);  // center Y = 175

  // minY = 50, maxY = 200, centerY = 125
  const result = alignNodes([n1, n2], ['1', '2'], 'middle');
  assert.equal(result.find((n) => n.id === '1').y, 100); // 125 - 25
  assert.equal(result.find((n) => n.id === '2').y, 100); // 125 - 25
});

test('distributeNodes distributes nodes with equal horizontal gaps', () => {
  const n1 = createMockNode('1', 0, 100, 100, 50);
  const n2 = createMockNode('2', 150, 100, 100, 50);
  const n3 = createMockNode('3', 500, 100, 100, 50);

  // Total span = 600 - 0 = 600
  // Item widths = 100 + 100 + 100 = 300
  // Remaining gap span = 300 / 2 = 150
  const result = distributeNodes([n1, n2, n3], ['1', '2', '3'], 'horizontal');
  assert.equal(result.find((n) => n.id === '1').x, 0);
  assert.equal(result.find((n) => n.id === '2').x, 250); // 0 + 100 + 150
  assert.equal(result.find((n) => n.id === '3').x, 500); // 250 + 100 + 150
});

test('distributeNodes distributes nodes with equal vertical gaps', () => {
  const n1 = createMockNode('1', 100, 0, 100, 50);
  const n2 = createMockNode('2', 100, 100, 100, 50);
  const n3 = createMockNode('3', 100, 300, 100, 50);

  // Total span = 350 - 0 = 350
  // Heights = 150
  // Gap = 200 / 2 = 100
  const result = distributeNodes([n1, n2, n3], ['1', '2', '3'], 'vertical');
  assert.equal(result.find((n) => n.id === '1').y, 0);
  assert.equal(result.find((n) => n.id === '2').y, 150); // 0 + 50 + 100
  assert.equal(result.find((n) => n.id === '3').y, 300);
});

test('tidyUpNodes arranges 4 nodes into a neat 2x2 grid', () => {
  const n1 = createMockNode('1', 10, 20, 100, 50);
  const n2 = createMockNode('2', 200, 15, 100, 50);
  const n3 = createMockNode('3', 15, 150, 100, 50);
  const n4 = createMockNode('4', 210, 140, 100, 50);

  const result = tidyUpNodes([n1, n2, n3, n4], ['1', '2', '3', '4'], 30);
  const r1 = result.find((n) => n.id === '1');
  const r2 = result.find((n) => n.id === '2');
  const r3 = result.find((n) => n.id === '3');
  const r4 = result.find((n) => n.id === '4');

  assert.equal(r1.x, 10);
  assert.equal(r1.y, 15);
  assert.equal(r2.x, 10 + 100 + 30);
  assert.equal(r2.y, 15);
  assert.equal(r3.x, 10);
  assert.equal(r3.y, 15 + 50 + 30);
  assert.equal(r4.x, 10 + 100 + 30);
  assert.equal(r4.y, 15 + 50 + 30);
});

test('distribute-align no-ops when fewer than required nodes are provided', () => {
  const n1 = createMockNode('1', 0, 0, 100, 50);
  assert.deepEqual(alignNodes([n1], ['1'], 'left'), [n1]);
  assert.deepEqual(distributeNodes([n1], ['1'], 'horizontal'), [n1]);
  assert.deepEqual(tidyUpNodes([n1], ['1']), [n1]);
});
