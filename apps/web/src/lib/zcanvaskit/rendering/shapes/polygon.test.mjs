import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const {
  DEFAULT_CORNER_RADIUS,
  SHAPE_INSET,
  diamondVertices,
  getRoundedPolygonPath,
  roundPolygonCorners,
  triangleVertices,
} = await import('./polygon.ts');

/** A square — the easiest polygon to reason about corner distances on. */
function square(size = 100) {
  return [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ];
}

test('a diamond reaches the middle of every side of its box', () => {
  const vertices = diamondVertices(160, 80);

  assert.deepEqual(vertices, [
    { x: 80, y: SHAPE_INSET },
    { x: 160 - SHAPE_INSET, y: 40 },
    { x: 80, y: 80 - SHAPE_INSET },
    { x: SHAPE_INSET, y: 40 },
  ]);
});

test('a triangle sits on the bottom edge and points up', () => {
  const vertices = triangleVertices(160, 80);

  assert.deepEqual(vertices, [
    { x: 80, y: SHAPE_INSET },
    { x: 160 - SHAPE_INSET, y: 80 - SHAPE_INSET },
    { x: SHAPE_INSET, y: 80 - SHAPE_INSET },
  ]);
});

test('a shape is inset from its box on every side', () => {
  // The stroke is centred on the outline, so an outline flush with the box
  // would paint half its width outside the node.
  for (const vertex of [...diamondVertices(200, 120), ...triangleVertices(200, 120)]) {
    assert.ok(vertex.x >= SHAPE_INSET - 1e-9 && vertex.x <= 200 - SHAPE_INSET + 1e-9);
    assert.ok(vertex.y >= SHAPE_INSET - 1e-9 && vertex.y <= 120 - SHAPE_INSET + 1e-9);
  }
});

test('the inset can be overridden, because the canvas picks its own', () => {
  assert.deepEqual(diamondVertices(100, 100, 0)[0], { x: 50, y: 0 });
});

test('every corner is rounded back along both of its edges', () => {
  const corners = roundPolygonCorners(square(100), 12);

  for (const corner of corners) {
    assert.equal(corner.radius, 12);
    // The entry and exit sit 12px in from the vertex on each edge…
    assert.equal(Math.hypot(corner.entry.x - corner.vertex.x, corner.entry.y - corner.vertex.y), 12);
    assert.equal(Math.hypot(corner.exit.x - corner.vertex.x, corner.exit.y - corner.vertex.y), 12);
  }
});

test('a corner never takes more than half of an edge', () => {
  // Two corners share an edge, so half each is the point at which they meet.
  // Rounding further would have them cross and fold the shape through itself.
  const small = square(10);
  const corners = roundPolygonCorners(small, DEFAULT_CORNER_RADIUS);

  assert.equal(corners[0].radius, 5);
  assert.deepEqual(corners[0].entry, { x: 0, y: 5 });
  assert.deepEqual(corners[1].entry, { x: 5, y: 0 });
});

test('a degenerate edge takes no rounding, rather than dividing by zero', () => {
  const corners = roundPolygonCorners(
    [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
    5
  );

  assert.equal(corners[0].radius, 0);
  assert.deepEqual(corners[0].entry, { x: 0, y: 0 });
  assert.ok(corners.every((c) => Number.isFinite(c.entry.x) && Number.isFinite(c.exit.y)));
});

test('an unroundable corner is left sharp', () => {
  assert.deepEqual(roundPolygonCorners(square(100), 0)[0].entry, { x: 0, y: 0 });
});

test('the path rounds each corner with a quadratic through the vertex', () => {
  const d = getRoundedPolygonPath(square(100), 12);

  assert.match(d, /^M /);
  assert.match(d, / Z$/);
  // One quadratic per corner, plus the line into it.
  assert.equal((d.match(/Q /g) ?? []).length, 4);
  assert.equal((d.match(/L /g) ?? []).length, 4);
  // The curve is pulled towards the sharp corner but never reaches it.
  assert.match(d, /Q 100 0 /);
  assert.doesNotMatch(d, / L 100 0 /);
});

test('the straight run of an edge is what the two corners leave behind', () => {
  const vertices = square(100);
  const corners = roundPolygonCorners(vertices, 12);
  const d = getRoundedPolygonPath(vertices, 12);

  // Start at corner 0's exit and the first line lands on corner 1's entry:
  // 100 - 12 - 12 = 76px of untouched edge.
  assert.match(d, /^M 12 0 L 88 0 /);
  assert.equal(100 - corners[0].radius - corners[1].radius, 76);
});

test('a shape too small to round is drawn as its plain vertices', () => {
  const d = getRoundedPolygonPath(square(100), 0);

  // The closing `Z` returns to the start, so the last vertex is not repeated.
  assert.equal(d, 'M 0 0 L 100 0 L 100 100 L 0 100 Z');
});

test('a corner that eats its whole edge leaves no empty segment behind', () => {
  // On a shape this small the rounding reaches the middle of every edge, so
  // each corner meets the next one exactly: a `L` between two identical points
  // would be dead weight in the document.
  const d = getRoundedPolygonPath(diamondVertices(24, 24));

  assert.equal(d, 'M 17 7 Q 22 12 17 17 Q 12 22 7 17 Q 2 12 7 7 Q 12 2 17 7 Z');
});

test('a diamond and a triangle round without folding', () => {
  for (const vertices of [diamondVertices(160, 80), triangleVertices(160, 80)]) {
    const corners = roundPolygonCorners(vertices, DEFAULT_CORNER_RADIUS);
    const path = getRoundedPolygonPath(vertices);

    assert.equal((path.match(/Q /g) ?? []).length, vertices.length);
    // Both ends of a corner's arc stay outside the vertex, so the outline
    // still bulges the right way round.
    for (const corner of corners) {
      assert.equal(corner.radius, DEFAULT_CORNER_RADIUS);
      assert.ok(Number.isFinite(corner.entry.x));
      assert.ok(Number.isFinite(corner.exit.y));
    }
  }
});

test('a polygon with too few points produces no path', () => {
  assert.equal(getRoundedPolygonPath([]), '');
  assert.equal(getRoundedPolygonPath([{ x: 0, y: 0 }, { x: 1, y: 1 }]), '');
});

test('coordinates are rounded to hundredths, so a document stays small', () => {
  const d = getRoundedPolygonPath(
    [
      { x: 0.123456, y: 0 },
      { x: 100.987654, y: 0.555555 },
      { x: 50.5, y: 80.000001 },
    ],
    7.7777777
  );

  assert.doesNotMatch(d, /\d\.\d{3,}/);
});

test('the same vertices always produce the same path', () => {
  const vertices = triangleVertices(240, 120);

  assert.equal(getRoundedPolygonPath(vertices), getRoundedPolygonPath(vertices));
});
