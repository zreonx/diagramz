import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HANDLE_POSITIONS,
  getHandlePoint,
  getNearestHandle,
  getNearestSideAndOffset,
  computeEdgeGeometry,
  computeMultiConnectionOffsets,
  bezierControlPoints,
  edgeIntersectsBox,
  resolveEdgeLabelPositions,
  calculateAlignmentGuides,
  findSegmentIntersection,
  injectLineJumps,
} from './index.ts';

const boxA = { x: 0, y: 0, width: 100, height: 50 };
const boxB = { x: 200, y: 0, width: 100, height: 50 };

function twoNodeMap() {
  return new Map([
    ['a', boxA],
    ['b', boxB],
  ]);
}

/** The point on a cubic at `t`, evaluated from the four points that define it. */
function cubicAt(p1, c1, c2, p2, t) {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;

  return {
    x: w0 * p1.x + w1 * c1.x + w2 * c2.x + w3 * p2.x,
    y: w0 * p1.y + w1 * c1.y + w2 * c2.y + w3 * p2.y,
  };
}

/**
 * Whether a box holds a point, within a hair.
 *
 * The tolerance is for the arithmetic here, not for the box: a horizontal
 * connector's box is exactly as tall as the line, so evaluating a point on that
 * line from four weights leaves it a few ulps off the edge. The renderer draws
 * the exact curve, and a sweep that covers the line's row covers it.
 */
const inside = (point, box, epsilon = 1e-6) =>
  point.x >= box.x - epsilon &&
  point.x <= box.x + box.width + epsilon &&
  point.y >= box.y - epsilon &&
  point.y <= box.y + box.height + epsilon;

test('HANDLE_POSITIONS lists all four positions in order', () => {
  assert.deepEqual(HANDLE_POSITIONS, ['top', 'right', 'bottom', 'left']);
});

test('getNearestHandle resolves the closest of each of the four sides', () => {
  assert.equal(getNearestHandle(boxA, { x: 50, y: -100 }), 'top');
  assert.equal(getNearestHandle(boxA, { x: 500, y: 25 }), 'right');
  assert.equal(getNearestHandle(boxA, { x: 50, y: 150 }), 'bottom');
  assert.equal(getNearestHandle(boxA, { x: -500, y: 25 }), 'left');
});

test('fully-free edge renders a straight line with a midpoint', () => {
  const result = computeEdgeGeometry(
    {
      source: 'a',
      target: 'b',
      sourcePoint: { x: 10, y: 20 },
      targetPoint: { x: 110, y: 70 },
    },
    twoNodeMap()
  );

  assert.notEqual(result, null);
  assert.deepEqual(result.p1, { x: 10, y: 20 });
  assert.deepEqual(result.p2, { x: 110, y: 70 });
  assert.equal(result.pathD, 'M 10 20 L 110 70');
  assert.deepEqual(result.midPoint, { x: 60, y: 45 });
  assert.equal(result.sourcePos, 'right');
  assert.equal(result.targetPos, 'left');
});

test('fully-free edge stays straight even if matching nodes exist', () => {
  const result = computeEdgeGeometry(
    {
      source: 'a',
      target: 'b',
      sourcePoint: { x: 0, y: 0 },
      targetPoint: { x: 300, y: 200 },
    },
    twoNodeMap()
  );

  assert.notEqual(result, null);
  assert.equal(result.pathD, 'M 0 0 L 300 200');
});

test('fully-connected edge picks the optimal handle pair', () => {
  const result = computeEdgeGeometry({ source: 'a', target: 'b' }, twoNodeMap());

  assert.notEqual(result, null);
  assert.equal(result.sourcePos, 'right');
  assert.equal(result.targetPos, 'left');
  assert.deepEqual(result.p1, { x: 100, y: 25 });
  assert.deepEqual(result.p2, { x: 200, y: 25 });
  assert.deepEqual(result.midPoint, { x: 150, y: 25 });
  assert.equal(result.pathD, 'M 100 25 C 140 25, 160 25, 200 25');
  assert.ok(result.pathD.length > 0);
});

test('fully-connected edge honours explicit handles', () => {
  const result = computeEdgeGeometry(
    { source: 'a', target: 'b', sourceHandle: 'top', targetHandle: 'bottom' },
    twoNodeMap()
  );

  assert.notEqual(result, null);
  assert.equal(result.sourcePos, 'top');
  assert.equal(result.targetPos, 'bottom');
  assert.deepEqual(result.p1, { x: 50, y: 0 });
  assert.deepEqual(result.p2, { x: 250, y: 50 });
});

test('defaultRouting step produces an orthogonal path distinct from bezier', () => {
  const bezier = computeEdgeGeometry({ source: 'a', target: 'b' }, twoNodeMap());
  const step = computeEdgeGeometry({ source: 'a', target: 'b' }, twoNodeMap(), 'step');

  assert.notEqual(bezier, null);
  assert.notEqual(step, null);
  assert.equal(step.pathD, 'M 100 25 L 150 25 L 150 25 L 200 25');
  assert.ok(step.pathD.includes(' L '));
  assert.notEqual(step.pathD, bezier.pathD);
  assert.ok(!step.pathD.includes(' C '));
});

test('edge.style step overrides a bezier default', () => {
  const step = computeEdgeGeometry({ source: 'a', target: 'b', style: 'step' }, twoNodeMap());
  const bezier = computeEdgeGeometry({ source: 'a', target: 'b', style: 'bezier' }, twoNodeMap());

  assert.notEqual(step, null);
  assert.notEqual(bezier, null);
  assert.ok(step.pathD.includes(' L '));
  assert.ok(!step.pathD.includes(' C '));
  assert.notEqual(step.pathD, bezier.pathD);
});

test('mixed edge with a free source point snaps the target to its nearest handle', () => {
  const freePoint = { x: 200, y: 30 };
  const result = computeEdgeGeometry(
    { source: 'a', target: 'b', sourcePoint: freePoint },
    twoNodeMap()
  );

  assert.notEqual(result, null);
  assert.deepEqual(result.p1, freePoint);
  assert.equal(result.targetPos, 'left');
  assert.deepEqual(result.p2, { x: 200, y: 25 });
  assert.equal(result.sourcePos, 'right');
});

test('mixed edge with a free target point snaps the source to its nearest handle', () => {
  const freePoint = { x: -20, y: 25 };
  const result = computeEdgeGeometry(
    { source: 'a', target: 'b', targetPoint: freePoint },
    twoNodeMap()
  );

  assert.notEqual(result, null);
  assert.deepEqual(result.p2, freePoint);
  assert.equal(result.sourcePos, 'left');
  assert.deepEqual(result.p1, { x: 0, y: 25 });
  assert.equal(result.targetPos, 'left');
});

test('mixed edge honours an explicit handle on the attached end', () => {
  const result = computeEdgeGeometry(
    { source: 'a', target: 'b', sourcePoint: { x: 200, y: 300 }, targetHandle: 'top' },
    twoNodeMap()
  );

  assert.notEqual(result, null);
  assert.deepEqual(result.p1, { x: 200, y: 300 });
  assert.equal(result.targetPos, 'top');
  assert.deepEqual(result.p2, { x: 250, y: 0 });
});

test('unresolvable edge returns null for empty ids', () => {
  assert.equal(
    computeEdgeGeometry({ source: '', target: '' }, twoNodeMap()),
    null
  );
});

test('unresolvable edge returns null when node ids are missing from the map', () => {
  assert.equal(
    computeEdgeGeometry({ source: 'missing-a', target: 'missing-b' }, twoNodeMap()),
    null
  );
});

test('edge with a free point whose own node is missing still snaps to a resolvable end', () => {
  const result = computeEdgeGeometry(
    { source: 'missing', target: 'b', sourcePoint: { x: 5, y: 5 } },
    twoNodeMap()
  );

  assert.notEqual(result, null);
  assert.deepEqual(result.p1, { x: 5, y: 5 });
  assert.equal(result.targetPos, 'left');
  assert.deepEqual(result.p2, { x: 200, y: 25 });
});

test('edge with a free point and an unresolvable other end returns null', () => {
  assert.equal(
    computeEdgeGeometry(
      { source: 'missing-a', target: 'missing-b', sourcePoint: { x: 5, y: 5 } },
      twoNodeMap()
    ),
    null
  );
});

test('a straight connector is boxed by its two ends', () => {
  const result = computeEdgeGeometry(
    {
      source: 'a',
      target: 'b',
      sourcePoint: { x: 10, y: 20 },
      targetPoint: { x: 110, y: 70 },
    },
    twoNodeMap()
  );

  assert.deepEqual(result.bounds, { x: 10, y: 20, width: 100, height: 50 });
});

test('an orthogonal connector is boxed by its two ends, which is where it turns', () => {
  // A step route only ever turns at a point between its ends, so the box its
  // ends span already holds the whole path — including the corner.
  const result = computeEdgeGeometry(
    { source: 'a', target: 'd' },
    new Map([
      ['a', boxA],
      ['d', { x: 400, y: 300, width: 100, height: 50 }],
    ]),
    'step'
  );

  assert.equal(result.pathD, 'M 100 25 L 250 25 L 250 325 L 400 325');
  assert.deepEqual(result.bounds, { x: 100, y: 25, width: 300, height: 300 });
});

test("a connector's box holds every point of its drawn path", () => {
  // The guarantee the box has to give a sweep. Checked against the curve
  // itself rather than against the numbers that happen to produce it, so the
  // two cannot agree on a box that misses the line.
  const result = computeEdgeGeometry(
    { source: 'b', target: 'a', sourceHandle: 'left', targetHandle: 'left' },
    new Map([
      ['a', { x: 200, y: 0, width: 100, height: 50 }],
      ['b', { x: 0, y: 0, width: 100, height: 50 }],
    ])
  );

  const { c1, c2 } = bezierControlPoints(result.p1, result.p2, result.sourcePos, result.targetPos);

  for (let t = 0; t <= 1; t += 0.005) {
    const point = cubicAt(result.p1, c1, c2, result.p2, t);
    assert.ok(inside(point, result.bounds), `t=${t.toFixed(3)} left the box`);
  }
});

test('a handle facing away from the other end widens the box past the ends', () => {
  // Both ends are the *left* anchors, so the curve leaves the source heading
  // away from the target and swings back. The ends span x 0..200; the curve
  // reaches about x -14, which is why the box is measured over the control
  // points and not over the endpoints.
  const result = computeEdgeGeometry(
    { source: 'b', target: 'a', sourceHandle: 'left', targetHandle: 'left' },
    new Map([
      ['a', { x: 200, y: 0, width: 100, height: 50 }],
      ['b', { x: 0, y: 0, width: 100, height: 50 }],
    ])
  );

  assert.deepEqual(result.p1, { x: 0, y: 25 });
  assert.deepEqual(result.p2, { x: 200, y: 25 });
  assert.deepEqual(result.bounds, { x: -70, y: 25, width: 270, height: 0 });
});

test('the control points the box is measured over are the ones that drew the curve', () => {
  const p1 = { x: 0, y: 25 };
  const p2 = { x: 200, y: 25 };
  const { c1, c2 } = bezierControlPoints(p1, p2, 'left', 'left');

  assert.deepEqual(c1, { x: -70, y: 25 });
  assert.deepEqual(c2, { x: 130, y: 25 });
  assert.equal(
    computeEdgeGeometry(
      { source: 'b', target: 'a', sourceHandle: 'left', targetHandle: 'left' },
      new Map([
        ['a', { x: 200, y: 0, width: 100, height: 50 }],
        ['b', { x: 0, y: 0, width: 100, height: 50 }],
      ])
    ).pathD,
    `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`
  );
});

test('a sweep over a connector catches it', () => {
  const box = { x: 140, y: 10, width: 20, height: 30 };
  assert.equal(edgeIntersectsBox({ source: 'a', target: 'b' }, box, twoNodeMap()), true);
});

test('a sweep beside a connector leaves it alone', () => {
  const box = { x: 140, y: 100, width: 20, height: 30 };
  assert.equal(edgeIntersectsBox({ source: 'a', target: 'b' }, box, twoNodeMap()), false);
});

test('a sweep crossing only the bend of a curve still catches it', () => {
  // The regression this whole box exists for: the ends of this connector span
  // x 0..200, and the curve bows out to about x -14. A sweep that met the bend
  // and not the ends would have missed the connector entirely if it were
  // measured by its ends.
  const nodes = new Map([
    ['a', { x: 200, y: 0, width: 100, height: 50 }],
    ['b', { x: 0, y: 0, width: 100, height: 50 }],
  ]);
  const edge = { source: 'b', target: 'a', sourceHandle: 'left', targetHandle: 'left' };
  const bend = { x: -20, y: 20, width: 15, height: 10 };

  assert.equal(edgeIntersectsBox(edge, bend, nodes), true);

  // And the ends alone would not have found it: the marquee sits entirely to
  // the left of where the connector is anchored.
  const ends = { x: 0, y: 25, width: 200, height: 0 };
  assert.equal(bend.x + bend.width <= ends.x, true);
});

test('the box can over-reach a curve, which is the safe way to be wrong', () => {
  // The hull is a bound, not the curve itself: here the marquee meets it and
  // not the line, so the connector is caught though nothing of it is inside.
  // Over-reaching costs a sweep an element it nearly touched; under-reaching
  // would cost it one the user drew the box around, so this is the side to err
  // on — and it is the side a shape's own box already errs on.
  const nodes = new Map([
    ['a', { x: 200, y: 0, width: 100, height: 50 }],
    ['b', { x: 0, y: 0, width: 100, height: 50 }],
  ]);
  const empty = { x: -70, y: 20, width: 40, height: 10 };

  assert.equal(
    edgeIntersectsBox(
      { source: 'b', target: 'a', sourceHandle: 'left', targetHandle: 'left' },
      empty,
      nodes
    ),
    true
  );
});

test('a connector that cannot be resolved is not caught by any sweep', () => {
  const everything = { x: -1000, y: -1000, width: 5000, height: 5000 };
  assert.equal(
    edgeIntersectsBox({ source: 'missing-a', target: 'missing-b' }, everything, twoNodeMap()),
    false
  );
});

test('a sweep catches the connectors it crosses and no others', () => {
  const nodes = new Map([
    ['a', boxA],
    ['b', boxB],
    ['c', { x: 0, y: 400, width: 100, height: 50 }],
  ]);
  const edges = [
    { id: 'across', source: 'a', target: 'b' },
    { id: 'below', source: 'a', target: 'c' },
  ];
  const sweep = { x: 120, y: 15, width: 60, height: 20 };

  assert.deepEqual(
    edges.filter((edge) => edgeIntersectsBox(edge, sweep, nodes)).map((edge) => edge.id),
    ['across']
  );
});

/**
 * A point, to a hair. Every anchor of a turned box is trigonometry, so a
 * quarter turn reports `6.1e-17` where an exact zero is meant — and
 * `Math.sin(Math.PI)` is `1.2e-16`, which leaves a half turn a fraction of a
 * nanometre off the line it should lie on.
 */
function closePoint(actual, expected, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual.x - expected.x) < epsilon && Math.abs(actual.y - expected.y) < epsilon,
    `expected (${actual.x}, ${actual.y}) to be within ${epsilon} of (${expected.x}, ${expected.y})`
  );
}

test('a turned shape offers each handle where it is drawn', () => {
  // Upright, the four handles are the middles of the four sides of the frame.
  assert.deepEqual(getHandlePoint(boxA, 'top'), { x: 50, y: 0 });
  assert.deepEqual(getHandlePoint(boxA, 'right'), { x: 100, y: 25 });
  assert.deepEqual(getHandlePoint(boxA, 'bottom'), { x: 50, y: 50 });
  assert.deepEqual(getHandlePoint(boxA, 'left'), { x: 0, y: 25 });

  // Turned a quarter clockwise about its centre (50, 25), each side swings onto
  // the next one round: the north edge is now the one on the right.
  closePoint(getHandlePoint(boxA, 'top', 90), { x: 75, y: 25 });
  closePoint(getHandlePoint(boxA, 'right', 90), { x: 50, y: 75 });
  closePoint(getHandlePoint(boxA, 'bottom', 90), { x: 25, y: 25 });
  closePoint(getHandlePoint(boxA, 'left', 90), { x: 50, y: -25 });

  // Half a turn swaps each side for the one opposite.
  closePoint(getHandlePoint(boxA, 'top', 180), { x: 50, y: 50 });
  closePoint(getHandlePoint(boxA, 'right', 180), { x: 0, y: 25 });

  // Three quarters is the mirror of one quarter.
  closePoint(getHandlePoint(boxA, 'top', 270), { x: 25, y: 25 });
  closePoint(getHandlePoint(boxA, 'right', 270), { x: 50, y: -25 });

  // A box too narrow to have an interior still turns about its centre.
  closePoint(getHandlePoint({ x: 10, y: 10, width: 0, height: 0 }, 'top', 180), {
    x: 10,
    y: 10,
  });
});

test('the nearest handle is resolved on the shape as drawn, not as placed', () => {
  // Upright, a point far to the east is nearest the right-hand side.
  assert.equal(getNearestHandle(boxA, { x: 500, y: 25 }), 'right');
  assert.equal(getNearestHandle(boxA, { x: 50, y: 500 }), 'bottom');

  // Turn the shape a quarter clockwise and the side facing east is the one the
  // frame calls `top`, because that is where the drawing puts it.
  assert.equal(getNearestHandle(boxA, { x: 500, y: 25 }, 90), 'top');
  assert.equal(getNearestHandle(boxA, { x: 50, y: 500 }, 90), 'right');

  // Half a turn: the side facing east is the one the frame calls `left`.
  assert.equal(getNearestHandle(boxA, { x: 500, y: 25 }, 180), 'left');
  assert.equal(getNearestHandle(boxA, { x: -500, y: 25 }, 180), 'right');
});

test('a connector meets a turned shape on the side facing its partner', () => {
  // `b` sits due east of `a`. Turned half a turn, the side of `a` facing east
  // is the one its frame calls `left` — and that is where the connector has to
  // meet it. Reading the pair off the upright frames would attach the line to
  // the far side and draw it straight through the shape.
  const turned = new Map([
    ['a', { ...boxA, rotation: 180 }],
    ['b', boxB],
  ]);

  const result = computeEdgeGeometry({ source: 'a', target: 'b' }, turned);

  assert.notEqual(result, null);
  assert.equal(result.sourcePos, 'left');
  assert.equal(result.targetPos, 'left');
  closePoint(result.p1, { x: 100, y: 25 });
  closePoint(result.p2, { x: 200, y: 25 });
});

test('a connector leaves a quarter-turned shape by the edge swung to its partner', () => {
  const turned = new Map([
    ['a', { ...boxA, rotation: 90 }],
    ['b', boxB],
  ]);

  const result = computeEdgeGeometry({ source: 'a', target: 'b' }, turned);

  assert.notEqual(result, null);
  // The anchors of `a` are at (75,25) for the frame's `top` and (25,25) for its
  // `bottom`; the nearer of those to `b` is the first.
  assert.equal(result.sourcePos, 'top');
  closePoint(result.p1, { x: 75, y: 25 });
  closePoint(result.p2, { x: 200, y: 25 });
});

test('the turn of one end does not change where the other end attaches', () => {
  // Three quarters round is a quarter the other way: boxB's `top` anchor has
  // swung to its west face, which is the side facing `a`.
  const turned = new Map([
    ['a', boxA],
    ['b', { ...boxB, rotation: 270 }],
  ]);

  const result = computeEdgeGeometry({ source: 'a', target: 'b' }, turned);

  assert.notEqual(result, null);
  assert.equal(result.sourcePos, 'right');
  assert.equal(result.targetPos, 'top');
  closePoint(result.p1, { x: 100, y: 25 });
  closePoint(result.p2, { x: 225, y: 25 });
});

test('an explicit handle is honoured, and resolved on the turned edge', () => {
  const turned = new Map([['a', { ...boxA, rotation: 90 }], ['b', boxB]]);

  const result = computeEdgeGeometry(
    { source: 'a', target: 'b', sourceHandle: 'bottom' },
    turned
  );

  assert.notEqual(result, null);
  assert.equal(result.sourcePos, 'bottom');
  closePoint(result.p1, { x: 25, y: 25 });
});

test('a line drawn to a turned shape snaps to its turned side', () => {
  // One end still in hand, the other already on the shape: the free point
  // decides which side of the drawing the line is finished on.
  const turned = new Map([['a', { ...boxA, rotation: 90 }]]);

  const result = computeEdgeGeometry(
    { target: 'a', sourcePoint: { x: 50, y: 200 } },
    turned
  );

  assert.notEqual(result, null);
  // (50, 75) — the frame's `right`, swung to the south side by the quarter turn.
  assert.equal(result.targetPos, 'right');
  closePoint(result.p2, { x: 50, y: 75 });
});

test('multiple connectors on different sides of a shape resolve distinct anchors', () => {
  const nodeMap = new Map([
    ['center', { x: 100, y: 100, width: 100, height: 60 }],
    ['topNode', { x: 100, y: 0, width: 100, height: 40 }],
    ['bottomNode', { x: 100, y: 220, width: 100, height: 40 }],
    ['leftNode', { x: 0, y: 100, width: 60, height: 60 }],
    ['rightNode', { x: 260, y: 100, width: 60, height: 60 }],
  ]);

  const edgeTop = computeEdgeGeometry(
    { id: 'e-top', source: 'center', target: 'topNode', sourceHandle: 'top', targetHandle: 'bottom' },
    nodeMap
  );
  const edgeBottom = computeEdgeGeometry(
    { id: 'e-btm', source: 'center', target: 'bottomNode', sourceHandle: 'bottom', targetHandle: 'top' },
    nodeMap
  );
  const edgeLeft = computeEdgeGeometry(
    { id: 'e-left', source: 'center', target: 'leftNode', sourceHandle: 'left', targetHandle: 'right' },
    nodeMap
  );
  const edgeRight = computeEdgeGeometry(
    { id: 'e-right', source: 'center', target: 'rightNode', sourceHandle: 'right', targetHandle: 'left' },
    nodeMap
  );

  assert.equal(edgeTop.sourcePos, 'top');
  assert.deepEqual(edgeTop.p1, { x: 150, y: 100 });
  assert.equal(edgeBottom.sourcePos, 'bottom');
  assert.deepEqual(edgeBottom.p1, { x: 150, y: 160 });
  assert.equal(edgeLeft.sourcePos, 'left');
  assert.deepEqual(edgeLeft.p1, { x: 100, y: 130 });
  assert.equal(edgeRight.sourcePos, 'right');
  assert.deepEqual(edgeRight.p1, { x: 200, y: 130 });
});

test('computeMultiConnectionOffsets distributes multiple edges on the same side without overlap', () => {
  const nodeMap = new Map([
    ['a', { x: 0, y: 0, width: 100, height: 100 }],
    ['b', { x: 200, y: 0, width: 100, height: 100 }],
  ]);

  const edges = [
    { id: 'e1', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e2', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' },
  ];

  const offsets = computeMultiConnectionOffsets(edges, nodeMap);
  const o1 = offsets.get('e1');
  const o2 = offsets.get('e2');

  assert.notEqual(o1.sourceOffset, o2.sourceOffset);
  assert.notEqual(o1.targetOffset, o2.targetOffset);

  const geo1 = computeEdgeGeometry(edges[0], nodeMap, 'bezier', o1);
  const geo2 = computeEdgeGeometry(edges[1], nodeMap, 'bezier', o2);

  assert.notEqual(geo1.p1.y, geo2.p1.y);
  assert.notEqual(geo1.p2.y, geo2.p2.y);
});

test('edge routing toggle switches between smooth bezier and orthogonal step paths', () => {
  const nodeMap = twoNodeMap();
  const edge = { id: 'e1', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' };

  const bezierGeo = computeEdgeGeometry(edge, nodeMap, 'bezier');
  const stepGeo = computeEdgeGeometry(edge, nodeMap, 'step');

  assert.match(bezierGeo.pathD, /^M \d+ \d+ C/);
  assert.match(stepGeo.pathD, /^M \d+ \d+ L/);
});

test('getNearestSideAndOffset resolves closest side and fractional offset along shape', () => {
  const box = { x: 100, y: 100, width: 200, height: 100 };

  // Point near top side, shifted to the right (+60px from center 200)
  const topRes = getNearestSideAndOffset(box, { x: 260, y: 95 });
  assert.equal(topRes.side, 'top');
  assert.equal(topRes.offset, 60);
  assert.equal(topRes.point.x, 260);
  assert.equal(topRes.point.y, 100);

  // Point near left side, shifted down (+35px from center 150) -> free offset
  const leftRes = getNearestSideAndOffset(box, { x: 95, y: 185 });
  assert.equal(leftRes.side, 'left');
  assert.equal(leftRes.offset, 35);
  assert.equal(leftRes.point.x, 100);
  assert.equal(leftRes.point.y, 185);

  // Point near left side, near 25% quartile mark (+28px from center 150) -> snaps to 25
  const snapQuarterRes = getNearestSideAndOffset(box, { x: 95, y: 178 });
  assert.equal(snapQuarterRes.side, 'left');
  assert.equal(snapQuarterRes.offset, 25);

  // Magnetic snapping to center within 10px
  const centerRes = getNearestSideAndOffset(box, { x: 204, y: 98 });
  assert.equal(centerRes.side, 'top');
  assert.equal(centerRes.offset, 0);
  assert.equal(centerRes.point.x, 200);
});

test('computeEdgeGeometry applies custom sourceOffset, targetOffset, and stepOffset', () => {
  const nodeMap = twoNodeMap();
  const edge = {
    id: 'e1',
    source: 'a',
    target: 'b',
    sourceHandle: 'top',
    targetHandle: 'top',
    sourceOffset: 25,
    targetOffset: -20,
    stepOffset: 30,
    style: 'step',
  };

  const geo = computeEdgeGeometry(edge, nodeMap, 'step');
  assert.ok(geo);
  // Source boxA center is 50, with +25 offset -> 75
  assert.equal(geo.p1.x, 75);
  assert.equal(geo.p1.y, 0);
  // Target boxB center is 250, with -20 offset -> 230
  assert.equal(geo.p2.x, 230);
  assert.equal(geo.p2.y, 0);
  // Midpoint / step has stepOffset applied
  assert.match(geo.pathD, /L 75 30/);
});

test('resolveEdgeLabelPositions separates bidirectional edge labels between same node pair', () => {
  const nodeMap = twoNodeMap();
  const e1 = { id: 'e1', source: 'a', target: 'b', label: 'HTTP GET /api' };
  const e2 = { id: 'e2', source: 'b', target: 'a', label: '200 OK JSON' };

  const positions = resolveEdgeLabelPositions([e1, e2], nodeMap);
  const p1 = positions.get('e1');
  const p2 = positions.get('e2');

  assert.ok(p1);
  assert.ok(p2);
  // They must not collide at the same coordinates!
  assert.notDeepEqual(p1, p2);
  // Distance between label centers should be at least 20px
  assert.ok(Math.hypot(p1.x - p2.x, p1.y - p2.y) >= 20);
});

test('resolveEdgeLabelPositions respects manual user labelOffset and avoids collisions', () => {
  const nodeMap = twoNodeMap();
  const e1 = { id: 'e1', source: 'a', target: 'b', label: 'Primary', labelOffset: { x: 30, y: -40 } };
  const e2 = { id: 'e2', source: 'a', target: 'b', label: 'Secondary' };

  const positions = resolveEdgeLabelPositions([e1, e2], nodeMap);
  const geo1 = computeEdgeGeometry(e1, nodeMap, 'bezier');
  const p1 = positions.get('e1');
  const p2 = positions.get('e2');

  assert.ok(p1);
  assert.ok(p2);
  // Manual offset on e1 is exact
  assert.equal(p1.x, geo1.midPoint.x + 30);
  assert.equal(p1.y, geo1.midPoint.y - 40);
  // e2 does not overlap e1
  assert.notDeepEqual(p1, p2);
});

test('connected edge with style straight routes directly between anchor ports', () => {
  const geo = computeEdgeGeometry(
    { source: 'a', target: 'b', style: 'straight' },
    twoNodeMap(),
    'bezier'
  );
  assert.ok(geo);
  assert.equal(geo.pathD, 'M 100 25 L 200 25');
  assert.deepEqual(geo.midPoint, { x: 150, y: 25 });
  assert.equal(geo.vertices.length, 2);
  assert.equal(geo.segmentMidpoints.length, 1);
  assert.deepEqual(geo.segmentMidpoints[0], { x: 150, y: 25, index: 0 });
});

test('computeOrthogonalStepPath routes perpendicular ports via a crisp Draw.io L-bend and same-side ports via a 28px jetty', () => {
  // Perpendicular: right -> top
  const lBend = computeEdgeGeometry(
    { source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'top', style: 'step' },
    new Map([
      ['a', { x: 0, y: 0, width: 100, height: 50 }],
      ['b', { x: 200, y: 100, width: 100, height: 50 }],
    ])
  );
  assert.ok(lBend);
  // p1 = (100, 25), p2 = (250, 100), L-corner = (250, 25)
  assert.equal(lBend.pathD, 'M 100 25 L 250 25 L 250 100');
  assert.deepEqual(lBend.midPoint, { x: 250, y: 25 });
  assert.equal(lBend.vertices.length, 3);

  // Same-side U-turn: top -> top (stepOffset === 0 uses 28px outer jetty)
  const uTurn = computeEdgeGeometry(
    { source: 'a', target: 'b', sourceHandle: 'top', targetHandle: 'top', style: 'step' },
    twoNodeMap()
  );
  assert.ok(uTurn);
  assert.equal(uTurn.pathD, 'M 50 0 L 50 -28 L 250 -28 L 250 0');
  assert.deepEqual(uTurn.midPoint, { x: 150, y: -28 });
  assert.equal(uTurn.vertices.length, 4);
});

test('custom waypoints route multi-segment polylines and curved Catmull-Rom splines', () => {
  const waypoints = [
    { x: 140, y: 25 },
    { x: 140, y: 120 },
    { x: 200, y: 120 },
  ];
  const stepGeo = computeEdgeGeometry(
    { source: 'a', target: 'b', style: 'step', waypoints },
    twoNodeMap()
  );
  assert.ok(stepGeo);
  assert.equal(stepGeo.pathD, 'M 100 25 L 140 25 L 140 120 L 200 120 L 200 25');
  assert.deepEqual(stepGeo.midPoint, { x: 140, y: 120 });
  assert.equal(stepGeo.vertices.length, 5);
  assert.equal(stepGeo.segmentMidpoints.length, 4);

  const curveGeo = computeEdgeGeometry(
    { source: 'a', target: 'b', style: 'bezier', waypoints },
    twoNodeMap()
  );
  assert.ok(curveGeo);
  assert.ok(curveGeo.pathD.includes(' C '));
  assert.equal(curveGeo.vertices.length, 5);
});

test('findSegmentIntersection accurately detects interior intersections', () => {
  // Horizontal line (0, 50) -> (100, 50) and Vertical line (50, 0) -> (50, 100)
  const hit = findSegmentIntersection(
    { x: 0, y: 50 },
    { x: 100, y: 50 },
    { x: 50, y: 0 },
    { x: 50, y: 100 }
  );
  assert.ok(hit);
  assert.equal(hit.x, 50);
  assert.equal(hit.y, 50);

  // Parallel lines do not intersect
  const parallel = findSegmentIntersection(
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 20 },
    { x: 100, y: 20 }
  );
  assert.equal(parallel, null);

  // Non-intersecting segments
  const nonCrossing = findSegmentIntersection(
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 50, y: 10 },
    { x: 50, y: 50 }
  );
  assert.equal(nonCrossing, null);
});

test('injectLineJumps adds Draw.io semi-circular arc bridges or gaps on crossing edges', () => {
  const lineA = [
    { x: 0, y: 50 },
    { x: 100, y: 50 },
  ];
  const crossingLineB = [
    { x: 50, y: 0 },
    { x: 50, y: 100 },
  ];

  // Arc bridge
  const arcPath = injectLineJumps(lineA, [crossingLineB], 'arc', 6);
  assert.ok(arcPath.includes('A 6 6 0 0 1'));
  assert.ok(arcPath.includes('M 0 50'));
  assert.ok(arcPath.includes('L 100 50'));

  // Gap bridge
  const gapPath = injectLineJumps(lineA, [crossingLineB], 'gap', 6);
  assert.ok(gapPath.includes('M 56 50'));
  assert.ok(!gapPath.includes('A 6 6'));

  // When no lines cross, path remains intact
  const noCrossing = injectLineJumps(lineA, [], 'arc', 6);
  assert.equal(noCrossing, 'M 0 50 L 100 50');
});

test('calculateAlignmentGuides provides bounding spans and detects equal spacing', () => {
  const box1 = { x: 0, y: 0, width: 100, height: 100 };
  const box2 = { x: 200, y: 0, width: 100, height: 100 };
  const target = { x: 98, y: 102, width: 100, height: 100 };

  const { snappedX, snappedY, guides } = calculateAlignmentGuides(target, [box1, box2], 6);
  // Snapped to box2's Y (0) and aligned
  assert.equal(snappedY, 100); // Bottom of box1/box2
  assert.ok(guides.some((g) => g.start !== undefined && g.end !== undefined));

  // Equal horizontal spacing test:
  // boxL at x=0..100, boxR at x=260..360 (gap of 160).
  // Target placed near center at x=131 with width 100 -> gapL = 31, gapR = 29.
  // Snaps to equal gap = 30.
  const boxL = { x: 0, y: 0, width: 100, height: 50 };
  const boxR = { x: 260, y: 0, width: 100, height: 50 };
  const midTarget = { x: 131, y: 0, width: 100, height: 50 };

  const spacingRes = calculateAlignmentGuides(midTarget, [boxL, boxR], 6);
  assert.equal(spacingRes.snappedX, 130);
  assert.ok(spacingRes.guides.some((g) => g.spacingBadge !== undefined));
  const badge = spacingRes.guides.find((g) => g.spacingBadge)?.spacingBadge;
  assert.equal(badge?.distance, 30);
});



