import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

// The module is imported by `./index.ts` without a file extension, which Node
// cannot resolve on its own.
registerTsResolver();

const {
  STROKE_HIT_SLACK,
  findStrokeAt,
  getStrokeBounds,
  getStrokesBounds,
  isPointOnStroke,
  resizeStroke,
  strokeInkMargin,
  translateStroke,
} = await import('./stroke-element.ts');

const { MIN_RESIZE_SIZE, resizeBoxFromHandle } = await import('./index.ts');
const { boxCenter, rotatePoint } = await import('../core/rotation.ts');

/** A stroke along the x axis from (0,0) to (100,0) with a 4px nib. */
function line(overrides = {}) {
  return {
    id: 's1',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    color: '#000',
    width: 4,
    ...overrides,
  };
}

test('the ink margin is half the nib plus the sloppiness wander', () => {
  assert.equal(strokeInkMargin({ width: 4 }), 2);
  // Roughness 2 is 1.4px of wander either side.
  assert.equal(strokeInkMargin({ width: 4, roughness: 2 }), 2 + 1.4);
});

test('a hairline nib still claims half a pixel, and a negative wander is ignored', () => {
  assert.equal(strokeInkMargin({ width: 0 }), 0.5);
  assert.equal(strokeInkMargin({ width: 4, roughness: -3 }), 2);
});

test('bounds include the nib spread, so the box is the mark and not the path', () => {
  assert.deepEqual(getStrokeBounds(line()), {
    x: -2,
    y: -2,
    width: 104,
    height: 4,
  });
});

test('a sloppier stroke reports a larger box than a clean one', () => {
  const clean = getStrokeBounds(line());
  const sloppy = getStrokeBounds(line({ roughness: 2.5 }));
  assert.ok(sloppy.height > clean.height);
});

test('a stroke with no points has a zero box rather than an infinite one', () => {
  assert.deepEqual(getStrokeBounds(line({ points: [] })), { x: 0, y: 0, width: 0, height: 0 });
});

test('strokes bounds enclose every stroke, and empty ink has no box at all', () => {
  assert.equal(getStrokesBounds([]), null);
  assert.equal(getStrokesBounds([line({ points: [] })]), null);

  const box = getStrokesBounds([
    line(),
    line({
      id: 's2',
      points: [
        { x: 200, y: 50 },
        { x: 210, y: 50 },
      ],
    }),
  ]);

  assert.deepEqual(box, { x: -2, y: -2, width: 214, height: 54 });
});

test('a press on the ink line lands on the stroke', () => {
  const stroke = line();
  assert.ok(isPointOnStroke(stroke, { x: 50, y: 0 }));
  // Within the nib + slack reach, just off the path.
  assert.ok(isPointOnStroke(stroke, { x: 50, y: 2 + STROKE_HIT_SLACK }));
});

test('a press right at the reach boundary still counts, one past it does not', () => {
  const stroke = line();
  const reach = strokeInkMargin(stroke) + STROKE_HIT_SLACK;
  assert.ok(isPointOnStroke(stroke, { x: 50, y: reach }));
  assert.equal(isPointOnStroke(stroke, { x: 50, y: reach + 0.01 }), false);
});

test('hit-testing measures the segments, not only the reported samples', () => {
  // (50, 0) sits between the two samples of a 100px-long line; a naive
  // point-proximity test would miss it entirely.
  assert.ok(isPointOnStroke(line(), { x: 50, y: 0 }));
  // Past the far end, distance is measured to the end point, not the infinite
  // line through it.
  assert.equal(isPointOnStroke(line(), { x: 140, y: 0 }), false);
});

test('a tap — a single-sample stroke — is grabbable as a dot', () => {
  const tap = line({ points: [{ x: 10, y: 10 }] });
  assert.ok(isPointOnStroke(tap, { x: 12, y: 12 }));
  assert.equal(isPointOnStroke(tap, { x: 40, y: 40 }), false);
});

test('a stroke with no points catches nothing', () => {
  assert.equal(isPointOnStroke(line({ points: [] }), { x: 0, y: 0 }), false);
});

test('a wider nib makes a stroke easier to grab', () => {
  const thin = line({ width: 1 });
  const thick = line({ width: 20 });
  const probe = { x: 50, y: 10 };
  assert.equal(isPointOnStroke(thin, probe), false);
  assert.ok(isPointOnStroke(thick, probe));
});

test('findStrokeAt returns the topmost stroke — the last one drawn', () => {
  const under = line({ id: 'under' });
  const over = line({ id: 'over' });
  assert.equal(findStrokeAt([under, over], { x: 50, y: 0 }).id, 'over');

  // And reaches below it when the topmost does not cover the press.
  const elsewhere = line({
    id: 'elsewhere',
    points: [
      { x: 0, y: 500 },
      { x: 100, y: 500 },
    ],
  });
  assert.equal(findStrokeAt([under, elsewhere], { x: 50, y: 0 }).id, 'under');
});

test('findStrokeAt finds nothing on bare canvas', () => {
  assert.equal(findStrokeAt([line()], { x: 50, y: 300 }), null);
  assert.equal(findStrokeAt([], { x: 0, y: 0 }), null);
});

test('translating a stroke moves every point and leaves the style alone', () => {
  const moved = translateStroke(line({ opacity: 0.5, strokeStyle: 'dashed' }), 10, -5);

  assert.deepEqual(moved.points, [
    { x: 10, y: -5 },
    { x: 110, y: -5 },
  ]);
  assert.equal(moved.width, 4);
  assert.equal(moved.opacity, 0.5);
  assert.equal(moved.strokeStyle, 'dashed');
});

test('a zero translation returns the same stroke untouched', () => {
  const stroke = line();
  assert.equal(translateStroke(stroke, 0, 0), stroke);
});

test('resizing maps the stroke from one box into another', () => {
  const from = getStrokeBounds(line());
  const to = { x: 0, y: 0, width: from.width * 2, height: from.height * 2 };
  const scaled = resizeStroke(line(), from, to);

  // The path's own ends land at twice their offset from the box origin.
  assert.ok(Math.abs(scaled.points[1].x - (0 + (100 - from.x) * 2)) < 1e-9);
  assert.equal(scaled.points[1].y, 0 + (0 - from.y) * 2);
});

test('resizing never rewrites the nib', () => {
  const from = getStrokeBounds(line());
  const scaled = resizeStroke(line(), from, { x: 0, y: 0, width: 1000, height: 1000 });

  // A nib is a physical pen: doubling the geometry does not thicken the line.
  assert.equal(scaled.width, 4);
  assert.equal(scaled.points.length, 2);
});

test('a zero-width source box leaves that axis unscaled instead of dividing by zero', () => {
  const vertical = line({
    points: [
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ],
  });
  const from = getStrokeBounds(vertical);
  assert.equal(from.width, 4);

  const scaled = resizeStroke(vertical, { x: 50, y: 0, width: 0, height: 100 }, {
    x: 50,
    y: 0,
    width: 0,
    height: 200,
  });

  // x is untouched (scale 1), y is doubled.
  assert.deepEqual(scaled.points, [
    { x: 50, y: 0 },
    { x: 50, y: 200 },
  ]);
});

test('a fully degenerate source box is left alone', () => {
  const scaled = resizeStroke(line(), { x: 0, y: 0, width: 0, height: 0 }, {
    x: 10,
    y: 10,
    width: 50,
    height: 50,
  });

  // Scale 1 on both axes: the stroke keeps its shape, offset to the new origin.
  assert.deepEqual(scaled.points, [
    { x: 10, y: 10 },
    { x: 110, y: 10 },
  ]);
});

test('resizing is reversible, so a drag out and back restores the ink', () => {
  const original = line();
  const from = getStrokeBounds(original);
  const to = { x: 20, y: -30, width: from.width * 3, height: from.height * 0.5 };

  const scaled = resizeStroke(original, from, to);
  const restored = resizeStroke(scaled, to, from);

  for (const [index, point] of original.points.entries()) {
    assert.ok(Math.abs(restored.points[index].x - point.x) < 1e-9);
    assert.ok(Math.abs(restored.points[index].y - point.y) < 1e-9);
  }
});

test('resizeBoxFromHandle moves only the sides the corner names', () => {
  const box = { x: 0, y: 0, width: 100, height: 50 };

  // Dragging the south-east corner grows both axes and anchors the north-west.
  assert.deepEqual(resizeBoxFromHandle(box, 'se', 20, 10), {
    x: 0,
    y: 0,
    width: 120,
    height: 60,
  });

  // Dragging the north-west corner anchors the south-east.
  assert.deepEqual(resizeBoxFromHandle(box, 'nw', 10, 10), {
    x: 10,
    y: 10,
    width: 90,
    height: 40,
  });

  // A side handle moves one edge only — here the west, keeping y untouched.
  assert.deepEqual(resizeBoxFromHandle(box, 'w', 10, 999), {
    x: 10,
    y: 0,
    width: 90,
    height: 50,
  });

  // East handle expands width to the right, keeping y untouched.
  assert.deepEqual(resizeBoxFromHandle(box, 'e', 25, 999), {
    x: 0,
    y: 0,
    width: 125,
    height: 50,
  });

  // North handle moves top edge, keeping x untouched.
  assert.deepEqual(resizeBoxFromHandle(box, 'n', 999, 15), {
    x: 0,
    y: 15,
    width: 100,
    height: 35,
  });

  // South handle moves bottom edge, keeping x untouched.
  assert.deepEqual(resizeBoxFromHandle(box, 's', 999, 30), {
    x: 0,
    y: 0,
    width: 100,
    height: 80,
  });
});

test('a box stops shrinking at the minimum instead of flipping inside out', () => {
  const box = { x: 0, y: 0, width: 100, height: 50 };

  const squeezed = resizeBoxFromHandle(box, 'nw', 500, 500);
  assert.equal(squeezed.width, MIN_RESIZE_SIZE);
  assert.equal(squeezed.height, MIN_RESIZE_SIZE);
  // The anchored corner has not moved.
  assert.equal(squeezed.x + squeezed.width, 100);
  assert.equal(squeezed.y + squeezed.height, 50);

  const grownPast = resizeBoxFromHandle(box, 'se', -500, -500);
  assert.equal(grownPast.width, MIN_RESIZE_SIZE);
  assert.equal(grownPast.height, MIN_RESIZE_SIZE);
  assert.equal(grownPast.x, 0);
  assert.equal(grownPast.y, 0);
});

test('a uniform resize keeps the proportions and re-anchors the held corner', () => {
  const box = { x: 0, y: 0, width: 100, height: 50 };

  // 60px on x is a wider move than 10px on y, so x's scale (1.6) governs both.
  const uniform = resizeBoxFromHandle(box, 'se', 60, 10, { uniform: true });
  assert.equal(uniform.width, 160);
  assert.equal(uniform.height, 80);
  assert.ok(Math.abs(uniform.width / uniform.height - 2) < 1e-9);

  // Held at the north-west corner the same drag pulls the box in, so both
  // axes shrink by the dominant scale (x's 0.4) rather than each by its own.
  const fromNw = resizeBoxFromHandle(box, 'nw', 60, 10, { uniform: true });
  assert.equal(fromNw.width, 40);
  assert.equal(fromNw.height, 20);
  assert.ok(Math.abs(fromNw.width / fromNw.height - 2) < 1e-9);
  assert.equal(fromNw.x + fromNw.width, 100);
  assert.equal(fromNw.y + fromNw.height, 50);
});

test('a uniform resize honours a custom minimum', () => {
  const box = { x: 0, y: 0, width: 100, height: 50 };
  const squeezed = resizeBoxFromHandle(box, 'se', -500, -500, {
    uniform: true,
    minSize: 12,
  });

  assert.equal(squeezed.width, 12);
  assert.equal(squeezed.height, 12);
});

test('an aspectRatio resize produces a perfect shape with 1:1 width and height', () => {
  // Oblong box (2:1 aspect ratio)
  const box = { x: 50, y: 50, width: 200, height: 100 };

  // Resizing from SE corner with aspectRatio: 1 makes an exact square
  const squareFromCorner = resizeBoxFromHandle(box, 'se', 40, 20, { aspectRatio: 1 });
  assert.equal(squareFromCorner.width, squareFromCorner.height);
  assert.equal(squareFromCorner.x, 50);
  assert.equal(squareFromCorner.y, 50);
  assert.equal(squareFromCorner.width, 240);

  // Resizing from East side handle with aspectRatio: 1 expands height to match width
  const squareFromEast = resizeBoxFromHandle(box, 'e', 60, 0, { aspectRatio: 1 });
  assert.equal(squareFromEast.width, squareFromEast.height);
  assert.equal(squareFromEast.width, 260);
  assert.equal(squareFromEast.x, 50);
  // Vertically centered around original center (100)
  assert.equal(squareFromEast.y + squareFromEast.height / 2, 100);
});

/** A number, to a hair — every turned resize is trigonometry. */
function near(actual, expected, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

/**
 * Where a corner of a box sits once the box is turned about its own centre.
 *
 * The property a rotated resize is judged by is that the corner opposite the
 * one being dragged has not moved on screen, which is only visible by putting
 * the corner back through the same turn.
 */
function turnedCorner(box, corner, rotation) {
  const [nw, ne, se, sw] = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
  return rotatePoint({ nw, ne, se, sw }[corner], boxCenter(box), rotation);
}

test('a turned resize drags along the box’s own axes, not the screen’s', () => {
  // A quarter turn clockwise puts the box's east side along the bottom of the
  // screen, so a drag straight down grows its *width* — dragging the `e` handle
  // downwards is dragging it outwards.
  const upright = { x: 0, y: 0, width: 100, height: 50 };
  const turned = resizeBoxFromHandle({ ...upright, rotation: 90 }, 'e', 0, 40);

  near(turned.width, 140);
  near(turned.height, 50);
});

test('a turned resize keeps the corner opposite the drag where it was', () => {
  const box = { x: 0, y: 0, width: 100, height: 50, rotation: 90 };
  const held = turnedCorner(box, 'nw', 90);

  // Straight down on screen is 20px outwards along the turned box's x axis.
  const resized = resizeBoxFromHandle(box, 'se', 0, 20);

  near(resized.width, 120);
  near(resized.height, 50);

  const stillHeld = turnedCorner(resized, 'nw', 90);
  near(stillHeld.x, held.x);
  near(stillHeld.y, held.y);
});

test('every corner of a turned box holds its opposite, for a quarter turn each way', () => {
  const box = { x: 10, y: 20, width: 100, height: 50 };

  for (const rotation of [90, 180, 270]) {
    const opposite = { se: 'nw', nw: 'se', ne: 'sw', sw: 'ne' };

    for (const handle of ['se', 'nw', 'ne', 'sw']) {
      const turned = { ...box, rotation };
      const held = turnedCorner(turned, opposite[handle], rotation);
      const resized = resizeBoxFromHandle(turned, handle, 30, 12);

      const stillHeld = turnedCorner(resized, opposite[handle], rotation);
      near(stillHeld.x, held.x);
      near(stillHeld.y, held.y);
    }
  }
});

test('a turned box grows past the screen corner it was dragged from', () => {
  // The frame's `se` corner sits north-east of its centre once the box is a
  // quarter turn round, so a 20px outward drag moves the frame up and left —
  // the box on screen grows south-eastwards exactly as the pointer did.
  const box = { x: 0, y: 0, width: 100, height: 50, rotation: 90 };
  const resized = resizeBoxFromHandle(box, 'se', 0, 20);

  near(resized.x, -10);
  near(resized.y, 10);
  near(resized.width, 120);
});

test('a uniform resize of a turned box keeps its proportions and its held corner', () => {
  const box = { x: 0, y: 0, width: 100, height: 50, rotation: 90 };
  const held = turnedCorner(box, 'nw', 90);

  const resized = resizeBoxFromHandle(box, 'se', 0, 20, { uniform: true });

  near(resized.width, 120);
  near(resized.height, 60);
  near(resized.width / resized.height, 2);

  const stillHeld = turnedCorner(resized, 'nw', 90);
  near(stillHeld.x, held.x);
  near(stillHeld.y, held.y);
});

test('a turned resize is never rounded to the grid, so the held corner stays glued', () => {
  // Snapping a turned box would move the corner the press is holding away from
  // the pointer, so the rule is that a turned box is left exact. Upright boxes
  // are snapped exactly as they always were.
  const snap = (value) => Math.round(value / 8) * 8;
  const box = { x: 0, y: 0, width: 100, height: 50 };

  const upright = resizeBoxFromHandle(box, 'se', 0, 20, { snap });
  assert.deepEqual(upright, { x: 0, y: 0, width: 104, height: 72 });

  const turned = resizeBoxFromHandle({ ...box, rotation: 90 }, 'se', 0, 20, { snap });
  near(turned.x, -10);
  near(turned.y, 10);
  near(turned.width, 120);
  near(turned.height, 50);
});

test('a turned box stops shrinking at the minimum, measured on its own axes', () => {
  const box = { x: 0, y: 0, width: 100, height: 50, rotation: 90 };

  // A long drag back up the screen is a drag inwards along the turned x axis.
  const squeezed = resizeBoxFromHandle(box, 'se', 0, -500, { minWidth: 20, minHeight: 10 });

  near(squeezed.width, 20);
  near(squeezed.height, 50);
});

