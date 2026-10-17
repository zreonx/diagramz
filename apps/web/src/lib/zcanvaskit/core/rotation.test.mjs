import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const {
  QUARTER_TURN_DEGREES,
  ROTATION_SNAP_DEGREES,
  boxCenter,
  boxCorners,
  normalizeRotation,
  rotatePoint,
  rotatedBounds,
  rotationDelta,
  rotationOf,
  snapRotation,
} = await import('./rotation.ts');

/** A point, to a hair — every one of these is trigonometry. */
const close = (actual, expected, epsilon = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
};

test('an element with no angle is upright', () => {
  assert.equal(rotationOf({}), 0);
  assert.equal(rotationOf({ rotation: 0 }), 0);
  assert.equal(rotationOf({ rotation: 37.5 }), 37.5);
});

test('an angle is folded into one turn, however it was reached', () => {
  // A quarter turn four times over is a full circle, and a full circle is
  // nothing: without folding, turning a shape all the way round would leave an
  // angle on it that the next drag measures from.
  assert.equal(normalizeRotation(0), 0);
  assert.equal(normalizeRotation(360), 0);
  assert.equal(normalizeRotation(720), 0);
  assert.equal(normalizeRotation(-90), 270);
  assert.equal(normalizeRotation(-360), 0);
  assert.equal(normalizeRotation(450), 90);
  assert.equal(normalizeRotation(-450), 270);
});

test('a snapped angle lands on the nearest step', () => {
  assert.equal(ROTATION_SNAP_DEGREES, 15);
  assert.equal(snapRotation(7), 0);
  assert.equal(snapRotation(8), 15);
  assert.equal(snapRotation(97), 90);
  assert.equal(snapRotation(-7), 0);
  // Rounding -8 to -15 folds to the 345 the document stores.
  assert.equal(snapRotation(-8), 345);
  assert.equal(snapRotation(359), 0);
  assert.equal(snapRotation(90, 45), 90);
});

test('a point turns clockwise about the origin it is given', () => {
  const origin = { x: 0, y: 0 };
  // Screen y grows downwards, so a quarter turn clockwise takes the point to
  // the right of the origin to the point below it.
  const right = rotatePoint({ x: 10, y: 0 }, origin, QUARTER_TURN_DEGREES);
  close(right.x, 0);
  close(right.y, 10);

  const down = rotatePoint({ x: 0, y: 10 }, origin, QUARTER_TURN_DEGREES);
  close(down.x, -10);
  close(down.y, 0);

  // The same turn the other way is the inverse.
  const back = rotatePoint(right, origin, -QUARTER_TURN_DEGREES);
  close(back.x, 10);
  close(back.y, 0);

  // And no turn is the point itself, not a copy of it.
  const still = { x: 3, y: 4 };
  assert.notEqual(rotatePoint(still, origin, 0), still);
  assert.deepEqual(rotatePoint(still, origin, 0), { x: 3, y: 4 });
});

test('a turn is taken about the origin it is given, not the canvas', () => {
  const turned = rotatePoint({ x: 20, y: 10 }, { x: 10, y: 10 }, 180);
  close(turned.x, 0);
  close(turned.y, 10);
});

test('a box reports its centre and its four corners in order', () => {
  const box = { x: 0, y: 0, width: 100, height: 50 };

  assert.deepEqual(boxCenter(box), { x: 50, y: 25 });
  assert.deepEqual(boxCorners(box), [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 0, y: 50 },
  ]);
});

test('an upright box covers exactly itself', () => {
  assert.deepEqual(rotatedBounds({ x: 5, y: 7, width: 20, height: 10 }), {
    x: 5,
    y: 7,
    width: 20,
    height: 10,
  });
});

test('a turned box is measured by the corners it swings out to', () => {
  // A square on its corner is as wide as its diagonal, and the box that holds
  // it is the diagonal both ways.
  const bounds = rotatedBounds({ x: 0, y: 0, width: 10, height: 10, rotation: 45 });
  const diagonal = Math.sqrt(200);
  close(bounds.width, diagonal, 1e-9);
  close(bounds.height, diagonal, 1e-9);
  close(bounds.x, (10 - diagonal) / 2, 1e-9);
  close(bounds.y, (10 - diagonal) / 2, 1e-9);

  // A half turn of a rectangle covers the rectangle it started as. Compared to
  // a hair rather than exactly: `Math.sin(Math.PI)` is 1.2e-16, not zero, so a
  // turn that ought to land back on itself lands a fraction of a nanometre off.
  const half = rotatedBounds({ x: 3, y: 4, width: 20, height: 10, rotation: 180 });
  close(half.x, 3);
  close(half.y, 4);
  close(half.width, 20);
  close(half.height, 10);

  // A quarter turn of a wide box is the same footprint stood on its end.
  const quarter = rotatedBounds({ x: 0, y: 0, width: 20, height: 10, rotation: 90 });
  close(quarter.width, 10);
  close(quarter.height, 20);
  close(quarter.x, 5);
  close(quarter.y, -5);
});

test('the swing from one bearing to another is the short way round', () => {
  const centre = { x: 0, y: 0 };

  // Due east to due south, on screen: a quarter turn clockwise.
  close(rotationDelta({ x: 1, y: 0 }, { x: 0, y: 1 }, centre), QUARTER_TURN_DEGREES);
  close(rotationDelta({ x: 1, y: 0 }, { x: 0, y: -1 }, centre), -QUARTER_TURN_DEGREES);

  // Across the seam: 179° to -179° is two degrees on, not 358 back.
  const near = { x: Math.cos((179 * Math.PI) / 180), y: Math.sin((179 * Math.PI) / 180) };
  const past = { x: Math.cos((-179 * Math.PI) / 180), y: Math.sin((-179 * Math.PI) / 180) };
  close(rotationDelta(near, past, centre), 2, 1e-9);
  close(rotationDelta(past, near, centre), -2, 1e-9);

  // A pointer that has not moved has swung nowhere.
  close(rotationDelta({ x: 10, y: 3 }, { x: 10, y: 3 }, centre), 0);
});
